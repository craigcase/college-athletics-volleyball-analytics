import { createProgram, getActiveProgramForUser } from '../../../db/repositories/programs';
import { getCurrentUser } from '../../../lib/auth/server-current-user';
import { validateProgramSetup } from '../../../lib/program/validation';

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return Response.json({error:'Authentication required.'},{status:401});
  return Response.json({program:await getActiveProgramForUser(user)});
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user)return Response.json({error:'Authentication required.'},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body)return Response.json({error:'Invalid JSON body.'},{status:400});
  const validated=validateProgramSetup(body);
  if(validated.ok===false)return Response.json({error:'Program identity is incomplete.',details:validated.errors},{status:400});
  try{return Response.json({program:await createProgram(validated.value,user)},{status:201});}
  catch(e){if(e instanceof Error&&e.message==='ACTIVE_PROGRAM_EXISTS')return Response.json({error:'This account already has an active program.'},{status:409});throw e;}
}
