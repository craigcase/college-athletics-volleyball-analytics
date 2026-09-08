export type ScheduleEvidence = {
  date: string;
  opponentName: string;
  homeAway: 'home' | 'away' | 'neutral' | 'unknown';
  location?: string;
  result?: string;
  setScores?: string[];
  sourceMatchId?: string;
  boxScoreUrl?: string;
};

const attrs = (tag: string) => { const result: Record<string,string>={}; for(const m of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) result[m[1].toLowerCase()]=m[2]; return result; };
const clean=(s:string|undefined)=>s?.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()||undefined;
const classText=(block:string,name:string)=>clean(block.match(new RegExp(`<[^>]*class=["'][^"']*${name}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,'i'))?.[1]);

export function parseScheduleHtml(html:string,sourceUrl:string):ScheduleEvidence[]{
  const blocks=[...html.matchAll(/<li\b([^>]*class=["'][^"']*sidearm-schedule-game[^"']*["'][^>]*)>([\s\S]*?)<\/li>/gi)];
  return blocks.flatMap((m)=>{
    const opening=`<li${m[1]}>`, body=m[2], block=`${opening}${body}</li>`, a=attrs(opening);
    const timeTag=block.match(/<time\b[^>]*>/i)?.[0];
    const date=a['data-date'] ?? (timeTag?attrs(timeTag).datetime:undefined);
    const opponent=a['data-opponent'] ?? classText(block,'sidearm-schedule-game-opponent-name') ?? classText(block,'sidearm-schedule-game-opponent-text');
    if(!date||!opponent)return [];
    const neutral=a['data-neutral']==='true' || /neutral/i.test(classText(block,'sidearm-schedule-game-location')??'') && /neutral/i.test(a['data-home-away']??'');
    const explicit=a['data-home-away'];
    const homeAway:ScheduleEvidence['homeAway']=neutral?'neutral':explicit==='home'||explicit==='away'||explicit==='neutral'?explicit:'unknown';
    const item:ScheduleEvidence={date,opponentName:opponent,homeAway};
    const location=a['data-location']??classText(block,'sidearm-schedule-game-location'); if(location)item.location=location;
    const result=a['data-result']??classText(block,'sidearm-schedule-game-result'); if(result)item.result=result;
    if(a['data-set-scores'])item.setScores=a['data-set-scores'].split('|').map(s=>s.trim()).filter(Boolean);
    if(a['data-match-id'])item.sourceMatchId=a['data-match-id'];
    const boxHref=a['data-boxscore-url'] ?? block.match(/<a[^>]*(?:class=["'][^"']*(?:boxscore|box-score)[^"']*["'][^>]*)href=["']([^"']+)["']/i)?.[1] ?? block.match(/<a[^>]*href=["']([^"']*\/boxscore\/[^"']*)["']/i)?.[1];
    if(boxHref)item.boxScoreUrl=new URL(boxHref,sourceUrl).toString();
    return [item];
  });
}
