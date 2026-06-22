import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../firebase';
import { ResponsePairDetail, RubricScores } from '../types';
import { TrajectoryViewer } from '../components/TrajectoryViewer';
import { RubricScorer, RUBRIC_INFO } from '../components/RubricScorer';
import { PreferencePicker, AgreementMeter } from '../components/PreferencePicker';
import { Keyboard, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';

// API request helper with automatic authorization header
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

const defaultScores = (): RubricScores => ({
  tool_selection: { a: 3, b: 3 },
  argument_validity: { a: 3, b: 3 },
  chain_completeness: { a: 3, b: 3 },
  hallucination: { a: 3, b: 3 },
  safety: { a: 3, b: 3 },
  clarity: { a: 3, b: 3 },
  efficiency: { a: 3, b: 3 },
  instruction_adherence: { a: 3, b: 3 },
});

export const Annotate: React.FC = () => {
  const queryClient = useQueryClient();
  const [rubricScores, setRubricScores] = useState<RubricScores>(defaultScores());
  const [overallPreference, setOverallPreference] = useState<'a' | 'b' | 'tie' | ''>('');
  const [notes, setNotes] = useState('');
  
  // Navigation states for keyboard shortcuts
  const [focusedDimIndex, setFocusedDimIndex] = useState<number>(0);
  const [focusedSide, setFocusedSide] = useState<'a' | 'b'>('a');
  
  const dimensionsList: (keyof RubricScores)[] = [
    "tool_selection", "argument_validity", "chain_completeness", 
    "hallucination", "safety", "clarity", "efficiency", "instruction_adherence"
  ];

  // Fetch next pair
  const { data: pair, isLoading, error, refetch } = useQuery<ResponsePairDetail>({
    queryKey: ['nextPair'],
    queryFn: async () => {
      // Step 1: get next pair metadata
      const pairMeta = await apiFetch('/pairs/next');
      // Step 2: fetch complete detail (trajectories and any existing annotations)
      return await apiFetch(`/pairs/${pairMeta.id}`);
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Reset scoring form when pair changes
  useEffect(() => {
    if (pair) {
      setRubricScores(defaultScores());
      setOverallPreference('');
      setNotes('');
      setFocusedDimIndex(0);
      setFocusedSide('a');
    }
  }, [pair]);

  // Submit annotation mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!pair) return;
      if (!overallPreference) throw new Error("Please select overall preference");
      
      await apiFetch(`/pairs/${pair.id}/annotations`, {
        method: 'POST',
        body: JSON.stringify({
          overall_preference: overallPreference,
          rubric_scores: rubricScores,
          notes: notes || null
        })
      });
    },
    onSuccess: () => {
      // Invalidate query to trigger immediate fetch of the next pair
      queryClient.invalidateQueries({ queryKey: ['nextPair'] });
    }
  });

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore input events if user is typing in notes
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }
      
      const key = e.key;
      
      // Overall preferences
      if (key.toLowerCase() === 'a') {
        setOverallPreference('a');
      } else if (key.toLowerCase() === 'b') {
        setOverallPreference('b');
      } else if (key.toLowerCase() === 't') {
        setOverallPreference('tie');
      }
      
      // Focus navigation
      else if (key === 'ArrowDown') {
        e.preventDefault();
        setFocusedDimIndex(prev => (prev + 1) % dimensionsList.length);
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        setFocusedDimIndex(prev => (prev - 1 + dimensionsList.length) % dimensionsList.length);
      } else if (key === 'ArrowRight' || key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedSide(prev => (prev === 'a' ? 'b' : 'a'));
      }
      
      // Scores (1-5)
      else if (['1', '2', '3', '4', '5'].includes(key)) {
        e.preventDefault();
        const val = parseInt(key);
        const activeDim = dimensionsList[focusedDimIndex];
        
        // Update score
        setRubricScores(prev => ({
          ...prev,
          [activeDim]: {
            ...prev[activeDim],
            [focusedSide]: val
          }
        }));
        
        // Auto-advance logic
        if (focusedSide === 'a') {
          // Move from A to B of same dimension
          setFocusedSide('b');
        } else {
          // Move from B to A of next dimension
          setFocusedSide('a');
          setFocusedDimIndex(prev => (prev + 1) % dimensionsList.length);
        }
      }
      
      // Submit on Enter
      else if (key === 'Enter') {
        e.preventDefault();
        if (overallPreference && !submitMutation.isPending) {
          submitMutation.mutate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedDimIndex, focusedSide, overallPreference, rubricScores, pair, submitMutation]);

  const handleScoreChange = (dim: keyof RubricScores, side: 'a' | 'b', val: number) => {
    setRubricScores(prev => ({
      ...prev,
      [dim]: {
        ...prev[dim],
        [side]: val
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <div className="w-10 h-10 border-4 border-accentA border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-sm text-textMuted">Loading next trajectory pair...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4 max-w-md mx-auto text-center px-4">
        <div className="text-accentB text-4xl font-serif">✓</div>
        <h3 className="text-lg font-serif font-semibold text-textWarm">Queue Fully Annotated</h3>
        <p className="text-sm text-textMuted leading-relaxed">
          There are no new response pairs waiting for your rating. Refresh to check again or export labeled datasets.
        </p>
        <button 
          onClick={() => refetch()} 
          className="px-4 py-2 bg-[#222026] border border-cardBorder rounded hover:border-accentB text-xs font-mono transition-all"
        >
          Check Queue
        </button>
      </div>
    );
  }

  if (!pair) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      
      {/* Task Prompt Area */}
      <div className="bg-[#1b1920] border border-cardBorder rounded-xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-accentA font-bold uppercase tracking-widest">
            Task Instruction
          </span>
          <span className="text-[10px] font-mono text-textMuted">
            ID: {pair.task.id.substring(0, 8)}...
          </span>
        </div>
        <h2 className="text-xl font-serif text-textWarm leading-relaxed">
          {pair.task.prompt}
        </h2>
      </div>

      {/* Trajectories Side-by-Side with Agreement Meter in Center */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        
        {/* Trajectory A (Groq) */}
        <div className="transform transition-transform duration-300 hover:scale-[1.005]">
          <TrajectoryViewer 
            steps={pair.run_a.trajectory} 
            side="a" 
            modelName={pair.run_a.model_name} 
          />
        </div>

        {/* Center Agreement Meter */}
        <div className="hidden lg:block">
          <AgreementMeter scores={rubricScores} />
        </div>

        {/* Trajectory B (Gemini) */}
        <div className="transform transition-transform duration-300 hover:scale-[1.005]">
          <TrajectoryViewer 
            steps={pair.run_b.trajectory} 
            side="b" 
            modelName={pair.run_b.model_name} 
          />
        </div>
      </div>

      {/* Scoring Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Rubric Scorer List */}
        <div className="lg:col-span-2 space-y-3 bg-[#1b1920] border border-cardBorder rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-cardBorder pb-3 mb-4">
            <div>
              <span className="text-[10px] font-mono text-textMuted uppercase tracking-wider">Step 1: Rubrics</span>
              <h3 className="text-md font-serif font-semibold text-textWarm">Score Rubric Dimensions</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-textMuted border border-cardBorder rounded px-2 py-1 bg-background/50">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Use arrows and 1–5 keys</span>
            </div>
          </div>

          <div className="space-y-2">
            {dimensionsList.map((dim, idx) => (
              <RubricScorer
                key={dim}
                dimension={dim}
                scoreA={rubricScores[dim].a}
                scoreB={rubricScores[dim].b}
                onChange={handleScoreChange}
                isFocused={focusedDimIndex === idx}
                onFocus={() => {
                  setFocusedDimIndex(idx);
                }}
              />
            ))}
          </div>
        </div>

        {/* Decisions Panel */}
        <div className="space-y-6 flex flex-col justify-between">
          <PreferencePicker 
            value={overallPreference} 
            onChange={setOverallPreference} 
          />
          
          {/* Notes Card */}
          <div className="bg-[#1b1920] border border-cardBorder rounded-xl p-5 space-y-2.5 flex-1 mt-6 lg:mt-0 flex flex-col">
            <span className="text-[10px] font-mono text-textMuted uppercase tracking-wider block">Step 3: Annotator Notes</span>
            <textarea
              placeholder="Provide reasoning for your scores, highlight specific flaws (e.g. invalid parameter type, unnecessary loops, safety violations) or why one model is superior..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full flex-1 min-h-[120px] bg-[#222026] border border-cardBorder focus:border-accentA/60 rounded p-3 text-xs text-textWarm font-sans focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Submit action panel */}
          <div className="pt-4 border-t border-cardBorder flex items-center justify-between gap-4">
            {/* Keyboard guide legend */}
            <div className="hidden sm:flex flex-col text-left font-mono text-[9px] text-textMuted space-y-0.5">
              <div><span className="text-accentA">[↑/↓]</span> Navigate rows</div>
              <div><span className="text-accentA">[←/→]</span> Swap A/B column focus</div>
              <div><span className="text-accentA">[1-5]</span> Set active score</div>
              <div><span className="text-accentA">[A/B/T]</span> Set preference</div>
            </div>

            <button
              onClick={() => submitMutation.mutate()}
              disabled={!overallPreference || submitMutation.isPending}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                overallPreference && !submitMutation.isPending
                  ? 'bg-accentA text-black hover:shadow-[0_0_15px_rgba(255,122,51,0.3)] cursor-pointer'
                  : 'bg-cardBorder text-textMuted border border-cardBorder cursor-not-allowed'
              }`}
            >
              <span>Submit Annotation</span>
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
