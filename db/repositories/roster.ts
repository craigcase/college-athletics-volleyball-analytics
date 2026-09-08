import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import type { RosterEvidence } from '../../lib/ingestion/roster/sidearm';

const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export async function upsertRosterEvidence(input:{programId:string;seasonId:string;teamId:string;players:RosterEvidence[];sourceFamily:string;actorEmail:string}){
  const db=getDb(), now=nowIso(); let created=0,updated=0,needsReview=0;
  for(const p of input.players){
    let playerId:string|undefined;
    if(p.sourcePlayerId){
      const found=await db.prepare('SELECT pa.player_id playerId FROM player_aliases pa WHERE pa.source_external_id=? LIMIT 1').bind(p.sourcePlayerId).first<{playerId:string}>();
      playerId=found?.playerId;
    }
    if(!playerId){
      const rows=await db.prepare('SELECT p.id,p.canonical_name FROM players p JOIN player_seasons ps ON ps.player_id=p.id WHERE ps.program_id=?').bind(input.programId).all<{id:string;canonical_name:string}>();
      const matches=(rows.results ?? []).filter(x=>normalize(x.canonical_name)===normalize(p.name));
      if(matches.length===1) playerId=matches[0].id;
      else if(matches.length>1){
        needsReview++;
        await db.prepare('INSERT INTO reconciliation_issues(id,program_id,issue_type,entity_type,details_json,status,created_at) VALUES(?,?,?,?,?,\'open\',?)').bind(id('issue'),input.programId,'ambiguous_player_identity','player',JSON.stringify({sourceName:p.name,candidates:matches.map(x=>x.id)}),now).run();
        continue;
      }
    }
    if(!playerId){
      playerId=id('player'); created++;
      await db.batch([
        db.prepare('INSERT INTO players(id,canonical_name,created_at) VALUES(?,?,?)').bind(playerId,p.name,now),
        db.prepare('INSERT INTO player_aliases(id,player_id,alias,source_family,source_external_id,created_at) VALUES(?,?,?,?,?,?)').bind(id('playeralias'),playerId,p.name,input.sourceFamily,p.sourcePlayerId ?? null,now),
      ]);
    } else updated++;
    const ps=await db.prepare('SELECT id FROM player_seasons WHERE player_id=? AND season_id=?').bind(playerId,input.seasonId).first<{id:string}>();
    if(ps){
      await db.prepare('UPDATE player_seasons SET jersey_number=?,official_position=?,class_year=?,height=?,hometown=?,previous_school=?,profile_url=COALESCE(profile_url,?),image_url=COALESCE(image_url,?),source_player_id=COALESCE(source_player_id,?) WHERE id=?').bind(p.number??null,p.officialPosition??null,p.classYear??null,p.height??null,p.hometown??null,p.previousSchool??null,p.profileUrl??null,p.imageUrl??null,p.sourcePlayerId??null,ps.id).run();
    }else{
      await db.prepare('INSERT INTO player_seasons(id,player_id,program_id,season_id,team_id,jersey_number,official_position,class_year,height,hometown,previous_school,profile_url,image_url,source_player_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('playerseason'),playerId,input.programId,input.seasonId,input.teamId,p.number??null,p.officialPosition??null,p.classYear??null,p.height??null,p.hometown??null,p.previousSchool??null,p.profileUrl??null,p.imageUrl??null,p.sourcePlayerId??null,now).run();
    }
  }
  await db.prepare('INSERT INTO activity_events(id,program_id,actor_email,action,entity_type,details_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id('activity'),input.programId,input.actorEmail,'roster.imported','roster',JSON.stringify({created,updated,needsReview}),now).run();
  return {created,updated,needsReview,total:input.players.length};
}
export async function listRoster(programId:string,seasonId:string){
  const out=await getDb().prepare('SELECT p.id,p.canonical_name name,ps.jersey_number number,ps.official_position officialPosition,ps.class_year classYear,ps.height,ps.hometown,ps.previous_school previousSchool,ps.image_url imageUrl FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.program_id=? AND ps.season_id=? AND ps.active=1 ORDER BY CASE WHEN ps.jersey_number GLOB \'[0-9]*\' THEN CAST(ps.jersey_number AS INTEGER) ELSE 999 END,p.canonical_name').bind(programId,seasonId).all();
  return out.results ?? [];
}
