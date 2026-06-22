import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../firebase';
import { Task } from '../types';
import { Sparkles, Plus, Code, CheckSquare, Square, Play, Database } from 'lucide-react';

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

// Map pre-defined mock tools to their OpenAI-style schemas
const PREDEFINED_TOOLS = [
  {
    id: 'search_flights',
    name: 'search_flights',
    description: 'Search flights NYC→SF, check prices, etc.',
    schema: {
      type: 'function',
      function: {
        name: 'search_flights',
        description: 'Search for flights between origin and destination on a specific date.',
        parameters: {
          type: 'object',
          properties: {
            origin: { type: 'string', description: 'Three-letter airport code (e.g. NYC, LAX).' },
            destination: { type: 'string', description: 'Three-letter airport code (e.g. SFO, MIA).' },
            date: { type: 'string', description: 'Flight date in YYYY-MM-DD format.' }
          },
          required: ['origin', 'destination', 'date']
        }
      }
    }
  },
  {
    id: 'book_flight',
    name: 'book_flight',
    description: 'Book flight using flight_number & passenger_name',
    schema: {
      type: 'function',
      function: {
        name: 'book_flight',
        description: 'Book a flight using a flight number and passenger name.',
        parameters: {
          type: 'object',
          properties: {
            flight_number: { type: 'string', description: 'The flight number to book (e.g. AA-102).' },
            passenger_name: { type: 'string', description: 'Full name of the passenger.' }
          },
          required: ['flight_number', 'passenger_name']
        }
      }
    }
  },
  {
    id: 'check_calendar',
    name: 'check_calendar',
    description: 'List calendar appointments/meetings for date',
    schema: {
      type: 'function',
      function: {
        name: 'check_calendar',
        description: 'Check the list of meetings and events scheduled on a specific date.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format.' }
          },
          required: ['date']
        }
      }
    }
  },
  {
    id: 'book_room',
    name: 'book_room',
    description: 'Book a conference room',
    schema: {
      type: 'function',
      function: {
        name: 'book_room',
        description: 'Book a conference/meeting room.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
            room_name: { type: 'string', description: 'Name of the room (e.g. Boardroom, Tesla).' },
            start_time: { type: 'string', description: 'Start time (HH:MM).' },
            end_time: { type: 'string', description: 'End time (HH:MM).' }
          },
          required: ['date', 'room_name', 'start_time', 'end_time']
        }
      }
    }
  },
  {
    id: 'get_weather',
    name: 'get_weather',
    description: 'Get weather conditions for city',
    schema: {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the weather forecast for a city on a specific date.',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'Name of the city.' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format.' }
          },
          required: ['city', 'date']
        }
      }
    }
  },
  {
    id: 'calculator',
    name: 'calculator',
    description: 'Solve simple math equations',
    schema: {
      type: 'function',
      function: {
        name: 'calculator',
        description: 'Evaluate a simple math expression.',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Mathematical expression (e.g., "120 * 1.05").' }
          },
          required: ['expression']
        }
      }
    }
  }
];

export const AdminTasks: React.FC = () => {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(PREDEFINED_TOOLS.map(t => t.id));
  const [useCustomJson, setUseCustomJson] = useState(false);
  const [customToolsJson, setCustomToolsJson] = useState('[]');
  const [contextJson, setContextJson] = useState('{}');
  
  const [generationLoading, setGenerationLoading] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch('/tasks')
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      let toolsSchema: any[] = [];
      if (useCustomJson) {
        try {
          toolsSchema = JSON.parse(customToolsJson);
        } catch {
          throw new Error("Invalid custom tools JSON format.");
        }
      } else {
        toolsSchema = PREDEFINED_TOOLS
          .filter(t => selectedTools.includes(t.id))
          .map(t => t.schema);
      }
      
      let context = {};
      try {
        context = JSON.parse(contextJson);
      } catch {
        throw new Error("Invalid context JSON format.");
      }

      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          available_tools: toolsSchema,
          context
        })
      });
    },
    onSuccess: () => {
      setPrompt('');
      setContextJson('{}');
      setSelectedTools(PREDEFINED_TOOLS.map(t => t.id));
      setSuccessMsg("Task successfully created!");
      setErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to create task");
      setSuccessMsg("");
    }
  });

  const toggleTool = (id: string) => {
    setSelectedTools(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // Generate Response Pair Mutation (Lead/Admin Billed Endpoint)
  const handleGenerate = async (taskId: string) => {
    setGenerationLoading(prev => ({ ...prev, [taskId]: true }));
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiFetch(`/tasks/${taskId}/generate`, { method: 'POST' });
      setSuccessMsg("Trajectories successfully generated. New Response Pair added to queue!");
    } catch (err: any) {
      setErrorMsg(err.message || "Trajectory generation failed. Verify Groq & Gemini keys are set.");
    } finally {
      setGenerationLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accentB/10 border border-accentB/20 flex items-center justify-center text-accentB">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif text-textWarm">Task Administration</h1>
          <p className="text-xs font-mono text-textMuted uppercase">Create annotation prompts & generate trajectories</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Create Task Form */}
        <div className="lg:col-span-1 bg-[#1b1920] border border-cardBorder rounded-xl p-6 space-y-5">
          <h2 className="text-md font-serif font-bold text-textWarm border-b border-cardBorder pb-2.5">
            Create Annotation Task
          </h2>

          {errorMsg && (
            <div className="p-3 bg-brandRed/10 border border-brandRed/20 text-brandRed rounded-lg text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-brandGreen/10 border border-brandGreen/20 text-brandGreen rounded-lg text-xs font-mono">
              {successMsg}
            </div>
          )}

          <form 
            onSubmit={(e) => { e.preventDefault(); createTaskMutation.mutate(); }}
            className="space-y-4"
          >
            {/* Prompt */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-textMuted uppercase tracking-wider block">
                User Instruction (Prompt)
              </label>
              <textarea
                required
                placeholder="E.g. Find flight AA-102 and book it if price is under $300"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full min-h-[90px] bg-[#222026] border border-cardBorder focus:border-accentB/60 rounded p-3 text-xs text-textWarm focus:outline-none transition-all resize-none"
              />
            </div>

            {/* Tool settings toggle */}
            <div className="flex items-center justify-between border-t border-cardBorder/60 pt-3">
              <span className="text-[10px] font-mono text-textMuted uppercase">Tool Schema Editor</span>
              <button
                type="button"
                onClick={() => setUseCustomJson(!useCustomJson)}
                className="text-[10px] font-mono text-accentB uppercase flex items-center gap-1 hover:underline"
              >
                <Code className="w-3.5 h-3.5" />
                {useCustomJson ? 'Use Select Mode' : 'Edit Raw JSON'}
              </button>
            </div>

            {useCustomJson ? (
              /* Raw JSON Schema Textarea */
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-[10px] font-mono text-textMuted uppercase block">
                  OpenAI Function Schema Array
                </label>
                <textarea
                  value={customToolsJson}
                  onChange={(e) => setCustomToolsJson(e.target.value)}
                  className="w-full min-h-[150px] bg-[#222026] border border-cardBorder focus:border-accentB/60 rounded p-2.5 text-[10px] font-mono text-textWarm focus:outline-none transition-all resize-y"
                />
              </div>
            ) : (
              /* Predefined Tool Checkboxes */
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {PREDEFINED_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    className="w-full flex items-start gap-2.5 p-2 bg-[#222026] hover:bg-[#28262e] border border-cardBorder rounded text-left transition-colors"
                  >
                    {selectedTools.includes(tool.id) ? (
                      <CheckSquare className="w-4 h-4 text-accentB flex-shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-textMuted flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-mono font-bold text-textWarm">{tool.name}</div>
                      <div className="text-[9px] text-textMuted mt-0.5 leading-tight">{tool.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Context State JSON */}
            <div className="space-y-1.5 border-t border-cardBorder/60 pt-3">
              <label className="text-[10px] font-mono text-textMuted uppercase tracking-wider block">
                Mock State Context (JSON)
              </label>
              <textarea
                value={contextJson}
                onChange={(e) => setContextJson(e.target.value)}
                className="w-full min-h-[60px] bg-[#222026] border border-cardBorder focus:border-accentB/60 rounded p-2.5 text-[10px] font-mono text-textWarm focus:outline-none transition-all"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="w-full bg-accentB hover:bg-accentB/90 text-black font-semibold rounded py-2 text-xs font-mono flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(79,209,197,0.15)] disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task Specification</span>
            </button>
          </form>
        </div>

        {/* Tasks List */}
        <div className="lg:col-span-2 bg-[#1b1920] border border-cardBorder rounded-xl p-6 space-y-4">
          <h2 className="text-md font-serif font-bold text-textWarm border-b border-cardBorder pb-2.5">
            Existing Task Specifications ({tasks.length})
          </h2>

          {isLoading ? (
            <div className="text-center font-mono text-xs text-textMuted py-8">[Loading tasks...]</div>
          ) : tasks.length === 0 ? (
            <div className="text-center font-mono text-xs text-textMuted py-8 border border-dashed border-cardBorder rounded-lg">
              No task specifications created yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="bg-[#222026] border border-cardBorder hover:border-cardBorder/80 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-sans font-medium text-textWarm leading-relaxed">
                      {task.prompt}
                    </p>
                    
                    {/* Tools tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {task.available_tools.map((t, idx) => {
                        const name = t.function?.name || `tool_${idx}`;
                        return (
                          <span key={idx} className="bg-background text-accentB border border-cardBorder font-mono text-[9px] px-1.5 py-0.5 rounded">
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Generate triggers */}
                  <div className="flex items-center gap-3 border-t md:border-t-0 border-cardBorder pt-3 md:pt-0">
                    <button
                      onClick={() => handleGenerate(task.id)}
                      disabled={generationLoading[task.id]}
                      className="bg-accentA hover:bg-accentA/90 disabled:bg-[#26242c] disabled:text-textMuted text-black text-xs font-mono font-bold px-3 py-2 rounded flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(255,122,51,0.1)] disabled:shadow-none"
                    >
                      {generationLoading[task.id] ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-textMuted border-t-transparent rounded-full animate-spin"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Generate Runs</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
