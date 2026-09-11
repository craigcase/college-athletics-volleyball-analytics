import { requireProgramContext } from '../../../../lib/auth/program-context';
import { fetchEvidenceUrl } from '../../../../lib/ingestion/fetch-source';
import { parseScheduleHtml } from '../../../../lib/ingestion/schedule/sidearm';
import { preserveSource } from '../../../../db/repositories/sources';
import { upsertScheduleEvidence } from '../../../../db/repositories/schedule';

export async function POST(request:Request){
  try{
    const {user,program}=await requireProgramContext();
    const body=await request.json() as Record<string,unknown>;
    if(typeof body.sourceUrl!=='string')return Response.json({error:'Schedule URL is required.'},{status:400});
    const fetched=await fetchEvidenceUrl(body.sourceUrl);
    const source=await preserveSource({programId:program.programId,bytes:fetched.bytes,sourceFamily:'official_schedule',sourceUrl:fetched.url,contentType:fetched.contentType,importedBy:user.email,parserVersion:'schedule-sidearm-1.1.0'});
    const matches=parseScheduleHtml(new TextDecoder().decode(fetched.bytes),fetched.url,program.seasonYear);
    if(!matches.length)return Response.json({error:'No supported schedule matches were found. The source snapshot was preserved for adapter review.',sourceArtifactId:source.id},{status:422});
    const summary=await upsertScheduleEvidence({programId:program.programId,seasonId:program.seasonId,ourTeamId:program.teamId,matches,actorEmail:user.email,sourceArtifactId:source.id});
    return Response.json({summary,sourceArtifactId:source.id,duplicateSource:source.duplicate});
  }catch(e){const m=e instanceof Error?e.message:'Schedule import failed.';return Response.json({error:m},{status:m==='UNAUTHENTICATED'?401:m==='PROGRAM_SETUP_REQUIRED'?409:400});}
}
