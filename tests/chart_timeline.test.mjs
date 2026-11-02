import test from 'node:test';
import assert from 'node:assert/strict';
import { chartTimeline } from '../src/utils/chartTimeline.ts';
const row = (seconds, value) => ({ timestamp: new Date(Date.UTC(2026, 10, 2) + seconds * 1000).toISOString(), value });
test('Uneven sampling gaps retain their actual time spacing', () => {
  const points = chartTimeline([row(100, 3), row(0, 1), row(10, 2)]);
  assert.equal(points[0].x, 72);
  assert.equal(points[1].x, 111.6);
  assert.equal(points[2].x, 468);
});
test('Duplicate timestamps and invalid points do not invent extra history', () => {
  const points = chartTimeline([row(0, 1), row(0, 2), row(1, NaN), { timestamp: 'invalid', value: 3 }]);
  assert.equal(points.length, 1);
  assert.equal(points[0].value, 2);
  assert.equal(points[0].x, 270);
});
