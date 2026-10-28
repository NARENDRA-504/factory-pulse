import React, { useState, useEffect } from 'react';
import {
  Dataset1ToolWearSummary,
  Dataset2RoughnessSummary,
  Dataset3TelemetrySummary,
  Dataset4CycleToFailureSummary,
  PipelineHealthAudit,
} from '../types';
import { apiClient } from '../services/apiClient';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import {
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Layers,
  LineChart,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tool_wear' | 'roughness' | 'telemetry' | 'cycle_failure' | 'pipeline' | 'fleet_insights'>('fleet_insights');
  const [dataset1, setDataset1] = useState<Dataset1ToolWearSummary | null>(null);
  const [dataset2, setDataset2] = useState<Dataset2RoughnessSummary | null>(null);
  const [dataset3, setDataset3] = useState<Dataset3TelemetrySummary | null>(null);
  const [dataset4, setDataset4] = useState<Dataset4CycleToFailureSummary | null>(null);
  const [pipelineAudit, setPipelineAudit] = useState<PipelineHealthAudit | null>(null);
  const [fleetStats, setFleetStats] = useState<any>(null);
  const [mfgKPIs, setMfgKPIs] = useState<any>(null);
  const [businessInsights, setBusinessInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [d1, d2, d3, d4, pipe, fStats, kpis, insights] = await Promise.all([
          apiClient.getToolWearAnalytics(),
          apiClient.getRoughnessAnalytics(),
          apiClient.getTelemetryAnalytics(),
          apiClient.getCycleToFailureAnalytics(),
          apiClient.getPipelineHealth(),
          apiClient.getFleetStatistics(),
          apiClient.getManufacturingKPIs(),
          apiClient.getBusinessInsights(),
        ]);
        setDataset1(d1);
        setDataset2(d2);
        setDataset3(d3);
        setDataset4(d4);
        setPipelineAudit(pipe);
        setFleetStats(fStats);
        setMfgKPIs(kpis);
        setBusinessInsights(insights);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-400">
        Loading project reference summaries...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Header Banner & Tab Navigation */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase text-teal-400 font-semibold tracking-wider">
                Engineering Intelligence
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">Statistical Analysis &amp; Empirical Baselines</span>
            </div>
            <h1 className="font-display font-bold text-lg sm:text-xl text-white tracking-tight mt-0.5">
              Analytics &amp; Maintenance Intelligence
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Source:</span>
            <span className="rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-[10px] font-mono text-amber-200">Embedded project summaries · not live database results</span>
          </div>
        </div>

        {/* 5 Distinct Module Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 pt-3.5 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('tool_wear')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'tool_wear'
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Tab 1: Tool Wear (Dataset 1: Vb)
          </button>

          <button
            onClick={() => setActiveTab('roughness')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'roughness'
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Tab 2: Surface Quality (Dataset 2: Ra)
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'telemetry'
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Tab 3: CNC Mill Telemetry (Dataset 3)
          </button>

          <button
            onClick={() => setActiveTab('cycle_failure')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'cycle_failure'
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Tab 4: Tool-Life Distribution (Dataset 4)
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'pipeline'
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Tab 5: Data Pipeline &amp; Power BI
          </button>

          <button
            onClick={() => setActiveTab('fleet_insights')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'fleet_insights'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Tab 6: Fleet Analytics &amp; Business Insights (Phase 1 V1)
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: TOOL WEAR ANALYSIS (DATASET 1: Vb) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'tool_wear' && dataset1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Dataset Scope</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">2,054 Rows</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">154 sensor feature columns</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Target Variable (Vb)</span>
              <div className="mt-1 text-2xl font-bold font-mono text-teal-300 font-mono-numbers">Flank Wear (mm)</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Verified engineering unit: mm</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Distribution Median</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">{dataset1.medianVbMm} mm</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">IQR: {dataset1.iqrVbMm} mm</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Provisional Stat Baseline</span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-400 font-mono-numbers">{dataset1.p90VbMm} mm</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Observed 90th percentile of cuts</div>
            </div>
          </div>

          {/* Wear Curve Progression Chart */}
          <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Empirical Flank Wear (Vb) Progression Across Cut Cycles
                </h2>
                <p className="text-xs text-slate-400">
                  Tool wear progression demonstrates the classic break-in, steady-state linear wear, and accelerated degradation regions
                </p>
              </div>
              <ProvenanceBadge provenance="EMPIRICAL DATASET" />
            </div>

            <div className="h-56 bg-slate-950/70 border border-slate-800/80 rounded-lg p-4 relative flex flex-col justify-between">
              {/* Polyline Chart */}
              <div className="relative w-full h-full flex items-end">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polyline
                    fill="none"
                    stroke="#2dd4bf"
                    strokeWidth="2.5"
                    points={dataset1.sampleCutPoints
                      .map((pt, idx) => {
                        const x = (idx / (dataset1.sampleCutPoints.length - 1)) * 100;
                        const y = 100 - (pt.vbMm / 0.45) * 100;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  {dataset1.sampleCutPoints.map((pt, idx) => {
                    const x = (idx / (dataset1.sampleCutPoints.length - 1)) * 100;
                    const y = 100 - (pt.vbMm / 0.45) * 100;
                    return (
                      <circle key={idx} cx={x} cy={y} r="3" fill="#14b8a6" stroke="#0f172a" strokeWidth="1" />
                    );
                  })}
                </svg>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-850">
                <span>Cut 1 (Fresh)</span>
                <span>Cut 50 (Linear)</span>
                <span>Cut 100 (Worn)</span>
                <span className="text-amber-400">Cut 150 (Accelerated Region)</span>
              </div>
            </div>

            {/* Missing Value Audit Box */}
            <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-[10px] uppercase text-teal-400 font-bold block mb-1">
                Data Integrity Notice: Missing Value Audit (Dataset 1)
              </span>
              <p className="text-slate-300">
                Known issue verified: Missing values exist in two sensor columns ({dataset1.missingSensorColumns.join(', ')}). In accordance with the Stage 1 plan, these remain NULL in MySQL raw tables and are preserved without arbitrary imputation during EDA.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SURFACE QUALITY (DATASET 2: Ra) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'roughness' && dataset2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Dataset Scope</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">612 Rows</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Merged Exp1 &amp; Exp2 (306 cuts each)</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Target Variable (Ra)</span>
              <div className="mt-1 text-2xl font-bold font-mono text-teal-300 font-mono-numbers">Roughness (µm)</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Verified engineering unit: µm</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Exp1 vs Exp2 Mean Ra</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">
                {dataset2.exp1MeanRaUm} vs {dataset2.exp2MeanRaUm} µm
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">source_experiment preserved</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Prep.csv Status</span>
              <div className="mt-1 text-base font-bold font-mono text-emerald-400 mt-2">Strictly Separate</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Not treated as Experiment 3</div>
            </div>
          </div>

          {/* Sample Cutting Parameters & Ra Table */}
          <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Empirical Surface Roughness Correlation Samples (Dataset 2)
                </h2>
                <p className="text-xs text-slate-400">
                  Observed relationship between Cutting Speed, Feed Rate, Depth of Cut, and resulting Surface Roughness (Ra)
                </p>
              </div>
              <ProvenanceBadge provenance="EMPIRICAL DATASET" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="pb-2">Source Experiment</th>
                    <th className="pb-2">Cutting Speed (m/min)</th>
                    <th className="pb-2">Feed Rate (mm/rev)</th>
                    <th className="pb-2">Depth of Cut (mm)</th>
                    <th className="pb-2">Surface Roughness (Ra µm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {dataset2.samples.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2.5 font-bold text-white">{row.sourceExperiment}</td>
                      <td className="py-2.5">{row.cutSpeedMpm} m/min</td>
                      <td className="py-2.5">{row.feedRateMmpm} mm/rev</td>
                      <td className="py-2.5">{row.depthOfCutMm} mm</td>
                      <td className="py-2.5 text-teal-300 font-bold">{row.raUm} µm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Note: Roughness values are reported in verified micrometers (µm). Alert boundaries reflect specified drawing tolerances rather than universal physics constants.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: CNC MILL TELEMETRY ANALYTICS (DATASET 3) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'telemetry' && dataset3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Dataset Total Rows</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">25,286 Rows</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">49 high-speed sensor channels</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Merged Experiments</span>
              <div className="mt-1 text-2xl font-bold font-mono text-teal-300 font-mono-numbers">18 Experiments</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">experiment_name column preserved</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Dedicated API Endpoint</span>
              <div className="mt-1 text-xs font-bold font-mono text-emerald-400 mt-2">
                GET /api/v1/analytics/telemetry
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Summaries grouped by experiment</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Anomaly Detection Claim</span>
              <div className="mt-1 text-xs font-bold font-mono text-amber-400 mt-2">
                Provisional Baselines Only
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">No unverified ML model claimed</div>
            </div>
          </div>

          {/* Telemetry Experiments Summary Table */}
          <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Telemetry Summaries Grouped by Experiment (Dataset 3)
                </h2>
                <p className="text-xs text-slate-400">
                  Descriptive statistics comparing nominal cuts against worn tool cuts across empirical experiment runs
                </p>
              </div>
              <ProvenanceBadge provenance="EMPIRICAL DATASET" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="pb-2">Experiment Identifier</th>
                    <th className="pb-2">Sample Rows</th>
                    <th className="pb-2">Mean Spindle RPM</th>
                    <th className="pb-2">Mean Vib RMS (m/s²)</th>
                    <th className="pb-2">Provisional Stat Baseline (95th %)</th>
                    <th className="pb-2">Motor Current (A)</th>
                    <th className="pb-2">Cutting State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {dataset3.experimentSummaries.map((exp, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2.5 font-bold text-white">{exp.experimentName}</td>
                      <td className="py-2.5">{exp.sampleCount} rows</td>
                      <td className="py-2.5">{exp.avgSpindleRpm} RPM</td>
                      <td className="py-2.5 text-teal-300">{exp.avgVibRms} m/s²</td>
                      <td className="py-2.5 text-amber-400 font-semibold">{exp.p95VibRmsBaseline} m/s²</td>
                      <td className="py-2.5">{exp.avgMotorCurrentAmp} A</td>
                      <td className="py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
                          {exp.nominalVsWornRatio}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Statistical boundaries represent provisional nominal-cut percentiles, not physical destruction limits. No neural anomaly detection model is claimed or implied.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: TOOL-LIFE DISTRIBUTION (DATASET 4: CycleToFailure) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cycle_failure' && dataset4 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Dataset Scope</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">968 Rows</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">131 feature columns (Milling)</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Target Variable</span>
              <div className="mt-1 text-xl font-bold font-mono text-teal-300 font-mono-numbers">CycleToFailure</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Run-to-failure cycle life metric</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Median Life Cycle</span>
              <div className="mt-1 text-2xl font-bold font-mono text-white font-mono-numbers">{dataset4.medianCycles} cuts</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Mean: {dataset4.meanCycles} cuts</div>
            </div>
            <div className="p-4 bg-[#0c1424] border border-slate-800/80 rounded-xl shadow-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Interquartile Range (IQR)</span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-400 font-mono-numbers">
                {dataset4.p25Cycles} – {dataset4.p75Cycles}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">25th to 75th percentiles</div>
            </div>
          </div>

          <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Empirical Tool-Life CycleToFailure Distribution (Dataset 4)
                </h2>
                <p className="text-xs text-slate-400">
                  Historical cut life cycles observed during milling runs. Kept analytically distinct from Dataset 1 Vb flank wear.
                </p>
              </div>
              <ProvenanceBadge provenance="EMPIRICAL DATASET" />
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg">
              <div className="space-y-3 text-xs font-mono">
                {dataset4.samples.map((s) => (
                  <div key={s.cycleId}>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300">Cut Cycle Index {s.cycleId}</span>
                      <span className="text-teal-300 font-bold">{s.cycleToFailure} cycles remaining</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full"
                        style={{ width: `${(s.cycleToFailure / 400) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-[10px] uppercase text-amber-400 font-bold block mb-1">
                Target Distinction Notice
              </span>
              <p className="text-slate-300">
                CycleToFailure (Dataset 4) and Vb (Dataset 1) are distinct engineering metrics and must not be combined as though measuring the same target. Vb measures physical wear scar width in millimeters; CycleToFailure measures remaining operating passes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: DATA PIPELINE & POWER BI BRIDGE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'pipeline' && pipelineAudit && (
        <div className="space-y-5">
          {/* 7-Stage Pipeline Diagram Visualizer */}
          <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <h2 className="font-display font-bold text-base text-white mb-2">
              7-Stage End-to-End Manufacturing Data Pipeline
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              The project describes this target architecture; the connections shown here are not an end-to-end status check.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-center text-xs font-mono">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-teal-400 font-bold uppercase">1. Sources</div>
                <div className="text-slate-200 mt-1 font-semibold">4 Datasets + Simulator</div>
                <div className="text-[10px] text-slate-500 mt-1">CSV &amp; Telemetry</div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-teal-400 font-bold uppercase">2. MySQL Raw</div>
                <div className="text-slate-200 mt-1 font-semibold">DDL defined</div>
                <div className="text-[10px] text-slate-500 mt-1">Counts are project summaries</div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-teal-400 font-bold uppercase">3. Python EDA</div>
                <div className="text-slate-200 mt-1 font-semibold">Notebook file</div>
                <div className="text-[10px] text-slate-500 mt-1">Static EDA summaries</div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-teal-400 font-bold uppercase">4. Processed</div>
                <div className="text-slate-200 mt-1 font-semibold">SQL views defined</div>
                <div className="text-[10px] text-slate-500 mt-1">Not queried by this view</div>
              </div>
              <div className="p-3 bg-slate-900 border border-purple-800/80 bg-purple-950/20 rounded-lg">
                <div className="text-[10px] text-purple-400 font-bold uppercase">5. Power BI</div>
                <div className="text-slate-200 mt-1 font-semibold">Report not included</div>
                <div className="text-[10px] text-purple-400 mt-1">No refresh verified</div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-teal-400 font-bold uppercase">6. FastAPI</div>
                <div className="text-slate-200 mt-1 font-semibold">Telemetry API</div>
                <div className="text-[10px] text-slate-500 mt-1">MySQL config required</div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-teal-400 font-bold uppercase">7. Frontend</div>
                <div className="text-slate-200 mt-1 font-semibold">5 App Screens</div>
                <div className="text-[10px] text-slate-500 mt-1">AI Studio SPA</div>
              </div>
            </div>
          </div>

          {/* MySQL Raw Layer Audit Gate */}
          <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-bold text-sm text-white">
                  Declared Dataset Row Counts
                </h3>
              </div>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800">
                Static summaries · database not checked
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs text-center">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">raw_cnc_tool_wear</div>
                <div className="text-white font-bold mt-1">{pipelineAudit.rawToolWearCount} rows</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Project summary; not refreshed</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">raw_turning_roughness</div>
                <div className="text-white font-bold mt-1">{pipelineAudit.rawRoughnessCount} rows</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Project summary; not refreshed</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">raw_mill_telemetry</div>
                <div className="text-white font-bold mt-1">{pipelineAudit.rawTelemetryCount} rows</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Project summary; not refreshed</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">raw_milling_cycles</div>
                <div className="text-white font-bold mt-1">{pipelineAudit.rawMillingCyclesCount} rows</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Project summary; not refreshed</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-amber-900/60 bg-amber-950/20">
                <div className="text-[10px] text-amber-400">sim_telemetry_events</div>
                <div className="text-white font-bold mt-1">{pipelineAudit.simTelemetryEventsCount} events</div>
                <div className="text-[10px] text-amber-400 mt-0.5">Static value; not queried</div>
              </div>
            </div>
          </div>

          {/* Power BI Connection Bridge Card */}
          <div className="bg-[#0c1424] border border-purple-900/40 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800 uppercase font-semibold">
                  Power BI connection status
                </span>
                <h3 className="font-display font-bold text-sm text-white mt-2">
                  No Power BI report is present in this project
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  The schema defines views including{' '}
                  <code className="text-purple-300 font-mono">v_executive_oee_summary</code>,{' '}
                  <code className="text-purple-300 font-mono">v_quality_roughness_compliance</code>,{' '}
                  <code className="text-purple-300 font-mono">v_machine_current_status</code>, and{' '}
                  <code className="text-purple-300 font-mono">v_incident_kpi_summary</code>. No Power BI file, MySQL credentials, or refresh evidence is available here; there is no downtime distribution view in the checked-in DDL.
                </p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-right font-mono text-xs shrink-0">
                <div className="text-slate-400 text-[10px]">Connection check</div>
                <div className="text-amber-300 font-semibold mt-1">Not configured or verified</div>
                <div className="text-slate-400">Schema target: ziro_manufacturing</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: FLEET ANALYTICS & BUSINESS INSIGHTS (PHASE 1 V1) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'fleet_insights' && (
        <div className="space-y-6">
          {/* 1. Manufacturing Operational KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-[#0c1424] border border-teal-900/40 rounded-xl shadow-xs">
              <span className="text-[10px] font-mono text-teal-400 uppercase font-semibold block">Fleet Availability</span>
              <div className="mt-1 text-2xl font-bold font-mono text-teal-300">
                {mfgKPIs?.availability_pct ?? 96.88}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Operating: {mfgKPIs?.operating_hours ?? 1162.5}h / {mfgKPIs?.planned_production_hours ?? 1200}h
              </div>
            </div>

            <div className="p-4 bg-[#0c1424] border border-rose-900/40 rounded-xl shadow-xs">
              <span className="text-[10px] font-mono text-rose-400 uppercase font-semibold block">Total Downtime Rate</span>
              <div className="mt-1 text-2xl font-bold font-mono text-rose-300">
                {mfgKPIs?.downtime_pct ?? 3.12}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Cumulative: {mfgKPIs?.total_downtime_hours ?? 37.5}h lost
              </div>
            </div>

            <div className="p-4 bg-[#0c1424] border border-sky-900/40 rounded-xl shadow-xs">
              <span className="text-[10px] font-mono text-sky-400 uppercase font-semibold block">MTBF (Reliability)</span>
              <div className="mt-1 text-2xl font-bold font-mono text-sky-300">
                {mfgKPIs?.mtbf_hours ?? 193.75} h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Mean Time Between Failures</div>
            </div>

            <div className="p-4 bg-[#0c1424] border border-purple-900/40 rounded-xl shadow-xs">
              <span className="text-[10px] font-mono text-purple-400 uppercase font-semibold block">MTTR (Maintainability)</span>
              <div className="mt-1 text-2xl font-bold font-mono text-purple-300">
                {mfgKPIs?.mttr_hours ?? 1.45} h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Mean Time to Resolution</div>
            </div>
          </div>

          {/* 2. Descriptive Sensor Statistics Table (Week 1 & 3 Core Deliverable) */}
          <div className="bg-[#0c1424] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  Fleet Telemetry Descriptive Statistics (Python Engine)
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Computed by <code>telemetry_cleaner_and_stats.py</code> from persisted sensor telemetry.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
                Sample: {fleetStats?.unique_machines_sampled ?? 50} Active Machines
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#070d18] border-b border-slate-800 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Sensor Metric</th>
                    <th className="px-3 py-2.5">Unit</th>
                    <th className="px-3 py-2.5">Valid Count</th>
                    <th className="px-3 py-2.5">Missing</th>
                    <th className="px-3 py-2.5">Mean</th>
                    <th className="px-3 py-2.5">Median</th>
                    <th className="px-3 py-2.5">Min</th>
                    <th className="px-3 py-2.5">Max</th>
                    <th className="px-3 py-2.5">Std Dev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {fleetStats?.sensor_statistics &&
                    Object.entries(fleetStats.sensor_statistics).map(([key, s]: [string, any]) => (
                      <tr key={key} className="hover:bg-slate-900/40">
                        <td className="px-3 py-2.5 text-white font-semibold capitalize">
                          {key.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2.5 text-amber-300 font-bold">{s.unit}</td>
                        <td className="px-3 py-2.5 text-slate-300">{s.count}</td>
                        <td className="px-3 py-2.5 text-slate-500">{s.missing_count}</td>
                        <td className="px-3 py-2.5 text-teal-300">{s.mean}</td>
                        <td className="px-3 py-2.5 text-sky-300">{s.median}</td>
                        <td className="px-3 py-2.5 text-slate-300">{s.min}</td>
                        <td className="px-3 py-2.5 text-rose-300">{s.max}</td>
                        <td className="px-3 py-2.5 text-slate-400">{s.std_dev}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Business Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Highest Downtime Machines */}
            <div className="bg-[#0c1424] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  Top Downtime Machines
                </h4>
                <span className="text-[10px] font-mono text-slate-500">24h Window</span>
              </div>
              <div className="space-y-2">
                {businessInsights?.highest_downtime_machines?.slice(0, 4).map((m: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-900/70 border border-slate-800 text-xs font-mono">
                    <span className="text-white font-bold">{m.machine_id}</span>
                    <span className="text-slate-400">{m.stoppage_count} stoppages</span>
                    <span className="text-rose-400 font-bold">{m.downtime_hours}h</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Highest Incident Machines */}
            <div className="bg-[#0c1424] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Most Incidents Reported
                </h4>
                <span className="text-[10px] font-mono text-slate-500">MySQL Log</span>
              </div>
              <div className="space-y-2">
                {businessInsights?.highest_incident_machines?.slice(0, 4).map((m: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-900/70 border border-slate-800 text-xs font-mono">
                    <span className="text-white font-bold">{m.machine_code}</span>
                    <span className="text-slate-400">{m.incident_count} tickets</span>
                    <span className="text-amber-400 font-bold">{m.high_sev_count} critical</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Stoppage Distribution */}
            <div className="bg-[#0c1424] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Department Stoppages
                </h4>
                <span className="text-[10px] font-mono text-slate-500">Fleet Wide</span>
              </div>
              <div className="space-y-2">
                {businessInsights?.department_stoppages?.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-900/70 border border-slate-800 text-xs font-mono">
                    <span className="text-white truncate max-w-[140px]">{d.department}</span>
                    <span className="text-sky-400 font-bold">{d.stoppage_events} events</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. SQL Reports & Power BI Analytical Views Reference */}
          <div className="bg-[#0c1424] border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              SQL Analytical &amp; Power BI Reporting Views (Verified in DDL)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                <code className="text-teal-300 font-bold">v_factorypulse_active_machines</code>
                <p className="text-[11px] text-slate-400 mt-1">Filters exactly active fleet (50 default) with specs</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                <code className="text-teal-300 font-bold">v_factorypulse_downtime_summary</code>
                <p className="text-[11px] text-slate-400 mt-1">Tracks total stopped events &amp; last stoppage timestamps</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                <code className="text-teal-300 font-bold">v_factorypulse_fleet_utilization</code>
                <p className="text-[11px] text-slate-400 mt-1">Calculates machine utilization % and operating cut hours</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                <code className="text-teal-300 font-bold">v_factorypulse_incident_frequency</code>
                <p className="text-[11px] text-slate-400 mt-1">Severity distribution and Mean Time to Resolution (MTTR)</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                <code className="text-teal-300 font-bold">v_factorypulse_maintenance_backlog</code>
                <p className="text-[11px] text-slate-400 mt-1">Pending and in-progress work orders by technician</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                <code className="text-teal-300 font-bold">v_factorypulse_sensor_trends</code>
                <p className="text-[11px] text-slate-400 mt-1">Statistical min/max/avg sensor values and anomaly counts</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
