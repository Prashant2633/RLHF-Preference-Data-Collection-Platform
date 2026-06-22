import React, { useState } from 'react';
import { auth } from '../firebase';
import { FileDown, Terminal, Compass, Layers, CheckCircle2 } from 'lucide-react';

export const Export: React.FC = () => {
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const triggerDownload = async (path: string, defaultName: string) => {
    setDownloading(prev => ({ ...prev, [path]: true }));
    setErrorMsg('');
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not authenticated");
      
      const token = await currentUser.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}${path}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to stream dataset file.");
      }
      
      // Get filename from response header if available
      const contentDisp = response.headers.get('Content-Disposition');
      let filename = defaultName;
      if (contentDisp && contentDisp.includes('filename=')) {
        filename = contentDisp.split('filename=')[1].replace(/"/g, '');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrorMsg(e.message || "Export download failed.");
    } finally {
      setDownloading(prev => ({ ...prev, [path]: false }));
    }
  };

  const formats = [
    {
      id: 'groq',
      title: 'Groq DPO Dataset',
      description: 'Stream .jsonl formatted pairs for Groq fine-tuning. Excludes tie preferences.',
      icon: <Terminal className="w-6 h-6 text-accentA" />,
      path: '/export/groq-jsonl',
      filename: 'groq_dpo_export.jsonl',
      spec: '{"prompt": "...", "chosen": "winning_trajectory_json", "rejected": "losing_trajectory_json"}'
    },
    {
      id: 'gemini',
      title: 'Gemini DPO Dataset',
      description: 'Stream .jsonl formatted pairs for Gemini fine-tuning. Excludes tie preferences.',
      icon: <Compass className="w-6 h-6 text-accentB" />,
      path: '/export/gemini-jsonl',
      filename: 'gemini_dpo_export.jsonl',
      spec: '{"prompt": "...", "chosen": "winning_trajectory_json", "rejected": "losing_trajectory_json"}'
    },
    {
      id: 'const_ai',
      title: 'Constitutional AI Format',
      description: 'Dataset containing critiques programmatically built from low-scoring dimensions. Retains ties.',
      icon: <Layers className="w-6 h-6 text-purple-400" />,
      path: '/export/constitutional-ai',
      filename: 'constitutional_ai_export.jsonl',
      spec: '{"prompt": "...", "response_a": "...", "response_b": "...", "preferred": "response_a|response_b|null", "critique": "...", "principle": "..."}'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accentB/10 border border-accentB/20 flex items-center justify-center text-accentB">
          <FileDown className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif text-textWarm">Dataset Export Center</h1>
          <p className="text-xs font-mono text-textMuted uppercase">Compile resolved trajectories for LLM fine-tuning</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-brandRed/10 border border-brandRed/20 text-brandRed rounded-lg text-xs font-mono max-w-md">
          {errorMsg}
        </div>
      )}

      {/* Grid of export cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {formats.map(fmt => (
          <div 
            key={fmt.id} 
            className="bg-[#1b1920] border border-cardBorder hover:border-cardBorder/80 rounded-xl p-6 flex flex-col justify-between space-y-5 transition-all shadow-md group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-lg bg-background border border-cardBorder flex items-center justify-center">
                  {fmt.icon}
                </div>
                <span className="text-[8px] font-mono text-textMuted uppercase bg-[#222026] px-1.5 py-0.5 rounded border border-cardBorder">
                  JSON Lines (.jsonl)
                </span>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-md font-serif font-bold text-textWarm group-hover:text-white transition-colors">
                  {fmt.title}
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  {fmt.description}
                </p>
              </div>

              {/* Code spec view */}
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-textMuted uppercase">Target Schema shape:</span>
                <div className="bg-background border border-cardBorder p-2.5 rounded font-mono text-[9px] text-accentB overflow-x-auto select-all">
                  <code>{fmt.spec}</code>
                </div>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => triggerDownload(fmt.path, fmt.filename)}
              disabled={downloading[fmt.path]}
              className={`w-full py-2.5 rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                fmt.id === 'groq' 
                  ? 'bg-accentA hover:bg-accentA/90 text-black shadow-[0_0_12px_rgba(255,122,51,0.15)]'
                  : fmt.id === 'gemini'
                    ? 'bg-accentB hover:bg-accentB/90 text-black shadow-[0_0_12px_rgba(79,209,197,0.15)]'
                    : 'bg-purple-500 hover:bg-purple-500/90 text-white shadow-[0_0_12px_rgba(168,85,247,0.15)]'
              } disabled:opacity-50`}
            >
              {downloading[fmt.path] ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download Dataset</span>
                </>
              )}
            </button>

          </div>
        ))}
      </div>

      {/* Pipeline Information */}
      <div className="bg-[#1b1920] border border-cardBorder rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-serif font-bold text-textWarm flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-brandGreen" />
          Data Integrity Controls
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-textMuted leading-relaxed font-sans">
          <div className="space-y-2">
            <p>
              <strong className="text-textWarm">Consensus Filtering:</strong> Only response pairs that have achieved a status of <code className="font-mono text-[10px] bg-background border border-cardBorder px-1 py-0.5 rounded text-accentA">resolved</code> are exported. Unresolved pairs sitting in the calibration queue are automatically excluded to prevent bad data leaks.
            </p>
            <p>
              <strong className="text-textWarm">Format Adaptation:</strong> DPO exports represent chosen vs rejected trajectories. Tied runs contain equal quality and are filtered out as they do not offer comparative training samples.
            </p>
          </div>
          <div className="space-y-2">
            <p>
              <strong className="text-textWarm">Critique Generation:</strong> For Constitutional AI formats, critiques are programmatically generated by detecting dimensions where the losing trajectory scored $\ge 2$ points lower than the winner, creating an audit-ready training signal.
            </p>
            <p>
              <strong className="text-textWarm">Immutable Audits:</strong> Submit records are saved in log databases for tracking, while original annotations are preserved for Kappa recalculations and team calibrating reviews.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
