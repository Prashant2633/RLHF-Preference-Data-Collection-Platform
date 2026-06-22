import React from 'react';
import { TrajectoryStep } from '../types';

interface TrajectoryViewerProps {
  steps: TrajectoryStep[];
  side: 'a' | 'b';
  modelName: string;
}

export const TrajectoryViewer: React.FC<TrajectoryViewerProps> = ({ steps, side, modelName }) => {
  const isA = side === 'a';
  const borderColor = isA ? 'border-accentA/30' : 'border-accentB/30';
  const glowClass = isA ? 'glow-amber' : 'glow-teal';
  const labelColor = isA ? 'text-accentA' : 'text-accentB';
  const pillBg = isA ? 'bg-accentA/10 text-accentA border-accentA/20' : 'bg-accentB/10 text-accentB border-accentB/20';

  return (
    <div className={`flex flex-col h-full bg-[#1b1920] border ${borderColor} rounded-xl p-5 ${glowClass} transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cardBorder pb-4 mb-4">
        <div>
          <span className={`text-xs uppercase font-mono px-2 py-0.5 border rounded-full ${pillBg}`}>
            Agent Run {side.toUpperCase()}
          </span>
          <h3 className="text-lg font-semibold font-serif mt-1.5 text-textWarm">
            {isA ? 'Groq Engine' : 'Gemini Engine'}
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-textMuted block uppercase">Active Model</span>
          <span className="text-xs font-mono text-textWarm bg-[#26242c] px-2 py-1 rounded border border-cardBorder">
            {modelName}
          </span>
        </div>
      </div>

      {/* Trajectory Steps Scroll List */}
      <div className="flex-1 overflow-y-auto space-y-4 max-h-[550px] pr-2">
        {steps.length === 0 ? (
          <div className="text-center text-textMuted py-8 font-mono text-sm">
            [No steps executed in this run]
          </div>
        ) : (
          steps.map((step, idx) => {
            if (step.type === 'tool_call') {
              return (
                <div key={idx} className="bg-[#24212a] border border-cardBorder rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-brandRed flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brandRed animate-pulse"></span>
                      TOOL CALL
                    </span>
                    <span className="text-[10px] font-mono text-textMuted">Step {Math.floor(idx / 2) + 1}</span>
                  </div>
                  <div className="font-mono text-sm bg-background border border-cardBorder p-2.5 rounded text-textWarm overflow-x-auto">
                    <span className="text-accentB">{step.name}</span>
                    <span className="text-textMuted">(</span>
                    <pre className="text-accentA text-xs mt-1 pl-4">
                      {JSON.stringify(step.arguments, null, 2)}
                    </pre>
                    <span className="text-textMuted">)</span>
                  </div>
                </div>
              );
            } else if (step.type === 'tool_result') {
              return (
                <div key={idx} className="bg-[#1f2d2b] border border-accentB/10 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-accentB flex items-center gap-1.5">
                      <span>✓</span> TOOL RESULT
                    </span>
                    <span className="text-[10px] font-mono text-textMuted">{step.name}</span>
                  </div>
                  <div className="font-mono text-xs bg-background/80 border border-cardBorder p-2.5 rounded text-textMuted overflow-x-auto max-h-40">
                    <pre className="text-textWarm">
                      {JSON.stringify(step.result, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            } else {
              // final_response
              return (
                <div key={idx} className={`bg-[#2c2621] border border-accentA/20 rounded-lg p-4 space-y-2 mt-4`}>
                  <div className="flex items-center justify-between border-b border-cardBorder pb-2">
                    <span className={`text-xs font-mono ${labelColor} font-bold`}>
                      ★ FINAL RESPONSE
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-textWarm whitespace-pre-wrap font-sans">
                    {step.content}
                  </p>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
};
