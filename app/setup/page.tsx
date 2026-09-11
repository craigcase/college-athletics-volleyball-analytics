import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth/server-current-user';
import { getActiveProgramForUser } from '../../db/repositories/programs';
import { ProgramSetupForm } from '../../components/program-setup-form';
export default async function SetupPage(){const user=await getCurrentUser();if(!user)redirect('/login');if(await getActiveProgramForUser(user))redirect('/matches');return <main className="setup-page"><section className="setup-copy"><span className="eyebrow">College Athletics Consulting</span><h1>Build your volleyball intelligence foundation.</h1><p>Set the program identity once. Next, connect the official roster and schedule. Match evidence can be added whenever you have it.</p><div className="principles"><b>FAST.</b><b>EASY.</b><b>EFFICIENT.</b></div></section><section className="setup-card"><div className="step-kicker">Step 1 of 3 · Program Identity</div><ProgramSetupForm/></section></main>}
