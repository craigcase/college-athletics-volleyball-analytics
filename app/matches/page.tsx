import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUserFromHeaders } from '../../lib/auth/current-user';
import { getActiveProgramForUser } from '../../db/repositories/programs';
import { listMatches } from '../../db/repositories/schedule';
import { AppShell } from '../../components/app-shell';
import { MatchImportDrawer } from '../../components/match-import-drawer';

export default async function MatchesPage() {
  const h = await headers();
  const user = getCurrentUserFromHeaders(h);
  if (!user) redirect('/setup');
  const program = await getActiveProgramForUser(user.email);
  if (!program) redirect('/setup');
  const matches = await listMatches(program.programId, program.seasonId);

  return <AppShell program={program} current="Matches">
    <div className="page-head">
      <div><span className="eyebrow">Season spine</span><h1>Matches</h1><p>Every source enriches one canonical match. Basic data is useful; richer evidence simply unlocks deeper capabilities.</p></div>
      <MatchImportDrawer />
    </div>
    {matches.length ? <section className="match-list">{matches.map((m: any) => <a className="match-row" href={`/matches/${m.id}`} key={m.id} aria-label={`View summary for ${m.opponentName}`}>
      <time><span>{new Date(m.scheduledAt).toLocaleDateString(undefined, { month: 'short' })}</span><b>{new Date(m.scheduledAt).getDate()}</b></time>
      <div className="match-opponent"><span>{m.homeAway}</span><strong>{m.opponentName}</strong><small>{m.location || 'Location not supplied'}</small></div>
      <div className="match-result"><strong>{m.result || '—'}</strong><span className={`data-badge ${String(m.dataStatus).toLowerCase().replaceAll(' ', '-')}`}>{m.dataStatus}</span></div>
      <span className="match-open">View Summary <span aria-hidden="true">→</span></span>
    </a>)}</section> : <section className="empty-hero"><div className="empty-icon">↗</div><h2>Your season spine starts with the schedule.</h2><p>Import the official schedule, then add match evidence as matches are played.</p><a className="primary-button link-button" href="/schedule">Import Schedule</a></section>}
  </AppShell>;
}
