import { SignOutButton } from './sign-out-button';
import Link from 'next/link';
const nav=[['Roster','/roster',true],['Schedule','/schedule',true],['Matches','/matches',true],['Rotations','#',false],['Players','#',false],['Probability','#',false],['Scouting','#',false],["Coach's Edge",'/coaches-edge',true]] as const;
export function AppShell({children,program,current}:{children:React.ReactNode;program:{schoolAbbreviation:string;teamName:string;seasonYear:number;primaryColor:string;accentColor:string};current?:string}){
 return <div className="app-frame" style={{'--program-primary':program.primaryColor,'--program-accent':program.accentColor} as React.CSSProperties}>
  <aside className="sidebar"><div className="brand-lockup"><div className="brand-mark">{program.schoolAbbreviation.slice(0,4)}</div><div><strong>{program.schoolAbbreviation}</strong><span>{program.teamName}</span></div></div>
   <nav>{nav.map(([label,href,active])=>active?<Link key={label} className={`nav-link ${current===label?'is-current':''}`} href={href}>{label}</Link>:<span key={label} className="nav-link is-disabled" title="Foundation ready; module comes later">{label}<small>Later</small></span>)}</nav>
   <div className="sidebar-foot"><span>College Athletics Consulting</span><strong>FAST · EASY · EFFICIENT</strong></div>
  </aside>
  <div className="main-column"><header className="topbar"><div><span className="eyebrow">Volleyball Analytics</span><strong>{program.schoolAbbreviation} {program.teamName}</strong></div><div className="topbar-actions"><div className="season-pill">Season <b>{program.seasonYear}</b></div><SignOutButton/></div></header><main className="content">{children}</main></div>
 </div>
}
