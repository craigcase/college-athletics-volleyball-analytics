import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import type { EvidenceObservation } from '../../lib/ingestion/types';
import type { SourceFamily } from '../../lib/ingestion/source-family';
import { sourceConfidence } from '../../lib/ingestion/confidence';
import { resolveCanonicalMatch, type MatchEvidenceIdentity } from '../../lib/ingestion/match/resolve-match';
import { recalculateMatch } from './analytics';

export async function resolveMatchForEvidence(programId:string,seasonId:string,evidence:MatchEvidenceIdentity){
  const db=getDb();
  const matches=await db.prepare(`SELECT m.id,substr(m.scheduled_at,1,10) date,m.home_away homeAway,m.set_scores_json setScoresJson,m.source_match_id sourceMatchId,t.canonical_name opponentName FROM matches m LEFT JOIN teams t ON t.id=m.opponent_team_id WHERE m.program_id=? AND m.season_id=?`).bind(programId,seasonId).all<any>();
  const candidates=[];
  for(const m of matches.results??[]){
    const aliases=await db.prepare('SELECT alias FROM team_aliases WHERE team_id=(SELECT opponent_team_id FROM matches WHERE id=?)').bind(m.id).all<{alias:string}>();
    candidates.push({id:m.id,date:m.date,opponentNames:[m.opponentName,...(aliases.results??[]).map(a=>a.alias)].filter(Boolean),homeAway:m.homeAway,setScores:m.setScoresJson?JSON.parse(m.setScoresJson):undefined,sourceMatchIds:m.sourceMatchId?[m.sourceMatchId]:undefined});
  }
  return resolveCanonicalMatch({evidence,candidates});
}

export async function attachEvidenceToMatch(input:{programId:string;matchId:string;sourceArtifactId:string;sourceFamily:SourceFamily;lineageId:string;matchConfidence:number;observations:EvidenceObservation[];actorEmail:string}){
  const db=getDb(),now=nowIso();
  const linked=await db.prepare('SELECT id FROM match_source_links WHERE match_id=? AND source_artifact_id=?').bind(input.matchId,input.sourceArtifactId).first();
  if(linked)return {duplicate:true,matchId:input.matchId};
  const statements:any[]=[db.prepare('INSERT INTO match_source_links(id,match_id,source_artifact_id,match_confidence,created_at) VALUES(?,?,?,?,?)').bind(id('matchsource'),input.matchId,input.sourceArtifactId,input.matchConfidence,now)];
  for(const o of input.observations) statements.push(db.prepare('INSERT INTO evidence_observations(id,program_id,source_artifact_id,match_id,entity_type,source_entity_key,field_name,value_json,set_number,rally_index,source_confidence,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('obs'),input.programId,input.sourceArtifactId,input.matchId,o.entityType,o.entityKey,o.field,JSON.stringify(o.value),o.setNumber??null,o.rallyIndex??null,sourceConfidence(input.sourceFamily,o.field),now));
  statements.push(db.prepare('UPDATE matches SET canonical_revision=canonical_revision+1,updated_at=? WHERE id=?').bind(now,input.matchId));
  statements.push(db.prepare('INSERT INTO activity_events(id,program_id,actor_email,action,entity_type,entity_id,details_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id('activity'),input.programId,input.actorEmail,'match.evidence_attached','match',input.matchId,JSON.stringify({sourceArtifactId:input.sourceArtifactId,sourceFamily:input.sourceFamily,observationCount:input.observations.length}),now));
  await db.batch(statements);
  const analytics=await recalculateMatch(input.matchId);
  return {duplicate:false,matchId:input.matchId,analytics};
}
