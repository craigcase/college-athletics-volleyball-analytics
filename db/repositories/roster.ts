import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import type { RosterEvidence } from '../../lib/ingestion/roster/sidearm';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isNumberName = (value: string) => /^\d+$/.test(value.trim());
type PlayerRow = { id: string; canonical_name: string; profile_url?: string | null };

export async function upsertRosterEvidence(input: {
  programId: string;
  seasonId: string;
  teamId: string;
  players: RosterEvidence[];
  sourceFamily: string;
  actorEmail: string;
  sourceArtifactId: string;
}) {
  const db = getDb();
  const now = nowIso();
  let created = 0;
  let updated = 0;
  let needsReview = 0;

  for (const player of input.players) {
    let playerId: string | undefined;
    let matchedPlayer: PlayerRow | undefined;

    if (player.sourcePlayerId) {
      matchedPlayer =
        (await db
          .prepare(
            `SELECT p.id,p.canonical_name,ps.profile_url
             FROM player_aliases pa
             JOIN players p ON p.id=pa.player_id
             JOIN player_seasons ps ON ps.player_id=p.id
             WHERE pa.source_external_id=? AND ps.program_id=?
             LIMIT 1`,
          )
          .bind(player.sourcePlayerId, input.programId)
          .first<PlayerRow>()) ?? undefined;
      playerId = matchedPlayer?.id;
    }

    // V1's Sidearm adapter stored jersey numbers as names. Limit repair to a
    // unique numeric-name row in this season so staff-corrected names remain canonical.
    if (!playerId && player.number) {
      const candidates = await db
        .prepare(
          `SELECT p.id,p.canonical_name,ps.profile_url
           FROM players p
           JOIN player_seasons ps ON ps.player_id=p.id
           WHERE ps.program_id=? AND ps.season_id=? AND ps.jersey_number=?
             AND p.canonical_name GLOB '[0-9]*'`,
        )
        .bind(input.programId, input.seasonId, player.number)
        .all<PlayerRow>();
      const repairable = (candidates.results ?? []).filter(
        (candidate) =>
          isNumberName(candidate.canonical_name) &&
          (candidate.canonical_name === player.number ||
            (!!candidate.profile_url && !!player.profileUrl && candidate.profile_url === player.profileUrl)),
      );
      if (repairable.length === 1) {
        matchedPlayer = repairable[0];
        playerId = matchedPlayer.id;
      }
    }

    if (!playerId) {
      const rows = await db
        .prepare(
          `SELECT p.id,p.canonical_name
           FROM players p
           JOIN player_seasons ps ON ps.player_id=p.id
           WHERE ps.program_id=?`,
        )
        .bind(input.programId)
        .all<PlayerRow>();
      const matches = (rows.results ?? []).filter((row) => normalize(row.canonical_name) === normalize(player.name));
      if (matches.length === 1) {
        matchedPlayer = matches[0];
        playerId = matchedPlayer.id;
      } else if (matches.length > 1) {
        needsReview++;
        await db
          .prepare(
            `INSERT INTO reconciliation_issues
             (id,program_id,issue_type,entity_type,details_json,status,created_at)
             VALUES(?,?,?,?,?,'open',?)`,
          )
          .bind(
            id('issue'),
            input.programId,
            'ambiguous_player_identity',
            'player',
            JSON.stringify({ sourceName: player.name, candidates: matches.map((row) => row.id) }),
            now,
          )
          .run();
        continue;
      }
    }

    if (!playerId) {
      playerId = id('player');
      created++;
      await db.batch([
        db.prepare('INSERT INTO players(id,canonical_name,created_at) VALUES(?,?,?)').bind(playerId, player.name, now),
        db
          .prepare(
            'INSERT INTO player_aliases(id,player_id,alias,source_family,source_external_id,created_at) VALUES(?,?,?,?,?,?)',
          )
          .bind(id('playeralias'), playerId, player.name, input.sourceFamily, player.sourcePlayerId ?? null, now),
      ]);
    } else {
      updated++;
      const current =
        matchedPlayer ?? (await db.prepare('SELECT id,canonical_name FROM players WHERE id=?').bind(playerId).first<PlayerRow>());
      if (current && isNumberName(current.canonical_name)) {
        await db.prepare('UPDATE players SET canonical_name=? WHERE id=?').bind(player.name, playerId).run();
      }
      await db
        .prepare(
          'INSERT OR IGNORE INTO player_aliases(id,player_id,alias,source_family,source_external_id,created_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(id('playeralias'), playerId, player.name, input.sourceFamily, player.sourcePlayerId ?? null, now)
        .run();
    }

    const season = await db
      .prepare('SELECT id FROM player_seasons WHERE player_id=? AND season_id=?')
      .bind(playerId, input.seasonId)
      .first<{ id: string }>();
    const playerSeasonId = season?.id ?? id('playerseason');
    if (season) {
      const overrides = await db.prepare(`SELECT field_name FROM canonical_overrides
        WHERE program_id=? AND entity_type='player_season' AND entity_id=?`)
        .bind(input.programId,season.id).all<{field_name:string}>();
      const protectedFields = new Set((overrides.results ?? []).map(row => row.field_name));
      const currentSeason = await db.prepare('SELECT * FROM player_seasons WHERE id=?').bind(season.id).first<Record<string,unknown>>();
      const canonical = (field:string,column:string,value:string|undefined) =>
        protectedFields.has(field) || protectedFields.has(column) ? currentSeason?.[column] ?? null : value ?? null;
      await db
        .prepare(
          `UPDATE player_seasons
           SET jersey_number=?,official_position=?,class_year=?,height=?,hometown=?,previous_school=?,
               profile_url=COALESCE(profile_url,?),image_url=COALESCE(image_url,?),source_player_id=COALESCE(source_player_id,?)
           WHERE id=?`,
        )
        .bind(
          canonical('number','jersey_number',player.number),
          canonical('officialPosition','official_position',player.officialPosition),
          canonical('classYear','class_year',player.classYear),
          canonical('height','height',player.height),
          canonical('hometown','hometown',player.hometown),
          canonical('previousSchool','previous_school',player.previousSchool),
          canonical('profileUrl','profile_url',player.profileUrl),
          canonical('imageUrl','image_url',player.imageUrl),
          canonical('sourcePlayerId','source_player_id',player.sourcePlayerId),
          season.id,
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO player_seasons
           (id,player_id,program_id,season_id,team_id,jersey_number,official_position,class_year,height,hometown,previous_school,profile_url,image_url,source_player_id,created_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          playerSeasonId,
          playerId,
          input.programId,
          input.seasonId,
          input.teamId,
          player.number ?? null,
          player.officialPosition ?? null,
          player.classYear ?? null,
          player.height ?? null,
          player.hometown ?? null,
          player.previousSchool ?? null,
          player.profileUrl ?? null,
          player.imageUrl ?? null,
          player.sourcePlayerId ?? null,
          now,
        )
        .run();
    }
    const fields = { name: player.name, number: player.number, officialPosition: player.officialPosition,
      classYear: player.classYear, height: player.height, hometown: player.hometown,
      previousSchool: player.previousSchool, profileUrl: player.profileUrl,
      imageUrl: player.imageUrl, sourcePlayerId: player.sourcePlayerId };
    await db.batch(Object.entries(fields).filter(([,value]) => value !== undefined).map(([field,value]) =>
      db.prepare(`INSERT INTO evidence_observations
        (id,program_id,source_artifact_id,entity_type,entity_id,source_entity_key,field_name,value_json,source_confidence,observed_at)
        SELECT ?,?,?,'player_season',?,?,?,?,0.9,?
        WHERE NOT EXISTS (SELECT 1 FROM evidence_observations WHERE source_artifact_id=? AND entity_type='player_season' AND entity_id=? AND field_name=?)`)
        .bind(id('observation'),input.programId,input.sourceArtifactId,playerSeasonId,player.sourcePlayerId??null,
          field,JSON.stringify(value),now,input.sourceArtifactId,playerSeasonId,field)));
  }

  await db
    .prepare(
      'INSERT INTO activity_events(id,program_id,actor_email,action,entity_type,details_json,created_at) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      id('activity'),
      input.programId,
      input.actorEmail,
      'roster.imported',
      'roster',
      JSON.stringify({ created, updated, needsReview }),
      now,
    )
    .run();
  return { created, updated, needsReview, total: input.players.length };
}

export async function listRoster(programId: string, seasonId: string) {
  const output = await getDb()
    .prepare(
      `SELECT p.id,p.canonical_name name,ps.jersey_number number,ps.official_position officialPosition,
              ps.class_year classYear,ps.height,ps.hometown,ps.previous_school previousSchool,ps.image_url imageUrl
       FROM player_seasons ps
       JOIN players p ON p.id=ps.player_id
       WHERE ps.program_id=? AND ps.season_id=? AND ps.active=1
       ORDER BY CASE WHEN ps.jersey_number GLOB '[0-9]*' THEN CAST(ps.jersey_number AS INTEGER) ELSE 999 END,p.canonical_name`,
    )
    .bind(programId, seasonId)
    .all();
  return output.results ?? [];
}
