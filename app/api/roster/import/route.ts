import { requireProgramContext } from '../../../../lib/auth/program-context';
import { fetchEvidenceUrl } from '../../../../lib/ingestion/fetch-source';
import { parseRosterHtml } from '../../../../lib/ingestion/roster/sidearm';
import { preserveSource } from '../../../../db/repositories/sources';
import { upsertRosterEvidence } from '../../../../db/repositories/roster';
export async function POST(request:Request){
  try{
    const {user,program}=await requireProgramContext(request.headers); const body=await request.json(); if(typeof body.sourceUrl!=='string')return Response.json({error:'Roster URL is required.'},{status:400});
    const fetched=await fetchEvidenceUrl(body.sourceUrl); const source=await preserveSource({programId:program.programId,bytes:fetched.bytes,sourceFamily:'official_roster',sourceUrl:fetched.url,contentType:fetched.contentType,importedBy:user.email,parserVersion:'roster-sidearm-1.0.0'});
    const players=parseRosterHtml(new TextDecoder().decode(fetched.bytes),fetched.url); if(!players.length)return Response.json({error:'No supported roster players were found. The source snapshot was preserved for adapter review.',sourceArtifactId:source.id},{status:422});
    const summary=await upsertRosterEvidence({programId:program.programId,seasonId:program.seasonId,teamId:program.teamId,players,sourceFamily:'official_roster',actorEmail:user.email}); return Response.json({summary,sourceArtifactId:source.id,duplicateSource:source.duplicate});
  }catch(e){const m=e instanceof Error?e.message:'Roster import failed.';return Response.json({error:m},{status:m==='UNAUTHENTICATED'?401:m==='PROGRAM_SETUP_REQUIRED'?409:400});}
}
