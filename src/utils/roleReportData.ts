import type { Incident, Machine, UserProfile } from '../types';
import type { PersistedSimulatorReading } from '../services/apiClient';

export const reportStatuses = [
  { label: 'Normal', key: 'NORMAL', color: '#1688d4' },
  { label: 'Idle', key: 'IDLE', color: '#6b73c9' },
  { label: 'Warning', key: 'WARNING', color: '#e99a35' },
  { label: 'Critical', key: 'CRITICAL', color: '#df6471' },
  { label: 'Stopped', key: 'STOPPED', color: '#8496a8' },
  { label: 'Maintenance', key: 'MAINTENANCE', color: '#8b6fc0' },
];
export const numericReading = (value: unknown): number | undefined => {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};
export function reportMachineScope(user: UserProfile, machines: Machine[]) {
  return user.role === 'Operator'
    ? machines.filter(m => !!user.assignedMachine && (m.machineCode === user.assignedMachine || m.code === user.assignedMachine))
    : machines;
}
export function buildRoleReport(machines: Machine[], input: PersistedSimulatorReading[], incidents: Incident[]) {
  const ids = new Set(machines.map(m => m.machineId));
  const rows = [...new Map(input.filter(r => ids.has(r.machine_id) && Number.isFinite(Date.parse(r.timestamp)))
    .map(r => [r.reading_id, r])).values()];
  const latest = new Map<string, PersistedSimulatorReading>();
  const status = new Map<string, PersistedSimulatorReading>();
  const severity = (key: string) => ['NORMAL', 'IDLE', 'MAINTENANCE', 'STOPPED', 'WARNING', 'CRITICAL'].indexOf(key);
  for (const row of rows) {
    const key = `${row.machine_id}/${row.sensor_name.toLowerCase()}`;
    const previous = latest.get(key);
    if (!previous || Date.parse(row.timestamp) > Date.parse(previous.timestamp)) latest.set(key, row);
    const current = status.get(row.machine_id);
    if (!current || Date.parse(row.timestamp) > Date.parse(current.timestamp) ||
      (row.timestamp === current.timestamp && severity(row.machine_status) > severity(current.machine_status))) status.set(row.machine_id, row);
  }
  const reading = (id: string, name: string) => latest.get(`${id}/${name.toLowerCase()}`);
  const value = (id: string, name: string) => numericReading(reading(id, name)?.sensor_value);
  const groups = new Map<string, { label: string; machines: number; reporting: number; records: number; good: number; scrap: number; actual: number; target: number; productionMachines: number; targetMachines: number; states: Record<string, number> }>();
  for (const machine of machines) {
    const label = `${machine.plant || 'Unassigned plant'} / ${machine.productionLine || 'Unassigned line'}`;
    const group = groups.get(label) || { label, machines: 0, reporting: 0, records: 0, good: 0, scrap: 0, actual: 0, target: 0, productionMachines: 0, targetMachines: 0, states: {} };
    group.machines++;
    if (status.has(machine.machineId)) group.reporting++;
    const good = value(machine.machineId, 'Good Parts'), scrap = value(machine.machineId, 'Scrap Parts');
    const target = value(machine.machineId, 'Shift Target');
    if (good !== undefined && scrap !== undefined && good >= 0 && scrap >= 0) {
      group.good += good; group.scrap += scrap; group.actual += good + scrap; group.productionMachines++;
      // Compare targets only for machines that also supplied both counters.
      if (target !== undefined && target > 0) { group.target += target; group.targetMachines++; }
    }
    const records = rows.filter(r => r.machine_id === machine.machineId);
    group.records += records.length;
    for (const row of records) group.states[row.machine_status] = (group.states[row.machine_status] || 0) + 1;
    groups.set(label, group);
  }
  const lines = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  const codes = new Set(machines.flatMap(m => [m.machineCode, m.code]));
  const scopedIncidents = incidents.filter(i => codes.has(i.machineCode));
  const machineSlices = reportStatuses.map(s => ({ ...s, value: [...status.values()].filter(r => r.machine_status === s.key).length }));
  machineSlices.push({ label: 'No reading', key: 'MISSING', color: '#dce5ec', value: machines.length - status.size });
  const recordSlices = reportStatuses.map(s => ({ ...s, value: rows.filter(r => r.machine_status === s.key).length }));
  return { rows, latest: [...latest.values()], lines, reading, value, scopedIncidents, machineSlices, recordSlices,
    reporting: status.size, latestTimestamp: rows.length ? new Date(Math.max(...rows.map(r => Date.parse(r.timestamp)))).toISOString() : undefined,
    productionMachines: lines.reduce((n, g) => n + g.productionMachines, 0),
    good: lines.reduce((n, g) => n + g.good, 0), scrap: lines.reduce((n, g) => n + g.scrap, 0),
    actual: lines.reduce((n, g) => n + g.actual, 0), target: lines.reduce((n, g) => n + g.target, 0),
  };
}
