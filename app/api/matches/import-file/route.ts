import { requireProgramContext } from '../../../../lib/auth/program-context';
import { validateUpload } from '../../../../lib/validation/upload';
import { importMatchBytes } from '../../../../lib/services/import-match';
export async function POST(request:Request){
  try{
    const {user,program}=await requireProgramContext();
    const form=await request.formData();
    const files=form.getAll('files').filter((v):v is File=>v instanceof File);
    if(!files.length)return Response.json({error:'Choose at least one file.'},{status:400});
    const results=[];
    for(const file of files){
      const validation=validateUpload(file);
      if(!validation.ok){results.push({file:file.name,status:'rejected',error:validation.reason});continue;}
      const bytes=new Uint8Array(await file.arrayBuffer());
      const result=await importMatchBytes({programId:program.programId,seasonId:program.seasonId,bytes,fileName:file.name,contentType:file.type,actorEmail:user.email,ourTeamNames:[program.schoolAbbreviation,program.teamName]});
      results.push({file:file.name,...result});
    }
    return Response.json({results});
  }catch(e){const m=e instanceof Error?e.message:'File import failed.';return Response.json({error:m},{status:m==='UNAUTHENTICATED'?401:m==='PROGRAM_SETUP_REQUIRED'?409:400});}
}
