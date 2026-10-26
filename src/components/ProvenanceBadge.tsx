import React from 'react';
import { DataProvenance } from '../types';

interface ProvenanceBadgeProps {
  provenance: DataProvenance;
  size?: 'sm' | 'md';
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ provenance, size = 'sm' }) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  if (provenance === 'EMPIRICAL DATASET') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono tracking-wider font-semibold uppercase rounded text-sky-400 bg-sky-950/60 border border-sky-800/80 ${sizeClasses}`}
        title="Verified research dataset measurement (Datasets 1–4)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
        EMPIRICAL DATASET
      </span>
    );
  }

  if (provenance === 'SIMULATED') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono tracking-wider font-semibold uppercase rounded text-amber-400 bg-amber-950/60 border border-amber-800/80 ${sizeClasses}`}
        title="Generated or injected via AI Manufacturing Simulator"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        SIMULATED
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tracking-wider font-semibold uppercase rounded text-purple-400 bg-purple-950/60 border border-purple-800/80 ${sizeClasses}`}
      title="Placeholder or mock fixture used for demonstration"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
      DEMO FIXTURE
    </span>
  );
};
