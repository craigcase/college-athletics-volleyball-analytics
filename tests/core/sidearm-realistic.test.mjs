import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterHtml } from '../../.core-dist/lib/ingestion/roster/sidearm.js';
import { parseScheduleHtml } from '../../.core-dist/lib/ingestion/schedule/sidearm.js';

test('roster adapter reads common nested Sidearm markup and profile href', () => {
  const html=`<li class="sidearm-roster-player"><div class="sidearm-roster-player-name"><h3><a href="/sports/womens-volleyball/roster/ava-geist/123">Ava Geist</a></h3></div><span class="sidearm-roster-player-jersey-number">7</span><span class="sidearm-roster-player-position">OH</span><span class="sidearm-roster-player-academic-year">So.</span></li>`;
  const rows=parseRosterHtml(html,'https://example.edu/sports/womens-volleyball/roster');
  assert.equal(rows[0].name,'Ava Geist');
  assert.equal(rows[0].profileUrl,'https://example.edu/sports/womens-volleyball/roster/ava-geist/123');
});

test('schedule adapter reads common nested Sidearm markup with ISO datetime when explicit data attributes are absent', () => {
  const html=`<li class="sidearm-schedule-game"><time datetime="2026-09-05T19:00:00-05:00">Sep 5</time><div class="sidearm-schedule-game-opponent-name"><a href="/sports/womens-volleyball/opponent/mayville-state/12">Mayville State</a></div><div class="sidearm-schedule-game-location">Valley City, ND</div><div class="sidearm-schedule-game-result">W, 3-1</div><a class="sidearm-schedule-game-boxscore" href="/sports/womens-volleyball/stats/2026/mayville/boxscore/42">Box Score</a></li>`;
  const rows=parseScheduleHtml(html,'https://example.edu/sports/womens-volleyball/schedule/2026');
  assert.equal(rows.length,1);
  assert.equal(rows[0].date,'2026-09-05T19:00:00-05:00');
  assert.equal(rows[0].opponentName,'Mayville State');
  assert.equal(rows[0].location,'Valley City, ND');
  assert.equal(rows[0].result,'W, 3-1');
  assert.equal(rows[0].boxScoreUrl,'https://example.edu/sports/womens-volleyball/stats/2026/mayville/boxscore/42');
});

import { parsePublicBoxScoreHtml } from '../../.core-dist/lib/ingestion/match/public-boxscore.js';

test('public box score adapter reads Sidearm-style team total rows without source-specific data attributes', () => {
  const html=`
    <html><head><title>Volleyball vs Viterbo on 8/22/2026 - Box Score - Mayville State University Athletics</title></head><body>
      <h2>Game Statistics By Set</h2>
      <table>
        <tr><th>Set</th><th colspan="4">Mayville State</th><th colspan="4">Viterbo</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>1</td><td>10</td><td>9</td><td>35</td><td>.029</td><td>13</td><td>6</td><td>32</td><td>.219</td></tr>
        <tr><td>Total</td><td>27</td><td>27</td><td>112</td><td>.000</td><td>36</td><td>11</td><td>98</td><td>.255</td></tr>
      </table>
      <h2>Team Statistical Comparison</h2>
      <table>
        <tr><th></th><th>Mayville State</th><th>Viterbo</th></tr>
        <tr><td>Kills</td><td>27</td><td>36</td></tr>
        <tr><td>Aces</td><td>4</td><td>7</td></tr>
        <tr><td>Service Errors</td><td>6</td><td>9</td></tr>
        <tr><td>Blocks</td><td>2</td><td>8</td></tr>
        <tr><td>Assists</td><td>25</td><td>35</td></tr>
        <tr><td>Digs</td><td>45</td><td>49</td></tr>
      </table>
    </body></html>`;
  const evidence=parsePublicBoxScoreHtml(html,'https://msucomets.com/boxscore/5422',{ourTeamNames:['Mayville State','MSU']});
  assert.equal(evidence.match.date,'2026-08-22');
  assert.equal(evidence.match.opponentName,'Viterbo');
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='kills')?.value,27);
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='attack_errors')?.value,27);
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='attack_attempts')?.value,112);
  assert.equal(evidence.observations.find(o=>o.entityKey==='opponent'&&o.field==='attack_attempts')?.value,98);
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='aces')?.value,4);
  assert.equal(evidence.observations.find(o=>o.entityKey==='opponent'&&o.field==='digs')?.value,49);
});
