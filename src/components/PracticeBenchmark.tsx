import React from 'react';

export function PracticeBenchmark({data}:{data:any}){
 if(!data?.available)return null;
 return <section className="rounded-xl border border-sky-200 bg-sky-50 p-4" aria-label="Separate practice benchmark">
  <h3 className="font-semibold text-slate-900">{data.name}</h3>
  <p className="mt-2 text-sm text-slate-700">{data.notice}</p>
  <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
   ['Test rows',data.rows],['Failures detected',data.detected],['Failures missed',data.missed],['False alarms',data.false_alarms]
  ].map(([label,value])=><div key={String(label)}><dt className="text-xs text-slate-600">{label}</dt><dd className="text-xl font-semibold">{Number(value).toLocaleString()}</dd></div>)}</dl>
  <p className="mt-3 text-sm">Recall {(data.recall*100).toFixed(1)}% · Precision {(data.precision*100).toFixed(1)}% · F1 {(data.f1*100).toFixed(1)}%</p>
  <p className="mt-2 text-xs font-medium text-sky-900">Practice artifact only · never used to create operational alerts</p>
 </section>;
}
