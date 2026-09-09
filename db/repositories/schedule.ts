import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import type { ScheduleEvidence } from '../../lib/ingestion/schedule/sidearm';
import { planScheduleRefresh } from '../../lib/ingestion/schedule/refresh';
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export async function upsertScheduleEvidence(input:{programId:string;seasonId:string;ourTeamId:string;matches:ScheduleEvidence[];actorEmail:string;sourceArtifactId:string}){
  const db=getDb(),now=nowIso();let added=0,changed=0,unchanged=0;
  for(const ev of input.matches){
    let team=await db.prepare('SELECT t.id FROM teams t JOIN team_aliases a ON a.team_id=t.id WHERE lower(a.alias)=lower(?) LIMIT 1').bind(ev.opponentName).first<{id:string}>();
    if(!team){const tid=id('team');await db.batch([db.prepare('INSERT INTO teams(id,canonical_name,created_at) VALUES(?,?,?)').bind(tid,ev.opponentName,now),db.prepare('INSERT INTO team_aliases(id,team_id,alias,source_family,created_at) VALUES(?,?,?,?,?)').bind(id('teamalias'),tid,ev.opponentName,'official_schedule',now)]);team={id:tid};}
    let existing:any=null;
    if(ev.sourceMatchId) existing=await db.prepare('SELECT * FROM matches WHERE season_id=? AND source_match_id=?').bind(input.seasonId,ev.sourceMatchId).first();
    if(!existing){
      const candidates=await db.prepare('SELECT m.*,t.canonical_name opponentName FROM matches m LEFT JOIN teams t ON t.id=m.opponent_team_id WHERE m.season_id=? AND substr(m.scheduled_at,1,10)=?').bind(input.seasonId,ev.date.slice(0,10)).all<any>();
      existing=(candidates.results??[]).find(c=>norm(c.opponentName??'')===norm(ev.opponentName) && c.home_away===ev.homeAway) ?? null;
    }
    if(!existing){added++;existing={id:id('match')};await db.prepare('INSERT INTO matches(id,program_id,season_id,our_team_id,opponent_team_id,scheduled_at,home_away,competition,location,status,result,set_scores_json,source_match_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(existing.id,input.programId,input.seasonId,input.ourTeamId,team.id,ev.date,ev.homeAway ?? 'unknown','unknown',ev.location??null,ev.result?'completed':'scheduled',ev.result??null,ev.setScores?JSON.stringify(ev.setScores):null,ev.sourceMatchId??null,now,now).run();}
    else {
      const incoming={scheduledAt:ev.date,homeAway:ev.homeAway??'unknown',location:ev.location??null,result:ev.result??null,setScoresJson:ev.setScores?JSON.stringify(ev.setScores):null};
      const current={scheduledAt:existing.scheduled_at,homeAway:existing.home_away,location:existing.location??null,result:existing.result??null,setScoresJson:existing.set_scores_json??null};
      const plan=planScheduleRefresh(current,incoming);
      if(plan.status==='unchanged') unchanged++;
      else if(plan.status==='enrich'){
        changed++;
        await db.prepare('UPDATE matches SET location=coalesce(location,?),result=coalesce(result,?),set_scores_json=coalesce(set_scores_json,?),status=CASE WHEN result IS NULL AND ? IS NOT NULL THEN \'completed\' ELSE status END,updated_at=? WHERE id=?').bind(plan.patch.location??null,plan.patch.result??null,plan.patch.setScoresJson??null,plan.patch.result??null,now,existing.id).run();
      }
      else {changed++;await db.prepare('INSERT INTO reconciliation_issues(id,program_id,issue_type,entity_type,entity_id,details_json,status,created_at) VALUES(?,?,?,?,?,?,\'open\',?)').bind(id('issue'),input.programId,'schedule_change','match',existing.id,JSON.stringify({current,proposed:incoming,conflictingFields:plan.conflictingFields}),now).run();}
    }
    await db.prepare('INSERT OR IGNORE INTO match_source_links(id,match_id,source_artifact_id,match_confidence,created_at) VALUES(?,?,?,?,?)')
      .bind(id('matchsource'),existing.id,input.sourceArtifactId,0.95,now).run();
    const fields={date:ev.date,opponentName:ev.opponentName,homeAway:ev.homeAway,location:ev.location,
      result:ev.result,setScores:ev.setScores,sourceMatchId:ev.sourceMatchId,boxScoreUrl:ev.boxScoreUrl};
    await db.batch(Object.entries(fields).filter(([,value])=>value!==undefined).map(([field,value])=>
      db.prepare(`INSERT INTO evidence_observations
        (id,program_id,source_artifact_id,match_id,entity_type,entity_id,source_entity_key,field_name,value_json,source_confidence,observed_at)
        SELECT ?,?,?,?,'match',?,?,?,?,0.9,?
        WHERE NOT EXISTS (SELECT 1 FROM evidence_observations WHERE source_artifact_id=? AND entity_type='match' AND entity_id=? AND field_name=?)`)
        .bind(id('observation'),input.programId,input.sourceArtifactId,existing.id,existing.id,ev.sourceMatchId??null,
          field,JSON.stringify(value),now,input.sourceArtifactId,existing.id,field)));
  }
  await db.prepare('INSERT INTO activity_events(id,program_id,actor_email,action,entity_type,details_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id('activity'),input.programId,input.actorEmail,'schedule.imported','schedule',JSON.stringify({added,changed,unchanged}),now).run();
  return {added,changed,unchanged,total:input.matches.length};
}
export async function listMatches(programId:string,seasonId:string){const r=await getDb().prepare('SELECT m.id,m.scheduled_at scheduledAt,m.home_away homeAway,m.location,m.status,m.result,m.set_scores_json setScoresJson,m.canonical_revision canonicalRevision,t.canonical_name opponentName,CASE WHEN mc.contact_quality=1 OR mc.attack_destination=1 THEN \'Rich Data\' WHEN mc.rally_sequence=1 OR mc.set_totals=1 THEN \'Standard Data\' WHEN mc.box_score_totals=1 THEN \'Basic Data\' ELSE \'No Data Yet\' END dataStatus FROM matches m LEFT JOIN teams t ON t.id=m.opponent_team_id LEFT JOIN match_capabilities mc ON mc.match_id=m.id WHERE m.program_id=? AND m.season_id=? ORDER BY m.scheduled_at').bind(programId,seasonId).all();return r.results??[];}
