PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id),
  school_abbreviation TEXT NOT NULL,
  team_name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  year INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  starts_on TEXT,
  ends_on TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(program_id, year)
);

CREATE TABLE IF NOT EXISTS program_memberships (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_external_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner','staff','player')),
  display_title TEXT,
  player_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(program_id, user_email)
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_aliases (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  source_family TEXT,
  source_external_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(team_id, alias)
);

CREATE TABLE IF NOT EXISTS team_seasons (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  roster_url TEXT,
  schedule_url TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(team_id, season_year)
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_aliases (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  source_family TEXT,
  source_external_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(player_id, alias)
);

CREATE TABLE IF NOT EXISTS player_seasons (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  jersey_number TEXT,
  official_position TEXT,
  observed_role TEXT,
  class_year TEXT,
  height TEXT,
  hometown TEXT,
  previous_school TEXT,
  profile_url TEXT,
  image_url TEXT,
  source_player_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(player_id, season_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  our_team_id TEXT REFERENCES teams(id),
  opponent_team_id TEXT REFERENCES teams(id),
  scheduled_at TEXT NOT NULL,
  actual_started_at TEXT,
  home_away TEXT NOT NULL DEFAULT 'unknown' CHECK(home_away IN ('home','away','neutral','unknown')),
  competition TEXT NOT NULL DEFAULT 'unknown' CHECK(competition IN ('conference','nonconference','unknown')),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  result TEXT,
  set_scores_json TEXT,
  source_match_id TEXT,
  canonical_revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_season_date ON matches(season_id, scheduled_at);

CREATE TABLE IF NOT EXISTS match_sets (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  our_score INTEGER,
  opponent_score INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(match_id, set_number)
);

CREATE TABLE IF NOT EXISTS source_lineages (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  lineage_key TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(program_id, lineage_key)
);

CREATE TABLE IF NOT EXISTS source_artifacts (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  lineage_id TEXT REFERENCES source_lineages(id),
  source_family TEXT NOT NULL,
  source_url TEXT,
  original_filename TEXT,
  content_type TEXT,
  content_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  parser_version TEXT,
  imported_at TEXT NOT NULL,
  imported_by_email TEXT,
  UNIQUE(program_id, content_hash)
);

CREATE TABLE IF NOT EXISTS match_source_links (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  source_artifact_id TEXT NOT NULL REFERENCES source_artifacts(id) ON DELETE CASCADE,
  match_confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(match_id, source_artifact_id)
);

CREATE TABLE IF NOT EXISTS evidence_observations (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  source_artifact_id TEXT NOT NULL REFERENCES source_artifacts(id) ON DELETE CASCADE,
  match_id TEXT REFERENCES matches(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  source_entity_key TEXT,
  field_name TEXT NOT NULL,
  value_json TEXT NOT NULL,
  set_number INTEGER,
  rally_index INTEGER,
  source_confidence REAL NOT NULL DEFAULT 0.5,
  observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_observations_match ON evidence_observations(match_id, field_name);

CREATE TABLE IF NOT EXISTS canonical_overrides (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  canonical_value_json TEXT NOT NULL,
  reason TEXT,
  corrected_by_email TEXT NOT NULL,
  corrected_at TEXT NOT NULL,
  UNIQUE(program_id, entity_type, entity_id, field_name)
);

CREATE TABLE IF NOT EXISTS reconciliation_issues (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  source_artifact_id TEXT REFERENCES source_artifacts(id),
  details_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by_email TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_capabilities (
  match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  canonical_revision INTEGER NOT NULL,
  box_score_totals INTEGER NOT NULL DEFAULT 0,
  player_totals INTEGER NOT NULL DEFAULT 0,
  set_totals INTEGER NOT NULL DEFAULT 0,
  rally_sequence INTEGER NOT NULL DEFAULT 0,
  serve_receive_state INTEGER NOT NULL DEFAULT 0,
  rotation_state INTEGER NOT NULL DEFAULT 0,
  on_court_state INTEGER NOT NULL DEFAULT 0,
  contact_quality INTEGER NOT NULL DEFAULT 0,
  attack_origin INTEGER NOT NULL DEFAULT 0,
  attack_destination INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_team_totals (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_side TEXT NOT NULL CHECK(team_side IN ('our_team','opponent')),
  canonical_revision INTEGER NOT NULL,
  kills INTEGER,
  attack_errors INTEGER,
  attack_attempts INTEGER,
  assists INTEGER,
  aces INTEGER,
  service_errors INTEGER,
  digs INTEGER,
  blocks REAL,
  reception_errors INTEGER,
  updated_at TEXT NOT NULL,
  UNIQUE(match_id, team_side, canonical_revision)
);

CREATE TABLE IF NOT EXISTS player_match_totals (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  team_side TEXT NOT NULL CHECK(team_side IN ('our_team','opponent')),
  canonical_revision INTEGER NOT NULL,
  totals_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(match_id, player_id, canonical_revision)
);

CREATE TABLE IF NOT EXISTS match_metric_results (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  canonical_revision INTEGER NOT NULL,
  subject TEXT NOT NULL,
  metric_code TEXT NOT NULL,
  numerator REAL,
  denominator REAL,
  value REAL,
  status TEXT NOT NULL DEFAULT 'supported',
  engine_version TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  UNIQUE(match_id, canonical_revision, subject, metric_code)
);

CREATE TABLE IF NOT EXISTS match_findings (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  canonical_revision INTEGER NOT NULL,
  side TEXT NOT NULL,
  metric_code TEXT NOT NULL,
  direction TEXT NOT NULL,
  magnitude REAL NOT NULL,
  opportunities REAL,
  rank_score REAL NOT NULL,
  evidence_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);
