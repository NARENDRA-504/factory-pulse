import React from 'react';

export function ReferenceLibrary({data}:{data:any}){
 if(!data?.items?.length)return null;
 return <section className="rounded-xl border border-teal-200 bg-white p-4" aria-label="Reviewed public references">
  <h3 className="text-lg font-semibold">Reviewed public references</h3>
  <p className="mt-2 text-sm text-slate-600">{data.notice}</p>
  <div className="mt-4 grid gap-3 md:grid-cols-2">{data.items.map((item:any)=><article key={item.id} className="rounded-lg border border-slate-200 p-4">
   <p className="text-xs font-medium text-teal-800">{item.kind} · {item.publisher}</p>
   <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 block font-semibold text-teal-900 underline underline-offset-4">{item.title} ↗</a>
   <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
   <p className="mt-2 text-xs text-amber-900">{item.applicability}</p>
  </article>)}</div>
  <p className="mt-3 text-xs text-slate-500">Source review: {data.reviewed_on} · References only · No automatic site approval</p>
 </section>;
}
