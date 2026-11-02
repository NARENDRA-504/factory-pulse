import test from 'node:test';
import assert from 'node:assert/strict';
import { operationsModel } from '../src/utils/operationsModel.ts';
const units={'Planned Time':'s','Run Time':'s','Ideal Time':'s','Window Good':'parts','Window Scrap':'parts','Electrical Energy':'kWh','Scrap Cost':'INR','Downtime Loss':'INR','Scrap Unit Cost':'INR/part','Downtime Hour Cost':'INR/h'};
const rows=(id,values)=>Object.entries(values).map(([name,value])=>({machine_id:id,sensor_name:'Model '+name,sensor_unit:units[name],sensor_value:value,timestamp:'2026-11-02T08:00:00Z',data_quality:'GOOD'}));
test('Weighted OEE and scoped energy use matching windows, not average percentages',()=>{
 const r=rows('A',{'Planned Time':100,'Run Time':80,'Ideal Time':40,'Window Good':8,'Window Scrap':2,'Electrical Energy':2});
 r.push(...rows('B',{'Planned Time':300,'Run Time':120,'Ideal Time':120,'Window Good':2,'Window Scrap':0,'Electrical Energy':1}));
 const m=operationsModel(r,['A','B']);assert.equal(m.availability,.5);assert.equal(m.performance,.8);assert.equal(m.quality,10/12);assert.ok(Math.abs(m.oee-.5*.8*10/12)<1e-12);assert.equal(m.energy,3);assert.equal(m.energyPerPart,.3);assert.equal(m.loss,undefined);
 assert.equal(operationsModel(r,['A']).energy,2);
});
test('Missing, invalid and zero-production data stay unavailable',()=>{
 const r=rows('A',{'Planned Time':10,'Run Time':5,'Ideal Time':5,'Window Good':0,'Window Scrap':0,'Electrical Energy':null});
 const m=operationsModel(r,['A']);assert.equal(m.quality,undefined);assert.equal(m.oee,undefined);assert.equal(m.energy,undefined);
 assert.equal(operationsModel(rows('A',{'Planned Time':10,'Run Time':20}),['A']).machines.length,0);
});
test('Current-rate financial exposure uses rejected parts and stopped hours exactly once',()=>{
 const r=rows('A',{'Planned Time':3600,'Run Time':1800,'Ideal Time':1800,'Window Good':5,'Window Scrap':4,'Scrap Unit Cost':65,'Downtime Hour Cost':1200});
 const m=operationsModel(r,['A']);assert.equal(m.scrapExposure,260);assert.equal(m.downExposure,600);
 // Repeated samples never multiply cost; a second station has its own rates.
 r.push(...r,...rows('B',{'Planned Time':3600,'Run Time':3000,'Ideal Time':3000,'Window Good':8,'Window Scrap':1,'Scrap Unit Cost':100,'Downtime Hour Cost':600}));
 const fleet=operationsModel(r,['A','B']);assert.equal(fleet.scrapExposure,360);assert.equal(fleet.downExposure,700);
 const unpriced=operationsModel(r.filter(x=>x.sensor_name!=='Model Scrap Unit Cost'),['A','B']);assert.equal(unpriced.scrapExposure,undefined);
});

