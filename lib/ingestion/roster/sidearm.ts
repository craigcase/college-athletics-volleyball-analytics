export type RosterEvidence = {
  name: string;
  number?: string;
  officialPosition?: string;
  classYear?: string;
  height?: string;
  hometown?: string;
  previousSchool?: string;
  profileUrl?: string;
  imageUrl?: string;
  sourcePlayerId?: string;
};

const clean = (value: string | undefined) => value?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1];
const classText = (block: string, className: string) => clean(block.match(new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))?.[1]);
const classHref = (block: string, className: string) => block.match(new RegExp(`<a[^>]*class=["'][^"']*${className}[^"']*["'][^>]*href=["']([^"']+)["']`, 'i'))?.[1];

export function parseRosterHtml(html: string, sourceUrl: string): RosterEvidence[] {
  const blocks = [...html.matchAll(/<(article|li|div)\b([^>]*class=["'][^"']*sidearm-roster-player[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi)];
  return blocks.flatMap((match) => {
    const opening = `<${match[1]}${match[2]}>`;
    const block = `${opening}${match[3]}</${match[1]}>`;
    const name = classText(block, 'sidearm-roster-player-name') ?? clean(attr(opening, 'data-name'));
    if (!name) return [];
    const href = classHref(block, 'sidearm-roster-player-name-link') ?? block.match(/<[^>]*class=["'][^"']*sidearm-roster-player-name[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["']/i)?.[1] ?? block.match(/<a[^>]*href=["']([^"']*\/roster\/[^"']*)["']/i)?.[1];
    const result: RosterEvidence = { name };
    const number = classText(block, 'sidearm-roster-player-jersey-number') ?? clean(attr(opening, 'data-number')); if (number) result.number = number;
    const position = classText(block, 'sidearm-roster-player-position') ?? clean(attr(opening, 'data-position')); if (position) result.officialPosition = position;
    const year = classText(block, 'sidearm-roster-player-academic-year') ?? clean(attr(opening, 'data-class-year')); if (year) result.classYear = year;
    const height = classText(block, 'sidearm-roster-player-height'); if (height) result.height = height;
    const hometown = classText(block, 'sidearm-roster-player-hometown'); if (hometown) result.hometown = hometown;
    const previousSchool = classText(block, 'sidearm-roster-player-previous-school'); if (previousSchool) result.previousSchool = previousSchool;
    if (href) result.profileUrl = new URL(href, sourceUrl).toString();
    const playerId = attr(opening, 'data-player-id'); if (playerId) result.sourcePlayerId = playerId;
    const image = block.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1]; if (image) result.imageUrl = new URL(image, sourceUrl).toString();
    return [result];
  });
}
