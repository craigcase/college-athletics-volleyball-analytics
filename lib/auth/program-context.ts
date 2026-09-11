import { getActiveProgramForUser } from '../../db/repositories/programs';
import { requireCurrentUser } from './server-current-user';

export async function requireProgramContext() {
  const user = await requireCurrentUser();
  const program = await getActiveProgramForUser(user);
  if (!program) throw new Error('PROGRAM_SETUP_REQUIRED');
  return { user, program };
}
