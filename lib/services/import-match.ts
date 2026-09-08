import { detectSourceFamily, type SourceFamily } from '../ingestion/source-family';
import { parseMatchSource } from '../ingestion/match/parse-source';
import { preserveSource } from '../../db/repositories/sources';
import { resolveMatchForEvidence, attachEvidenceToMatch } from '../../db/repositories/matches';
import { getDb } from '../../db/client';
import { id, nowIso } from '../ids';

const PARSER_VERSION='ingestion-1.0.0';
export async function importMatchBytes(input:{programId:string;seasonId:string;bytes:Uint8Array;sourceUrl?:string;fileName?:string;contentType?:string;actorEmail:string;ourTeamNames?:string[]}){
  const sourceFamily=detectSourceFamily({fileName:input.fileName,contentType:input.contentType,bytes:input.bytes});
  const source=await preserveSource({...input,sourceFamily,importedBy:input.actorEmail,parserVersion:PARSER_VERSION});
  if(source.duplicate){
    const link=await getDb().prepare('SELECT match_id matchId FROM match_source_links WHERE source_artifact_id=? LIMIT 1').bind(source.id).first<{matchId:string}>();
    return {status:'duplicate' as const,sourceArtifactId:source.id,matchId:link?.matchId};
  }
  const text=new TextDecoder().decode(input.bytes);
  const parsed=parseMatchSource({
    text,
    sourceFamily,
    sourceUrl:input.sourceUrl??`upload://${input.fileName??'source'}`,
    ourTeamNames:input.ourTeamNames,
  });
  const resolution=await resolveMatchForEvidence(input.programId,input.seasonId,{date:parsed.match.date,opponentName:parsed.match.opponentName,homeAway:parsed.match.homeAway,setScores:parsed.match.setScores,sourceMatchId:parsed.match.sourceMatchId});
  if(resolution.status!=='matched'){
    await getDb().prepare('INSERT INTO reconciliation_issues(id,program_id,issue_type,entity_type,source_artifact_id,details_json,status,created_at) VALUES(?,?,?,?,?,?,\'open\',?)').bind(id('issue'),input.programId,resolution.status==='ambiguous'?'ambiguous_match_identity':'unmatched_source','match',source.id,JSON.stringify({resolution,matchEvidence:parsed.match}),nowIso()).run();
    return {status:'needs_review' as const,sourceArtifactId:source.id,resolution,sourceFamily,observationCount:parsed.observations.length};
  }
  const attached=await attachEvidenceToMatch({programId:input.programId,matchId:resolution.matchId,sourceArtifactId:source.id,sourceFamily:sourceFamily as SourceFamily,lineageId:source.lineageId,matchConfidence:resolution.confidence,observations:parsed.observations,actorEmail:input.actorEmail});
  return {status:'enriched' as const,sourceArtifactId:source.id,sourceFamily,observationCount:parsed.observations.length,...attached};
}
