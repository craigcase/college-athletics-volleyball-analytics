import { getActiveProgramForUser } from '../../db/repositories/programs.js';
import { requireCurrentUser } from './current-user.js';
export async function requireProgramContext(headers:Headers){
  const user=requireCurrentUser(headers);
  const program=await getActiveProgramForUser(user.email);
  if(!program) throw new Error('PROGRAM_SETUP_REQUIRED');
  return {user,program};
}
