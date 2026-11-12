import React from 'react';
import {BookOpen, Search, ShieldCheck} from 'lucide-react';

/** Ranking scores express search relevance, never confidence in a diagnosis. */
export function RetrievalDetails({retrieval, sources = []}:{retrieval?:any;sources?:any[]}) {
 if(!retrieval?.version)return null;
 const labels:Record<string,string>={fresh_measurements:'Fresh readings available',last_known_only:'Last-known readings only',guidance_only:'Project guidance only',no_evidence:'No supporting evidence found'};
 const fresh=retrieval.evidence_status==='fresh_measurements';
 return <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs" aria-label="Answer evidence review">
  <p className={`font-semibold ${fresh?'text-teal-800':'text-amber-800'}`}>{labels[retrieval.evidence_status]||'Evidence review'}</p>
  <div className="flex flex-wrap gap-x-4 gap-y-2 text-slate-600">
   <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3"/>Account scope enforced</span>
   <span className="inline-flex items-center gap-1"><Search className="h-3 w-3"/>{retrieval.knowledge_selected??0} passages retrieved</span>
   <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3"/>{retrieval.fresh_good_measurements??0} fresh GOOD readings</span>
  </div>
  {retrieval.followup_context_used&&<p className="text-slate-600">Used your previous machine question to understand this follow-up.</p>}
  <details><summary className="cursor-pointer text-teal-800">How this answer was grounded</summary>
   <p className="mt-2 break-words text-slate-700">Search question: {retrieval.query}</p>
   <p className="mt-1 text-slate-600">Searched {retrieval.knowledge_chunks_searched} approved passages. {retrieval.knowledge_candidates} matched before ranking. Current readings must be within {retrieval.stale_after_seconds} seconds and pass quality checks.</p>
   <p className="mt-1 text-slate-500">Search uses words, headings and query coverage. Relevance scores rank passages; they are not confidence percentages or proof of a diagnosis.</p>
   {sources.filter(s=>s.kind==='project_knowledge').map(s=><div className="mt-2 border-t border-slate-100 pt-2" key={s.id}>
    <p className="font-medium text-slate-700">[{s.id}] {s.section||s.title}</p>
    <p className="mt-1 text-slate-600">Matched terms: {s.matched_terms?.join(', ')||'Not available'}</p>
    {s.passage_sha256&&<p className="mt-1 break-all font-mono text-[10px] text-slate-500">Passage fingerprint: {s.passage_sha256.slice(0,16)}</p>}
   </div>)}
  </details>
 </div>;
}
