// Knowledge Graph Types

export interface Node {
  id: string;
  name: string;
  entity_type: string;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  access_count: number;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  metadata: Record<string, unknown>;
  created_at: string;
  last_traversed: string | null;
  traversal_count: number;
}

export interface SchemaType {
  name: string;
  count: number;
  is_seed: boolean;
  evolved_from: string | null;
  created_at: string;
}

export interface GraphState {
  node_count: number;
  edge_count: number;
  schema_types: SchemaType[];
  total_queries: number;
  llm_calls: number;
  avg_latency_ms: number;
}

export interface QueryResult {
  nodes: Node[];
  edges: Edge[];
  traversed_path: string[];
  response: string | null;
  latency_ms: number;
  used_llm: boolean;
}

export interface AdaptationEvent {
  event_type: string;
  description: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface AddNoteResponse {
  note: Node;
  entities: Node[];
  edges: Edge[];
}

// Graph visualization types
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  val: number; // Size
  color: string;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// WebSocket message types
export interface WSMessage {
  type: 'graph_update' | 'adaptation' | 'state' | 'initial_state';
  event?: string;
  data?: unknown;
}
