import type { PersistedSimulatorReading } from '../services/apiClient';

const units: Record<string, string> = { 'Planned Time': 's', 'Run Time': 's', 'Down Time': 's', 'Ideal Time': 's', 'Window Good': 'parts', 'Window Scrap': 'parts', 'Electrical Energy': 'kWh', 'Scrap Cost': 'INR', 'Downtime Loss': 'INR', 'Scrap Unit Cost': 'INR/part', 'Downtime Hour Cost': 'INR/h' };
export function operationsModel(rows: PersistedSimulatorReading[], ids: string[]) {
  const latest = new Map<string, PersistedSimulatorReading>();
  for (const r of rows) {
    const key = `${r.machine_id}/${r.sensor_name}`;
    if (!latest.has(key) || Date.parse(r.timestamp) > Date.parse(latest.get(key)!.timestamp)) latest.set(key, r);
  }
  const result = ids.flatMap(id => {
    const stamp = latest.get(`${id}/Model Planned Time`)?.timestamp;
    const read = (name: string) => {
      const r = latest.get(`${id}/Model ${name}`);
      return r && r.timestamp === stamp && r.data_quality === 'GOOD' && r.sensor_unit === units[name] && typeof r.sensor_value === 'number' && Number.isFinite(r.sensor_value) && r.sensor_value >= 0 ? r.sensor_value : undefined;
    };
    const planned = read('Planned Time'), run = read('Run Time'), ideal = read('Ideal Time'), good = read('Window Good'), scrap = read('Window Scrap');
    if (planned === undefined || !planned || run === undefined || ideal === undefined || good === undefined || scrap === undefined || run > planned + .001 || ideal > run + .001) return [];
    const scrapRate = read('Scrap Unit Cost'), downRate = read('Downtime Hour Cost');
    return [{ id, planned, run, ideal, good, scrap, energy: read('Electrical Energy'), scrapCost: read('Scrap Cost'), loss: read('Downtime Loss'), scrapRate, downRate,
      scrapExposure: scrapRate && scrapRate > 0 ? scrap * scrapRate : undefined,
      downExposure: downRate && downRate > 0 ? (planned - run) / 3600 * downRate : undefined }];
  });
  const total = (key: 'planned' | 'run' | 'ideal' | 'good' | 'scrap') => result.reduce((s, r) => s + r[key], 0);
  const planned = total('planned'), run = total('run'), ideal = total('ideal'), good = total('good'), scrap = total('scrap');
  const quality = good + scrap ? good / (good + scrap) : undefined;
  const availability = planned ? run / planned : undefined;
  const performance = run ? ideal / run : undefined;
  const complete = (key: 'energy' | 'scrapCost' | 'loss' | 'scrapExposure' | 'downExposure') => result.length && result.every(r => r[key] !== undefined) ? result.reduce((s, r) => s + r[key]!, 0) : undefined;
  const energy = complete('energy');
  return { machines: result, planned, run, good, scrap, availability, performance, quality, oee: availability !== undefined && performance !== undefined && quality !== undefined ? availability * performance * quality : undefined, energy, energyPerPart: energy !== undefined && good > 0 ? energy / good : undefined, scrapCost: complete('scrapCost'), loss: complete('loss'), scrapExposure: complete('scrapExposure'), downExposure: complete('downExposure') };
}
