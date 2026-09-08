import { getDb } from '../client';
import { id, nowIso } from '../../lib/ids';
import type { CurrentUser } from '../../lib/auth/current-user';
import type { ProgramSetupInput } from '../../lib/program/validation';

export type ProgramContext = {
  programId: string; seasonId: string; seasonYear: number; teamId: string;
  schoolAbbreviation: string; teamName: string; primaryColor: string; secondaryColor: string; accentColor: string;
  role: 'owner'|'staff'|'player';
};

export async function getActiveProgramForUser(email: string): Promise<ProgramContext | null> {
  const row = await getDb().prepare(`SELECT p.id programId,p.team_id teamId,p.school_abbreviation schoolAbbreviation,p.team_name teamName,p.primary_color primaryColor,p.secondary_color secondaryColor,p.accent_color accentColor,s.id seasonId,s.year seasonYear,m.role role FROM program_memberships m JOIN programs p ON p.id=m.program_id JOIN seasons s ON s.program_id=p.id AND s.is_current=1 WHERE lower(m.user_email)=lower(?) AND m.is_active=1 AND p.archived_at IS NULL ORDER BY s.year DESC LIMIT 1`).bind(email).first<ProgramContext>();
  return row ?? null;
}

export async function createProgram(input: ProgramSetupInput, user: CurrentUser): Promise<ProgramContext> {
  const db = getDb();
  const existing = await getActiveProgramForUser(user.email);
  if (existing) throw new Error('ACTIVE_PROGRAM_EXISTS');
  const teamId=id('team'), programId=id('program'), seasonId=id('season'), membershipId=id('membership'), aliasId=id('teamalias'), teamSeasonId=id('teamseason'), activityId=id('activity');
  const now=nowIso();
  await db.batch([
    db.prepare('INSERT INTO teams(id,canonical_name,created_at) VALUES(?,?,?)').bind(teamId,input.teamName,now),
    db.prepare('INSERT INTO team_aliases(id,team_id,alias,source_family,created_at) VALUES(?,?,?,?,?)').bind(aliasId,teamId,input.teamName,'program_setup',now),
    db.prepare('INSERT INTO team_seasons(id,team_id,season_year,created_at) VALUES(?,?,?,?)').bind(teamSeasonId,teamId,input.seasonYear,now),
    db.prepare('INSERT INTO programs(id,team_id,school_abbreviation,team_name,primary_color,secondary_color,accent_color,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(programId,teamId,input.schoolAbbreviation,input.teamName,input.primaryColor,input.secondaryColor,input.accentColor,now),
    db.prepare('INSERT INTO seasons(id,program_id,label,year,is_current,created_at) VALUES(?,?,?,?,1,?)').bind(seasonId,programId,String(input.seasonYear),input.seasonYear,now),
    db.prepare("INSERT INTO program_memberships(id,program_id,user_email,user_external_id,role,created_at) VALUES(?,?,?,?, 'owner',?)").bind(membershipId,programId,user.email,user.id ?? null,now),
    db.prepare('INSERT INTO activity_events(id,program_id,actor_email,action,entity_type,entity_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(activityId,programId,user.email,'program.created','program',programId,now),
  ]);
  return { programId, seasonId, seasonYear:input.seasonYear, teamId, schoolAbbreviation:input.schoolAbbreviation, teamName:input.teamName, primaryColor:input.primaryColor, secondaryColor:input.secondaryColor, accentColor:input.accentColor, role:'owner' };
}
