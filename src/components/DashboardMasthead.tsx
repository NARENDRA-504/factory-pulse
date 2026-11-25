import React from 'react';
import { ArrowUpRight, Cpu, Factory, ShieldCheck, Users, Wrench, RefreshCw } from 'lucide-react';
import type { Incident, Machine, MaintenanceWorkOrder, UserProfile } from '../types';
import { reportMachineScope } from '../utils/roleReportData';

type Screen='dashboard'|'machines'|'incidents'|'analytics'|'users'|'activity'|'inventory'|'maintenance';
const designs={
 Operator:{icon:Cpu,accent:'#14877d',soft:'#eaf7f3',label:'WORKSTATION',action:'Report an issue',target:'incidents' as Screen,focus:'Production, quality and the condition of your assigned station.'},
 Supervisor:{icon:Users,accent:'#ad711a',soft:'#fff6e5',label:'SHIFT COORDINATION',action:'Prioritize incidents',target:'incidents' as Screen,focus:'Find the bottleneck. Assign a response. Keep the shift moving.'},
 Maintenance:{icon:Wrench,accent:'#7750ad',soft:'#f4effb',label:'RELIABILITY DESK',action:'Open work queue',target:'maintenance' as Screen,focus:'Investigate the evidence and progress the next repair.'},
 Manager:{icon:Factory,accent:'#3466ac',soft:'#edf3fc',label:'PLANT PERFORMANCE',action:'Review analytics',target:'analytics' as Screen,focus:'Compare performance and focus on operational decisions.'},
 Admin:{icon:ShieldCheck,accent:'#237c90',soft:'#eaf5f8',label:'PLATFORM GOVERNANCE',action:'Manage access',target:'users' as Screen,focus:'Account access, machine coverage and traceable operations.'},
 'Super Admin':{icon:ShieldCheck,accent:'#237c90',soft:'#eaf5f8',label:'PLATFORM GOVERNANCE',action:'Manage access',target:'users' as Screen,focus:'Account access, machine coverage and traceable operations.'},
};

export function DashboardMasthead({user,machines,incidents,workOrders,title,onNavigate,onRefresh}:{
 user:UserProfile;machines:Machine[];incidents:Incident[];workOrders:MaintenanceWorkOrder[];title:string;
 onNavigate:(screen:Screen)=>void;onRefresh?:()=>void;
}){
 const design=designs[user.role],Icon=design.icon;
 const scoped=reportMachineScope(user,machines);
 const codes=new Set(scoped.flatMap(m=>[m.machineCode,m.code]).filter(Boolean));
 const open=incidents.filter(i=>codes.has(i.machineCode)&&i.status!=='Closed');
 const orders=workOrders.filter(w=>codes.has(w.machineCode)&&w.status!=='Completed');
 const facts=user.role==='Operator'?
  [['Assigned station',user.assignedMachine||'Not assigned'],['Open incidents',open.length],['Shift',user.shift||'Not recorded']]:
  user.role==='Maintenance'?
  [['Machines in scope',scoped.length],['Open incidents',open.length],['Open work orders',orders.length]]:
  [['Machines in scope',scoped.length],['Open incidents',open.length],['Plants in scope',new Set(scoped.map(m=>m.plant).filter(Boolean)).size]];
 return <header className="fp-dashboard-masthead" style={{'--role-accent':design.accent,'--role-soft':design.soft} as React.CSSProperties}>
  <div className="fp-masthead-heading"><div className="fp-role-mark"><Icon size={23}/></div><div className="min-w-0"><p className="fp-eyebrow">{design.label} <span> / {user.role}</span></p><h1>{title}</h1><p className="fp-masthead-description">{design.focus}</p></div></div>
  <div className="fp-masthead-actions">{onRefresh&&<button aria-label="Refresh operations data" className="fp-refresh-button" onClick={onRefresh}><RefreshCw size={15}/><span>Refresh</span></button>}<button className="fp-primary-action" onClick={()=>onNavigate(design.target)}>{design.action}<ArrowUpRight size={16}/></button></div>
  <dl className="fp-scope-strip">{facts.map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{typeof value==='number'?value.toLocaleString():value}</dd></div>)}</dl>
 </header>;
}
