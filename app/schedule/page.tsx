import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUserFromHeaders } from '../../lib/auth/current-user';
import { getActiveProgramForUser } from '../../db/repositories/programs';
import { listMatches } from '../../db/repositories/schedule';
import { AppShell } from '../../components/app-shell';
import { UrlImportForm } from '../../components/url-import-form';

export default async function SchedulePage() {
  const h = await headers();
  const user = getCurrentUserFromHeaders(h);
  if (!user) redirect('/setup');
  const program = await getActiveProgramForUser(user.email);
  if (!program) redirect('/setup');
  const matches = await listMatches(program.programId, program.seasonId);

  return <AppShell program={program} current="Schedule">
    <div className="page-head"><div>
      <span className="eyebrow">Setup · Step 3</span>
      <h1>Schedule</h1>
      <p>The official schedule becomes the season spine. Refreshes surface meaningful changes instead of silently rewriting history.</p>
    </div></div>
    <section className="panel">
      <UrlImportForm kind="Schedule" endpoint="/api/schedule/import" placeholder="https://school.edu/sports/volleyball/schedule" buttonLabel={matches.length ? 'Refresh Schedule' : 'Import Schedule'} />
    </section>
    <section className="panel">
      <div className="section-head"><h2>{matches.length} matches</h2><a className="primary-button link-button" href="/matches">Go to Matches →</a></div>
      {matches.length ? <div className="schedule-list">{matches.map((match: any) => <article key={match.id}>
        <time>{new Date(match.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
        <div><strong>{match.opponentName}</strong><span>{match.homeAway}{match.location ? ` · ${match.location}` : ''}</span></div>
        <b>{match.result || 'Scheduled'}</b>
      </article>)}</div> : <div className="empty-panel"><h3>No schedule yet</h3><p>Import the official schedule URL. Multiple matches on the same date remain separate canonical matches.</p></div>}
    </section>
  </AppShell>;
}
