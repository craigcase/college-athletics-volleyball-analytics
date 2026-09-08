import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import type { ScheduleEvidence } from '../../lib/ingestion/schedule/sidearm';
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export async function upsertScheduleEvidence(input:{programId:string;seasonId:string;ourTeamId:string;matches:ScheduleEvidence[];actorEmail:string}){
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
    if(!existing){added++;await db.prepare('INSERT INTO matches(id,program_id,season_id,our_team_id,opponent_team_id,scheduled_at,home_away,competition,location,status,result,set_scores_json,source_match_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('match'),input.programId,input.seasonId,input.ourTeamId,team.id,ev.date,ev.homeAway ?? 'unknown','unknown',ev.location??null,ev.result?'completed':'scheduled',ev.result??null,ev.setScores?JSON.stringify(ev.setScores):null,ev.sourceMatchId??null,now,now).run();}
    else {
      const next=JSON.stringify({scheduled_at:ev.date,home_away:ev.homeAway??'unknown',location:ev.location??null,result:ev.result??null,set_scores_json:ev.setScores?JSON.stringify(ev.setScores):null});
      const prev=JSON.stringify({scheduled_at:existing.scheduled_at,home_away:existing.home_away,location:existing.location??null,result:existing.result??null,set_scores_json:existing.set_scores_json??null});
      if(next===prev) unchanged++; else {changed++;await db.prepare('INSERT INTO reconciliation_issues(id,program_id,issue_type,entity_type,entity_id,details_json,status,created_at) VALUES(?,?,?,?,?,?,\'open\',?)').bind(id('issue'),input.programId,'schedule_change','match',existing.id,JSON.stringify({current:JSON.parse(prev),proposed:JSON.parse(next)}),now).run();}
    }
  }
  await db.prepare('INSERT INTO activity_events(id,program_id,actor_email,action,entity_type,details_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id('activity'),input.programId,input.actorEmail,'schedule.imported','schedule',JSON.stringify({added,changed,unchanged}),now).run();
  return {added,changed,unchanged,total:input.matches.length};
}
export async function listMatches(programId:string,seasonId:string){const r=await getDb().prepare('SELECT m.id,m.scheduled_at scheduledAt,m.home_away homeAway,m.location,m.status,m.result,m.set_scores_json setScoresJson,m.canonical_revision canonicalRevision,t.canonical_name opponentName,CASE WHEN mc.contact_quality=1 OR mc.attack_destination=1 THEN \'Rich Data\' WHEN mc.rally_sequence=1 OR mc.set_totals=1 THEN \'Standard Data\' WHEN mc.box_score_totals=1 THEN \'Basic Data\' ELSE \'No Data Yet\' END dataStatus FROM matches m LEFT JOIN teams t ON t.id=m.opponent_team_id LEFT JOIN match_capabilities mc ON mc.match_id=m.id WHERE m.program_id=? AND m.season_id=? ORDER BY m.scheduled_at').bind(programId,seasonId).all();return r.results??[];}
