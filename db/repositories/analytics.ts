import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import { detectCapabilities } from '../../lib/capabilities/detect';
import { calculateMatchAnalytics } from '../../lib/analytics/match';
import { rankMatchFindings } from '../../lib/analytics/findings';
import { reconcileField } from '../../lib/ingestion/reconcile';
import type { EvidenceObservation } from '../../lib/ingestion/types';

const numericFields = ['kills','attack_errors','attack_attempts','assists','aces','service_errors','digs','blocks','reception_errors'] as const;

export async function recalculateMatch(matchId:string):Promise<{canonicalRevision:number;metricCount:number;findingCount:number}>{
  const db=getDb();
  const match=await db.prepare('SELECT id,program_id programId,canonical_revision canonicalRevision FROM matches WHERE id=?').bind(matchId).first<any>();
  if(!match) throw new Error('MATCH_NOT_FOUND');
  const rows=await db.prepare(`SELECT eo.entity_type entityType,eo.source_entity_key entityKey,eo.field_name field,eo.value_json valueJson,eo.set_number setNumber,eo.rally_index rallyIndex,eo.source_confidence sourceConfidence,sa.lineage_id lineageId FROM evidence_observations eo JOIN source_artifacts sa ON sa.id=eo.source_artifact_id WHERE eo.match_id=?`).bind(matchId).all<any>();
  const observations:EvidenceObservation[]=(rows.results??[]).map(r=>({entityType:r.entityType,entityKey:r.entityKey??'',field:r.field,value:JSON.parse(r.valueJson),...(r.setNumber!=null?{setNumber:r.setNumber}:{}),...(r.rallyIndex!=null?{rallyIndex:r.rallyIndex}:{})}));
  const capabilities=detectCapabilities({observations});
  const revision=match.canonicalRevision;
  const teams:any={};
  for(const side of ['us','opponent'] as const){
    const totals:any={};
    for(const field of numericFields){
      const sourceRows=(rows.results??[]).filter(r=>r.entityType==='team'&&r.entityKey===side&&r.field===field);
      if(!sourceRows.length) continue;
      const override=await db.prepare('SELECT canonical_value_json valueJson FROM canonical_overrides WHERE program_id=? AND entity_type=\'match_team\' AND entity_id=? AND field_name=?').bind(match.programId,`${matchId}:${side}`,field).first<any>();
      const reconciled=reconcileField({ observations:sourceRows.map(r=>({value:JSON.parse(r.valueJson),sourceConfidence:r.sourceConfidence,lineageId:r.lineageId??r.source_artifact_id??'unknown'})), ...(override?{override:{value:JSON.parse(override.valueJson)}}:{}) });
      if(reconciled.status==='resolved'&&typeof reconciled.value==='number') totals[field]=reconciled.value;
      else if(reconciled.status==='conflict') await db.prepare('INSERT INTO reconciliation_issues(id,program_id,issue_type,entity_type,entity_id,details_json,status,created_at) VALUES(?,?,?,?,?,?,\'open\',?)').bind(id('issue'),match.programId,'field_conflict','match_team',`${matchId}:${side}`,JSON.stringify({field,values:reconciled.values}),nowIso()).run();
    }
    teams[side==='us'?'our_team':'opponent']={kills:totals.kills,attackErrors:totals.attack_errors,attackAttempts:totals.attack_attempts,aces:totals.aces,serviceErrors:totals.service_errors};
    await db.prepare('INSERT OR REPLACE INTO match_team_totals(id,match_id,team_side,canonical_revision,kills,attack_errors,attack_attempts,assists,aces,service_errors,digs,blocks,reception_errors,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('teamtotal'),matchId,side==='us'?'our_team':'opponent',revision,totals.kills??null,totals.attack_errors??null,totals.attack_attempts??null,totals.assists??null,totals.aces??null,totals.service_errors??null,totals.digs??null,totals.blocks??null,totals.reception_errors??null,nowIso()).run();
  }
  const metrics=calculateMatchAnalytics({matchId,canonicalRevision:revision,capabilities,teams});
  const findings=rankMatchFindings(metrics);
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO match_capabilities(match_id,canonical_revision,box_score_totals,player_totals,set_totals,rally_sequence,serve_receive_state,rotation_state,on_court_state,contact_quality,attack_origin,attack_destination,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(matchId,revision,+capabilities.boxScoreTotals,+capabilities.playerTotals,+capabilities.setTotals,+capabilities.rallySequence,+capabilities.serveReceiveState,+capabilities.rotationState,+capabilities.onCourtState,+capabilities.contactQuality,+capabilities.attackOrigin,+capabilities.attackDestination,nowIso()),
    db.prepare('DELETE FROM match_metric_results WHERE match_id=? AND canonical_revision=?').bind(matchId,revision),
    db.prepare('DELETE FROM match_findings WHERE match_id=? AND canonical_revision=?').bind(matchId,revision)
  ]);
  for(const m of metrics) await db.prepare('INSERT INTO match_metric_results(id,match_id,canonical_revision,subject,metric_code,numerator,denominator,value,status,engine_version,calculated_at) VALUES(?,?,?,?,?,?,?,?,\'supported\',?,?)').bind(id('metric'),matchId,revision,m.subject,m.metric,m.numerator??null,m.denominator??null,m.value,m.engineVersion,nowIso()).run();
  for(const [i,f] of findings.entries()) await db.prepare('INSERT INTO match_findings(id,match_id,canonical_revision,side,metric_code,direction,magnitude,opportunities,rank_score,evidence_json,engine_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('finding'),matchId,revision,f.direction==='our_advantage'?'our_team':'opponent',f.metric,f.direction,f.magnitude,f.opportunities??null,f.rankScore,JSON.stringify({ourValue:f.ourValue,opponentValue:f.opponentValue}),metrics[0]?.engineVersion??'1.0.0',nowIso()).run();
  return {canonicalRevision:revision,metricCount:metrics.length,findingCount:findings.length};
}

export async function getStoredMetrics(matchId:string){const r=await getDb().prepare('SELECT match_id matchId,subject,metric_code metric,value,denominator opportunities,engine_version engineVersion FROM match_metric_results WHERE match_id=? AND canonical_revision=(SELECT canonical_revision FROM matches WHERE id=?)').bind(matchId,matchId).all();return r.results??[];}

export async function getMatchSummary(matchId:string){
  const db=getDb();
  const match=await db.prepare(`SELECT m.id,m.scheduled_at scheduledAt,m.home_away homeAway,m.location,m.result,m.set_scores_json setScoresJson,m.canonical_revision canonicalRevision,t.canonical_name opponentName,CASE WHEN mc.contact_quality=1 OR mc.attack_destination=1 THEN 'Rich Data' WHEN mc.rally_sequence=1 OR mc.set_totals=1 THEN 'Standard Data' WHEN mc.box_score_totals=1 THEN 'Basic Data' ELSE 'No Data Yet' END dataStatus FROM matches m LEFT JOIN teams t ON t.id=m.opponent_team_id LEFT JOIN match_capabilities mc ON mc.match_id=m.id WHERE m.id=?`).bind(matchId).first<any>();
  if(!match)return null;
  const metrics=await getStoredMetrics(matchId);
  const findings=(await db.prepare('SELECT side,metric_code metric,direction,magnitude,opportunities,rank_score rankScore,evidence_json evidenceJson FROM match_findings WHERE match_id=? AND canonical_revision=? ORDER BY rank_score DESC').bind(matchId,match.canonicalRevision).all()).results??[];
  const sources=(await db.prepare('SELECT sa.source_family sourceFamily,sa.original_filename fileName,sa.source_url sourceUrl,sa.imported_at importedAt FROM match_source_links l JOIN source_artifacts sa ON sa.id=l.source_artifact_id WHERE l.match_id=? ORDER BY sa.imported_at DESC').bind(matchId).all()).results??[];
  return {...match,metrics,findings,sources};
}
