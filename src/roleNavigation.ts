import { UserRole } from './types';
export type AppScreen = 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory' | 'maintenance' | 'production' | 'coverage' | 'downtime' | 'quality' | 'reports';
export type NavItem = { screen: AppScreen; label: string };
export const roleOperations: Record<UserRole, NavItem[]> = {
 Operator: [{screen:'dashboard',label:'My Production'},{screen:'machines',label:'Machine Readings'},{screen:'incidents',label:'Report an Incident'}],
 Supervisor: [{screen:'dashboard',label:'My Machines'},{screen:'production',label:'Production & Operators'},{screen:'machines',label:'Machine Health'},{screen:'reports',label:'Line Reports'}],
 Manager: [{screen:'downtime',label:'Downtime Overview'},{screen:'production',label:'Production Comparisons'},{screen:'coverage',label:'Team & Assignments'},{screen:'dashboard',label:'Output & Production Rate'},{screen:'quality',label:'Part Quality'},{screen:'machines',label:'Machine Health'}],
 Maintenance: [{screen:'dashboard',label:'Work Overview'},{screen:'maintenance',label:'Assigned Work'},{screen:'machines',label:'Equipment Diagnostics'},{screen:'incidents',label:'Active Faults'},{screen:'reports',label:'Work History'}],
 Admin: [{screen:'dashboard',label:'System Overview'},{screen:'users',label:'People & Role Access'},{screen:'inventory',label:'Machine Management'},{screen:'incidents',label:'Incident Oversight'},{screen:'activity',label:'Activity Log'}],
};
export function supportingNavigation(role: UserRole): NavItem[] {
 if(role==='Supervisor'||role==='Manager') return [{screen:'incidents',label:'Incidents & Priorities'},{screen:'maintenance',label:'Work Orders'}];
 if(role==='Admin') return [{screen:'machines',label:'Machine Diagnostics'},{screen:'maintenance',label:'Work Orders'}];
 return [];
}
export const canOpenScreen = (role:UserRole, screen:AppScreen) => [...roleOperations[role],...supportingNavigation(role)].some(item=>item.screen===screen) || (screen==='analytics' && role!=='Operator');
