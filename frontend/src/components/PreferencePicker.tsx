import React from 'react';
import { RubricScores } from '../types';

interface PreferencePickerProps {
  value: 'a' | 'b' | 'tie' | '';
  onChange: (val: 'a' | 'b' | 'tie') => void;
}

export const PreferencePicker: React.FC<PreferencePickerProps> = ({ value, onChange }) => {
  return (
    <div className="bg-[#1b1920] border border-cardBorder rounded-xl p-5 space-y-4">
      <div className="text-center">
        <span className="text-[10px] font-mono text-textMuted uppercase tracking-wider">Step 2: Submit Decision</span>
        <h3 className="text-md font-serif font-semibold text-textWarm mt-0.5">Overall Trajectory Preference</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Prefer A */}
        <button
          type="button"
          onClick={() => onChange('a')}
          className={`relative group flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-300 ${
            value === 'a'
              ? 'bg-accentA/15 border-accentA text-accentA shadow-[0_0_20px_rgba(255,122,51,0.2)]'
              : 'bg-[#222026] border-cardBorder text-textMuted hover:text-textWarm hover:border-accentA/45'
          }`}
        >
          <span className="text-2xl font-serif font-bold mb-1">A</span>
          <span className="text-xs font-mono uppercase tracking-widest">PREFER A</span>
          <span className="absolute bottom-1 right-2 text-[9px] font-mono text-textMuted opacity-30 group-hover:opacity-100 transition-opacity">Key: [A]</span>
        </button>

        {/* Tie */}
        <button
          type="button"
          onClick={() => onChange('tie')}
          className={`relative group flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-300 ${
            value === 'tie'
              ? 'bg-purple-500/15 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
              : 'bg-[#222026] border-cardBorder text-textMuted hover:text-textWarm hover:border-purple-500/40'
          }`}
        >
          <span className="text-2xl font-serif font-bold mb-1">=</span>
          <span className="text-xs font-mono uppercase tracking-widest">TIE / EQUAL</span>
          <span className="absolute bottom-1 right-2 text-[9px] font-mono text-textMuted opacity-30 group-hover:opacity-100 transition-opacity">Key: [T]</span>
        </button>

        {/* Prefer B */}
        <button
          type="button"
          onClick={() => onChange('b')}
          className={`relative group flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-300 ${
            value === 'b'
              ? 'bg-accentB/15 border-accentB text-accentB shadow-[0_0_20px_rgba(79,209,197,0.2)]'
              : 'bg-[#222026] border-cardBorder text-textMuted hover:text-textWarm hover:border-accentB/45'
          }`}
        >
          <span className="text-2xl font-serif font-bold mb-1">B</span>
          <span className="text-xs font-mono uppercase tracking-widest">PREFER B</span>
          <span className="absolute bottom-1 right-2 text-[9px] font-mono text-textMuted opacity-30 group-hover:opacity-100 transition-opacity">Key: [B]</span>
        </button>
      </div>
    </div>
  );
};

interface AgreementMeterProps {
  scores: RubricScores;
}

export const AgreementMeter: React.FC<AgreementMeterProps> = ({ scores }) => {
  const dimensions: (keyof RubricScores)[] = [
    "tool_selection", "argument_validity", "chain_completeness", 
    "hallucination", "safety", "clarity", "efficiency", "instruction_adherence"
  ];
  
  let winsA = 0;
  let winsB = 0;
  
  dimensions.forEach(dim => {
    const sc = scores[dim];
    if (sc.a > sc.b) winsA++;
    else if (sc.b > sc.a) winsB++;
  });
  
  const totalWins = winsA + winsB;
  
  // Calculate percentage: center is 50%. A wins fill towards 0%, B wins fill towards 100%.
  let percentage = 50;
  if (totalWins > 0) {
    // scale from 10% to 90% so it doesn't max out too easily
    const ratio = (winsB - winsA) / totalWins; // -1 to +1
    percentage = 50 + (ratio * 40);
  }
  
  return (
    <div className="flex flex-col items-center justify-center h-full px-3">
      <span className="text-[10px] font-mono text-accentA font-bold mb-2">{winsA}</span>
      
      {/* Vertical Agreement Meter Track */}
      <div className="relative w-2 h-72 bg-[#222026] border border-cardBorder rounded-full overflow-hidden flex flex-col justify-between">
        {/* Center line marker */}
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-cardBorder z-10"></div>
        
        {/* Score indicator fills */}
        <div 
          className="w-full bg-accentA transition-all duration-300"
          style={{ height: `${Math.max(0, 50 - percentage)}%` }}
        ></div>
        <div className="flex-1 bg-transparent"></div>
        <div 
          className="w-full bg-accentB transition-all duration-300"
          style={{ height: `${Math.max(0, percentage - 50)}%` }}
        ></div>
      </div>
      
      <span className="text-[10px] font-mono text-accentB font-bold mt-2">{winsB}</span>
      <span className="text-[8px] font-mono text-textMuted uppercase mt-3 [writing-mode:vertical-lr] tracking-widest opacity-40">
        Agreement Meter
      </span>
    </div>
  );
};
