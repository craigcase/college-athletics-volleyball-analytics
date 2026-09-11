import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth/server-current-user';
import { getActiveProgramForUser } from '../db/repositories/programs';
export default async function Home(){const user=await getCurrentUser();if(!user)redirect('/login');const program=await getActiveProgramForUser(user);redirect(program?'/matches':'/setup');}
