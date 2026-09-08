export type ProgramSetupInput = {
  schoolAbbreviation: string;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  seasonYear: number;
};
export type ProgramValidation = { ok: true; value: ProgramSetupInput } | { ok: false; errors: string[] };
const HEX = /^#[0-9a-f]{6}$/i;

export function validateProgramSetup(input: ProgramSetupInput): ProgramValidation {
  const errors: string[] = [];
  const schoolAbbreviation = input.schoolAbbreviation.trim().toUpperCase();
  const teamName = input.teamName.trim();
  if (!schoolAbbreviation || schoolAbbreviation.length > 12) errors.push('School abbreviation is required and must be 12 characters or fewer.');
  if (!teamName || teamName.length > 80) errors.push('Mascot / team name is required and must be 80 characters or fewer.');
  for (const [label, value] of [['Primary',input.primaryColor],['Secondary',input.secondaryColor],['Accent',input.accentColor]] as const) if (!HEX.test(value)) errors.push(`${label} color must be a six-digit hex color.`);
  if (!Number.isInteger(input.seasonYear) || input.seasonYear < 2000 || input.seasonYear > 2100) errors.push('Season year is invalid.');
  if (errors.length) return { ok:false, errors };
  return { ok:true, value:{ ...input, schoolAbbreviation, teamName } };
}
