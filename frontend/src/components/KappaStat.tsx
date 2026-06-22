import React from 'react';

interface KappaStatProps {
  label: string;
  value: number;
}

export const KappaStat: React.FC<KappaStatProps> = ({ label, value }) => {
  // Clamp value for visual bar representation (0 to 1)
  const clampedVal = Math.max(0, Math.min(1, value));
  const percentage = Math.round(clampedVal * 100);

  const getAgreementLevel = (val: number) => {
    if (val < 0.0) return { text: 'Disagreement', color: 'text-brandRed', bar: 'bg-brandRed' };
    if (val < 0.2) return { text: 'Slight/Poor', color: 'text-brandRed', bar: 'bg-brandRed' };
    if (val < 0.4) return { text: 'Fair', color: 'text-orange-400', bar: 'bg-orange-400' };
    if (val < 0.6) return { text: 'Moderate', color: 'text-accentA', bar: 'bg-accentA' };
    if (val < 0.8) return { text: 'Substantial', color: 'text-accentB', bar: 'bg-accentB' };
    return { text: 'Almost Perfect', color: 'text-brandGreen', bar: 'bg-brandGreen' };
  };

  const level = getAgreementLevel(value);

  return (
    <div className="bg-[#1b1920] border border-cardBorder rounded-lg p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-textMuted uppercase">{label}</span>
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded bg-background/50 border border-cardBorder ${level.color}`}>
          {level.text}
        </span>
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold font-mono tracking-tight text-textWarm">
          {value.toFixed(3)}
        </span>
        <span className="text-[10px] font-mono text-textMuted">κ score</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-[#26242c] rounded-full overflow-hidden border border-cardBorder/50">
        <div 
          className={`h-full ${level.bar} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};
