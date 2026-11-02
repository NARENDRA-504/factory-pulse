import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoleReport, numericReading, reportMachineScope } from '../src/utils/roleReportData.ts';

const machines = [
  { machineId: 'MCH-001', machineCode: 'CNC-001', code: 'CNC-001', plant: 'Plant A', productionLine: 'Line 1' },
  { machineId: 'MCH-002', machineCode: 'CNC-002', code: 'CNC-002', plant: 'Plant B', productionLine: 'Line 1' },
];
const reading = (id, machine, sensor, value, timestamp = '2026-10-31T10:01:00Z', status = 'NORMAL') => ({ reading_id: id, machine_id: machine, sensor_name: sensor, sensor_value: value, timestamp, machine_status: status });

test('Repeated counter samples do not inflate production and partial targets do not invent output', () => {
  const rows = [reading('old', 'MCH-001', 'Good Parts', 9, '2026-10-31T10:00:00Z'),
    reading('good', 'MCH-001', 'Good Parts', 10), reading('scrap', 'MCH-001', 'Scrap Parts', 2),
    reading('target', 'MCH-001', 'Shift Target', 120), reading('unknown', 'MCH-002', 'Shift Target', 120)];
  const report = buildRoleReport(machines, rows, []);
  assert.equal(report.actual, 12);
  assert.equal(report.target, 120);
  assert.equal(report.productionMachines, 1);
  assert.equal(report.lines.length, 2, 'Same line name in different plants remains distinct');
  assert.equal(report.lines[1].productionMachines, 0);
});

test('Machine scope and report input cannot reveal another operator station', () => {
  const allowed = reportMachineScope({ role: 'Operator', assignedMachine: 'CNC-001' }, machines);
  const report = buildRoleReport(allowed, [reading('own', 'MCH-001', 'RPM', 2400), reading('other', 'MCH-002', 'RPM', 9999)], []);
  assert.equal(report.rows.length, 1);
  assert.equal(report.value('MCH-002', 'RPM'), undefined);
  assert.deepEqual(reportMachineScope({ role: 'Operator' }, machines), []);
});

test('Records and machines have different denominators and duplicate rows count once', () => {
  const normal = reading('rpm', 'MCH-001', 'RPM', 2400);
  const report = buildRoleReport(machines, [normal, normal, reading('temp', 'MCH-001', 'Temperature', 45, undefined, 'WARNING')], []);
  assert.equal(report.rows.length, 2);
  assert.equal(report.reporting, 1);
  assert.equal(report.machineSlices.find(s => s.key === 'WARNING').value, 1);
  assert.equal(report.machineSlices.find(s => s.key === 'MISSING').value, 1);
  assert.equal(report.recordSlices.reduce((n, s) => n + s.value, 0), 2);
});

test('Missing readings stay unavailable and temperature is never summed', () => {
  assert.equal(numericReading(null), undefined);
  assert.equal(numericReading(''), undefined);
  assert.equal(numericReading(false), undefined);
  assert.equal(numericReading('NaN'), undefined);
  const report = buildRoleReport(machines, [reading('t1', 'MCH-001', 'Temperature', 40, '2026-10-31T10:00:00Z'), reading('t2', 'MCH-001', 'Temperature', 42)], []);
  assert.equal(report.value('MCH-001', 'Temperature'), 42);
  assert.equal(report.value('MCH-001', 'Coolant Temperature'), undefined);
  assert.equal(report.productionMachines, 0);
});
