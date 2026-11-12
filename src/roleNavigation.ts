import { UserRole } from './types';
export type AppScreen = 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory' | 'maintenance' | 'production' | 'coverage' | 'downtime' | 'quality' | 'reports' | 'machine-changes' | 'readiness';
export type NavItem = { screen: AppScreen; label: string };
export const roleOperations: Record<UserRole, NavItem[]> = {
 Operator: [{screen:'machine-changes',label:'Request Machine Change'},{screen:'dashboard',label:'My Production'},{screen:'machines',label:'Machine Readings'},{screen:'incidents',label:'Report an Incident'}],
 Supervisor: [{screen:'machine-changes',label:'Machine Change Approvals'},{screen:'dashboard',label:'My Machines'},{screen:'production',label:'Production & Operators'},{screen:'machines',label:'Machine Health'},{screen:'reports',label:'Line Reports'}],
 Manager: [{screen:'downtime',label:'Downtime Overview'},{screen:'production',label:'Production Comparisons'},{screen:'coverage',label:'Team & Assignments'},{screen:'dashboard',label:'Output & Production Rate'},{screen:'quality',label:'Part Quality'},{screen:'machines',label:'Machine Health'}],
 Maintenance: [{screen:'dashboard',label:'Work Overview'},{screen:'maintenance',label:'Assigned Work'},{screen:'machines',label:'Equipment Diagnostics'},{screen:'incidents',label:'Active Faults'},{screen:'reports',label:'Work History'}],
 'Super Admin': [{screen:'dashboard',label:'System Governance'},{screen:'users',label:'Users & Administrators'},{screen:'inventory',label:'Machine Management'},{screen:'machine-changes',label:'Machine Change Oversight'},{screen:'incidents',label:'Incident Oversight'},{screen:'activity',label:'Activity Log'}],
 Admin: [{screen:'machine-changes',label:'Machine Change Requests'},{screen:'dashboard',label:'System Overview'},{screen:'users',label:'People & Role Access'},{screen:'inventory',label:'Machine Management'},{screen:'incidents',label:'Incident Oversight'},{screen:'activity',label:'Activity Log'}],
};
export function supportingNavigation(role: UserRole): NavItem[] {
 const readiness:NavItem={screen:"readiness",label:"Pipeline & Health"};
 if(role==='Super Admin') return [readiness,{screen:'machines',label:'Machine Diagnostics'},{screen:'maintenance',label:'All Work Orders'},{screen:'production',label:'Production'},{screen:'coverage',label:'Team & Assignments'},{screen:'downtime',label:'Downtime'},{screen:'quality',label:'Quality'},{screen:'reports',label:'Reports'},{screen:'analytics',label:'Analytics'}];
 if(role==='Supervisor'||role==='Manager') return [readiness,{screen:'incidents',label:'Incidents & Priorities'},{screen:'maintenance',label:'Work Orders'}];
 if(role==='Admin') return [readiness,{screen:'machines',label:'Machine Diagnostics'},{screen:'maintenance',label:'Work Orders'}];
 return [readiness];
}
export const canOpenScreen = (role:UserRole, screen:AppScreen) => role==='Super Admin' || [...roleOperations[role],...supportingNavigation(role)].some(item=>item.screen===screen) || (screen==='analytics' && role!=='Operator');
