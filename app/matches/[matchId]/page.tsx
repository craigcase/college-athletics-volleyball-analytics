import { notFound,redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/server-current-user';
import { getActiveProgramForUser } from '../../../db/repositories/programs';
import { getMatchSummary } from '../../../db/repositories/analytics';
import { getAdminClient } from '../../../db/client';
import { assertNoError } from '../../../db/supabase-utils';
import { AppShell } from '../../../components/app-shell';
import { MatchSummary } from '../../../components/match-summary';
export default async function MatchPage({params}:{params:Promise<{matchId:string}>}){const user=await getCurrentUser();if(!user)redirect('/login');const p=await getActiveProgramForUser(user);if(!p)redirect('/setup');const {matchId}=await params;const owned=await getAdminClient().from('matches').select('id').eq('id',matchId).eq('program_id',p.programId).maybeSingle();assertNoError(owned.error,'Read match ownership');if(!owned.data)notFound();const summary=await getMatchSummary(matchId);if(!summary)notFound();return <AppShell program={p} current="Matches"><a className="back-link" href="/matches">← All Matches</a><MatchSummary summary={summary}/></AppShell>}
