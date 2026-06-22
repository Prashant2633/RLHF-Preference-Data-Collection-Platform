export interface Task {
  id: string;
  prompt: string;
  available_tools: any[];
  context: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface AgentRun {
  id: string;
  task_id: string;
  provider: 'groq' | 'gemini';
  model_name: string;
  trajectory: TrajectoryStep[];
  created_at: string;
}

export type TrajectoryStep =
  | { type: 'tool_call'; name: string; arguments: Record<string, any> }
  | { type: 'tool_result'; name: string; result: Record<string, any> }
  | { type: 'final_response'; content: string };

export interface ResponsePair {
  id: string;
  task_id: string;
  run_a_id: string;
  run_b_id: string;
  status: 'pending' | 'in_review' | 'calibration_flagged' | 'resolved' | 'exported';
  resolved_preference?: 'a' | 'b' | 'tie' | null;
  created_at: string;
}

export interface Annotation {
  id: string;
  pair_id: string;
  annotator_id: string;
  annotator_name?: string;
  overall_preference: 'a' | 'b' | 'tie';
  rubric_scores: RubricScores;
  notes?: string | null;
  created_at: string;
}

export interface RubricScores {
  tool_selection: DimensionScore;
  argument_validity: DimensionScore;
  chain_completeness: DimensionScore;
  hallucination: DimensionScore;
  safety: DimensionScore;
  clarity: DimensionScore;
  efficiency: DimensionScore;
  instruction_adherence: DimensionScore;
}

export interface DimensionScore {
  a: number; // 1-5
  b: number; // 1-5
}

export interface ResponsePairDetail extends ResponsePair {
  task: Task;
  run_a: AgentRun;
  run_b: AgentRun;
  annotations: Annotation[];
}

export interface CalibrationSession {
  id: string;
  led_by?: string;
  pair_ids: string[];
  dimension?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

export interface CalibrationStats {
  overall_preference_kappa: number;
  dimension_kappas: Record<string, number>;
}
