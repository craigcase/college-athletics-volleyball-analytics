import { createClient } from '../supabase/server';
import { publicSupabaseConfigured } from '../supabase/config';
import { getCurrentUserFromSupabase, type CurrentUser } from './current-user';

export async function getCurrentUser():Promise<CurrentUser|null>{
  if(!publicSupabaseConfigured())return null;
  const supabase=await createClient();
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)return null;
  return getCurrentUserFromSupabase(user);
}
export async function requireCurrentUser():Promise<CurrentUser>{const user=await getCurrentUser();if(!user)throw new Error('UNAUTHENTICATED');return user;}
