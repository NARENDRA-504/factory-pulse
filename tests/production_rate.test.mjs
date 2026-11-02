import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePartsPerHour } from '../src/utils/productionRate.ts';
const row = (seconds, value, quality = 'GOOD') => ({ sensor_name: 'Good Parts', timestamp: new Date(Date.UTC(2026, 10, 2) + seconds * 1000).toISOString(), sensor_value: value, data_quality: quality });
test('120 parts in 12 hours means 10 parts/hour and 360 seconds/part', () => {
  assert.equal(12 * 3600 / 120, 360);
  assert.equal(estimatePartsPerHour([row(0, 0), row(360, 1), row(720, 2)], 'Good Parts').partsPerHour, 10);
});
test('counter resets start a new observation and never create negative output', () => {
  assert.equal(estimatePartsPerHour([row(0, 100), row(60, 101), row(120, 0), row(480, 1)], 'Good Parts').partsPerHour, 10);
});
test('missing, noisy, negative and insufficient counter history cannot create a rate', () => {
  assert.equal(estimatePartsPerHour([row(0, null), row(60, 1, 'NOISY'), row(120, -1)], 'Good Parts'), null);
  assert.equal(estimatePartsPerHour([row(0, 0), row(20, 1)], 'Good Parts'), null);
});
