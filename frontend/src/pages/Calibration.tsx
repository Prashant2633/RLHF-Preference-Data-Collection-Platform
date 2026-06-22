import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../firebase';
import { CalibrationStats, ResponsePairDetail, Annotation } from '../types';
import { KappaStat } from '../components/KappaStat';
import { TrajectoryViewer } from '../components/TrajectoryViewer';
import { AlertCircle, CheckCircle, HelpCircle, Save, User, ShieldAlert, FileWarning } from 'lucide-react';

const apiFetch = async (path: string, options: RequestInit = {}) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Not authenticated");
  const token = await currentUser.getIdToken();
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const response = await fetch(`${backendUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "API Request Failed");
  }
  return response.json();
};

export const Calibration: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [resolvedPref, setResolvedPref] = useState<'a' | 'b' | 'tie'>('a');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch Calibration Stats (Kappas)
  const { data: stats, isLoading: statsLoading } = useQuery<CalibrationStats>({
    queryKey: ['calibrationStats'],
    queryFn: () => apiFetch('/calibration/stats')
  });

  // Fetch Flagged Pairs
  const { data: flaggedPairs = [], isLoading: flaggedLoading } = useQuery<ResponsePairDetail[]>({
    queryKey: ['flaggedPairs'],
    queryFn: () => apiFetch('/calibration/flagged')
  });

  // Fetch detailed active pair
  const { data: activePair, isLoading: pairDetailLoading } = useQuery<ResponsePairDetail>({
    queryKey: ['pairDetail', selectedPairId],
    queryFn: () => apiFetch(`/pairs/${selectedPairId}`),
    enabled: !!selectedPairId
  });

  // Submit Resolution Mutation
  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPairId) return;
      await apiFetch('/calibration/sessions', {
        method: 'POST',
        body: JSON.stringify({
          resolutions: [
            {
              pair_id: selectedPairId,
              resolved_preference: resolvedPref
            }
          ],
          resolution_notes: resolutionNotes
        })
      });
    },
    onSuccess: () => {
      setSelectedPairId(null);
      setResolutionNotes('');
      setSuccessMsg("Calibration resolved successfully!");
      setErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ['flaggedPairs'] });
      queryClient.invalidateQueries({ queryKey: ['calibrationStats'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to submit resolution");
    }
  });

  const dimensionsList = [
    { id: 'tool_selection', name: 'Tool Selection' },
    { id: 'argument_validity', name: 'Argument Validity' },
    { id: 'chain_completeness', name: 'Chain Completeness' },
    { id: 'hallucination', name: 'Grounding' },
    { id: 'safety', name: 'Safety' },
    { id: 'clarity', name: 'Clarity' },
    { id: 'efficiency', name: 'Efficiency' },
    { id: 'instruction_adherence', name: 'Instruction Adherence' },
  ];

  // Check if a specific dimension has disagreement (gap >= 2 between annotators)
  const hasDimensionConflict = (dim: string, annotations: Annotation[]) => {
    if (annotations.length < 2) return false;
    const scores = annotations.map(ann => ann.rubric_scores[dim as keyof typeof ann.rubric_scores]);
    
    // Compare all pairs
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        if (Math.abs(scores[i].a - scores[j].a) >= 2 || Math.abs(scores[i].b - scores[j].b) >= 2) {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accentA/10 border border-accentA/20 flex items-center justify-center text-accentA">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif text-textWarm">Calibration Console</h1>
          <p className="text-xs font-mono text-textMuted uppercase">Align annotator metrics & resolve rating disagreements</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-brandGreen/10 border border-brandGreen/20 text-brandGreen rounded-lg text-xs font-mono text-center">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-brandRed/10 border border-brandRed/20 text-brandRed rounded-lg text-xs font-mono text-center">
          {errorMsg}
        </div>
      )}

      {/* Kappa Statistics Panel */}
      {stats && (
        <div className="space-y-4">
          <h2 className="text-sm font-mono text-textMuted uppercase tracking-wider">Inter-Annotator Agreement (Cohen's Kappa)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="md:col-span-1">
              <KappaStat label="Overall Preference" value={stats.overall_preference_kappa} />
            </div>
            {Object.entries(stats.dimension_kappas).map(([dim, val]) => {
              const name = dimensionsList.find(d => d.id === dim)?.name || dim;
              return (
                <KappaStat key={dim} label={name} value={val} />
              );
            })}
          </div>
        </div>
      )}

      {/* Main Workspace: Flagged Queue & Comparison Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Flagged Queue */}
        <div className="lg:col-span-4 bg-[#1b1920] border border-cardBorder rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-serif font-bold text-textWarm border-b border-cardBorder pb-2.5 flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-accentA" />
            Flagged for Calibration ({flaggedPairs.length})
          </h3>

          {flaggedLoading ? (
            <div className="text-center font-mono text-xs text-textMuted py-8">[Loading flagged queue...]</div>
          ) : flaggedPairs.length === 0 ? (
            <div className="text-center font-mono text-xs text-textMuted py-12 border border-dashed border-cardBorder rounded-lg">
              All annotation runs are fully calibrated. Disagreement queue empty!
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {flaggedPairs.map((pair) => (
                <button
                  key={pair.id}
                  onClick={() => {
                    setSelectedPairId(pair.id);
                    setResolvedPref(pair.annotations[0]?.overall_preference || 'a');
                  }}
                  className={`w-full p-3 text-left rounded-lg border transition-all ${
                    selectedPairId === pair.id
                      ? 'bg-accentA/10 border-accentA text-textWarm'
                      : 'bg-[#222026] border-cardBorder text-textMuted hover:border-accentA/40 hover:text-textWarm'
                  }`}
                >
                  <p className="text-xs font-sans font-medium line-clamp-2 leading-relaxed">
                    {pair.task.prompt}
                  </p>
                  <div className="flex items-center justify-between mt-2.5 border-t border-cardBorder/40 pt-1.5 text-[9px] font-mono">
                    <span className="text-accentB">{pair.annotations.length} ratings</span>
                    <span>Pair ID: {pair.id.substring(0, 8)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Comparison Detail & Resolution Form */}
        <div className="lg:col-span-8">
          {pairDetailLoading ? (
            <div className="flex flex-col items-center justify-center p-20 bg-[#1b1920] border border-cardBorder rounded-xl space-y-3">
              <div className="w-6 h-6 border-2 border-accentA border-t-transparent rounded-full animate-spin"></div>
              <p className="font-mono text-xs text-textMuted">Loading comparison details...</p>
            </div>
          ) : activePair ? (
            <div className="bg-[#1b1920] border border-cardBorder rounded-xl p-6 space-y-6">
              
              {/* Header Info */}
              <div className="border-b border-cardBorder pb-4">
                <span className="text-[10px] font-mono text-accentA font-bold uppercase block">Calibration Review Workspace</span>
                <h3 className="text-md font-serif font-semibold text-textWarm mt-1">
                  Prompt: "{activePair.task.prompt}"
                </h3>
              </div>

              {/* Side-by-Side Ratings Comparison Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono text-textMuted uppercase tracking-wider">Annotator Ratings Matrix</h4>
                
                <div className="overflow-x-auto border border-cardBorder rounded-lg">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#222026] text-textMuted border-b border-cardBorder">
                        <th className="p-3">Dimension</th>
                        {activePair.annotations.map((ann, idx) => (
                          <th key={ann.id} className="p-3 border-l border-cardBorder min-w-[120px]">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-accentB" />
                              <span>{ann.annotator_name || `Annotator ${idx + 1}`}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Overall Pref Row */}
                      <tr className="border-b border-cardBorder bg-[#1d1b22]">
                        <td className="p-3 font-serif font-bold text-textWarm">Overall Preference</td>
                        {activePair.annotations.map(ann => {
                          const val = ann.overall_preference.toUpperCase();
                          const color = val === 'A' ? 'text-accentA' : val === 'B' ? 'text-accentB' : 'text-purple-400';
                          return (
                            <td key={ann.id} className={`p-3 border-l border-cardBorder font-bold ${color}`}>
                              PREFER {val}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Rubrics Rows */}
                      {dimensionsList.map((dim) => {
                        const hasConflict = hasDimensionConflict(dim.id, activePair.annotations);
                        return (
                          <tr 
                            key={dim.id} 
                            className={`border-b border-cardBorder hover:bg-[#201d26] transition-colors ${
                              hasConflict ? 'bg-accentA/5 border-l-2 border-l-accentA' : ''
                            }`}
                          >
                            <td className="p-3 text-textWarm font-sans flex items-center justify-between gap-2">
                              <span>{dim.name}</span>
                              {hasConflict && (
                                <span className="text-[8px] bg-accentA/10 text-accentA px-1 py-0.5 border border-accentA/20 rounded font-mono uppercase">
                                  Conflict
                                </span>
                              )}
                            </td>
                            {activePair.annotations.map(ann => {
                              const score = ann.rubric_scores[dim.id as keyof typeof ann.rubric_scores];
                              return (
                                <td key={ann.id} className="p-3 border-l border-cardBorder text-textMuted">
                                  <span className="text-accentA font-bold">{score?.a}</span>
                                  <span className="text-cardBorder mx-1.5">|</span>
                                  <span className="text-accentB font-bold">{score?.b}</span>
                                  <span className="text-[10px] text-textMuted ml-1">(A|B)</span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trajectories split (minimizable/read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-cardBorder pt-6">
                <div>
                  <h4 className="text-xs font-mono text-accentA uppercase font-bold mb-2">Run A Trajectory</h4>
                  <div className="max-h-60 overflow-y-auto border border-cardBorder/60 rounded bg-background p-3 text-[11px] font-mono whitespace-pre-wrap">
                    {activePair.run_a.trajectory.map((s, i) => (
                      <div key={i} className="mb-2">
                        <span className={s.type === 'tool_call' ? 'text-brandRed' : s.type === 'tool_result' ? 'text-accentB' : 'text-accentA'}>
                          [{s.type.toUpperCase()}] {s.type !== 'final_response' ? s.name : ''}
                        </span>
                        <pre className="text-textWarm mt-0.5 text-[10px] pl-3">
                          {s.type === 'final_response' ? s.content : JSON.stringify(s.type === 'tool_call' ? s.arguments : s.result, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono text-accentB uppercase font-bold mb-2">Run B Trajectory</h4>
                  <div className="max-h-60 overflow-y-auto border border-cardBorder/60 rounded bg-background p-3 text-[11px] font-mono whitespace-pre-wrap">
                    {activePair.run_b.trajectory.map((s, i) => (
                      <div key={i} className="mb-2">
                        <span className={s.type === 'tool_call' ? 'text-brandRed' : s.type === 'tool_result' ? 'text-accentB' : 'text-accentA'}>
                          [{s.type.toUpperCase()}] {s.type !== 'final_response' ? s.name : ''}
                        </span>
                        <pre className="text-textWarm mt-0.5 text-[10px] pl-3">
                          {s.type === 'final_response' ? s.content : JSON.stringify(s.type === 'tool_call' ? s.arguments : s.result, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resolution Form */}
              <div className="bg-[#222026] border border-cardBorder rounded-lg p-5 space-y-4">
                <h4 className="text-xs font-mono text-accentB font-bold uppercase tracking-wider">Calibration Decision Consensus</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Select Resolution preference */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-textMuted uppercase block">Consensus Preference</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['a', 'b', 'tie'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setResolvedPref(p)}
                          className={`py-2 text-xs font-mono rounded border transition-all ${
                            resolvedPref === p
                              ? p === 'a' 
                                ? 'bg-accentA/10 border-accentA text-accentA font-bold' 
                                : p === 'b' 
                                  ? 'bg-accentB/10 border-accentB text-accentB font-bold' 
                                  : 'bg-purple-500/10 border-purple-500 text-purple-400 font-bold'
                              : 'bg-background border-cardBorder text-textMuted hover:text-textWarm'
                          }`}
                        >
                          {p.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resolution Notes */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-textMuted uppercase block">Calibration Resolution Notes</label>
                    <textarea
                      placeholder="Explain the rationale for the consensus preference decision (this will resolve the pair status and update Export logs)..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full min-h-[70px] bg-background border border-cardBorder focus:border-accentB/60 rounded p-2.5 text-xs text-textWarm focus:outline-none transition-all resize-none"
                    />
                  </div>

                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => resolveMutation.mutate()}
                    disabled={resolveMutation.isPending}
                    className="bg-brandGreen hover:bg-brandGreen/90 text-black font-semibold text-xs font-mono px-4 py-2 rounded flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(76,175,80,0.15)] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Resolution</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-[#1b1920] border border-cardBorder border-dashed rounded-xl p-20 text-center text-textMuted font-mono text-xs">
              Select a flagged response pair from the queue to start calibration review.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
