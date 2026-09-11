import { requireProgramContext } from '../../../../lib/auth/program-context';
import { getAdminClient } from '../../../../db/client';
import { assertNoError } from '../../../../db/supabase-utils';
import { getStoredMetrics } from '../../../../db/repositories/analytics';
import { resolveCoachQuestion } from '../../../../lib/coaches-edge/resolve';
import { executeAnalyticsQuery } from '../../../../lib/coaches-edge/execute';
const formatPct=(v:number)=>`${(v*100).toFixed(1)}%`;

export async function POST(request:Request){
  try{
    const {program}=await requireProgramContext();
    const body=await request.json() as Record<string,unknown>;
    const matchId=String(body.matchId??''),question=String(body.question??'').trim();
    if(!matchId||!question)return Response.json({error:'Match and question are required.'},{status:400});
    const db=getAdminClient();
    const match=await db.from('matches').select('id,opponent_team_id').eq('id',matchId).eq('program_id',program.programId).maybeSingle();assertNoError(match.error,'Read Coach Edge match');
    if(!match.data)return Response.json({error:'Match not found.'},{status:404});
    let opponentName='Opponent';
    if((match.data as any).opponent_team_id){const team=await db.from('teams').select('canonical_name').eq('id',(match.data as any).opponent_team_id).maybeSingle();assertNoError(team.error,'Read Coach Edge opponent');opponentName=(team.data as any)?.canonical_name??opponentName;}
    const resolved=resolveCoachQuestion(question,{matchId,opponentNames:[opponentName]});
    const scope=`${program.seasonYear} • ${opponentName}`;
    if(resolved.status!=='resolved')return Response.json({status:resolved.status,message:resolved.reason,scope});
    const metrics=await getStoredMetrics(matchId);const answer=executeAnalyticsQuery(resolved.query,metrics);
    if(answer.status!=='answered')return Response.json({status:'insufficient_evidence',answer:'The stored evidence does not support that answer yet.',scope,evidence:answer.evidence});
    let text='Stored match evidence is available.';
    if(resolved.query.intent==='compare_metric'&&resolved.query.metric==='hitting_percentage'&&answer.numbers.length===2)text=`We hit ${formatPct(answer.numbers[0])}; ${opponentName} hit ${formatPct(answer.numbers[1])}.`;
    return Response.json({status:'answered',answer:text,scope,confidence:'Evidence-backed • deterministic stored metric',evidence:answer.evidence});
  }catch(e){const m=e instanceof Error?e.message:"Coach's Edge query failed.";return Response.json({error:m},{status:m==='UNAUTHENTICATED'?401:m==='PROGRAM_SETUP_REQUIRED'?409:400});}
}
