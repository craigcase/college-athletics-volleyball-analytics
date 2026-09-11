import { requireProgramContext } from '../../../../lib/auth/program-context';
import { fetchEvidenceUrl } from '../../../../lib/ingestion/fetch-source';
import { importMatchBytes } from '../../../../lib/services/import-match';
export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    const {user,program}=await requireProgramContext();
    if(typeof body.sourceUrl!=='string')return Response.json({error:'Match URL is required.'},{status:400});
    const f=await fetchEvidenceUrl(body.sourceUrl);
    const result=await importMatchBytes({programId:program.programId,seasonId:program.seasonId,bytes:f.bytes,sourceUrl:f.url,fileName:new URL(f.url).pathname.split('/').pop()||'match.html',contentType:f.contentType,actorEmail:user.email,ourTeamNames:[program.schoolAbbreviation,program.teamName]});
    return Response.json({result});
  }catch(e){const m=e instanceof Error?e.message:'Match import failed.';return Response.json({error:m},{status:m==='UNAUTHENTICATED'?401:m==='PROGRAM_SETUP_REQUIRED'?409:400});}
}
