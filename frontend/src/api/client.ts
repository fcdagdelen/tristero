// API Client for the Knowledge Graph backend

const API_BASE = 'http://localhost:8000/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function addNote(content: string, title?: string, tags: string[] = []) {
  const res = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title, tags }),
  });
  return res.json();
}

export async function queryGraph(query: string, useLlm = true, maxResults = 10) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, use_llm: useLlm, max_results: maxResults }),
  });
  return res.json();
}

export async function getFullGraph() {
  const res = await fetch(`${API_BASE}/graph`);
  return res.json();
}

export async function getState() {
  const res = await fetch(`${API_BASE}/state`);
  return res.json();
}

export async function getAdaptations(limit = 10) {
  const res = await fetch(`${API_BASE}/adaptations?limit=${limit}`);
  return res.json();
}

export async function getSchema() {
  const res = await fetch(`${API_BASE}/schema`);
  return res.json();
}

export async function mergeEntities(keepId: string, mergeIds: string[]) {
  const res = await fetch(`${API_BASE}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keep_id: keepId, merge_ids: mergeIds }),
  });
  return res.json();
}

export async function confirmEdge(edgeId: string) {
  const res = await fetch(`${API_BASE}/edges/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edge_id: edgeId }),
  });
  return res.json();
}

export async function rejectEdge(edgeId: string) {
  const res = await fetch(`${API_BASE}/edges/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edge_id: edgeId }),
  });
  return res.json();
}

export async function importObsidian(vaultPath: string, clearExisting = true) {
  const res = await fetch(`${API_BASE}/import/obsidian`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vault_path: vaultPath, clear_existing: clearExisting }),
  });
  return res.json();
}

// WebSocket connection - caller handles reconnection to avoid infinite loops
export function createWebSocket(
  onMessage: (data: unknown) => void,
  onClose?: () => void
) {
  const ws = new WebSocket('ws://localhost:8000/api/ws');

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Let the caller handle reconnection with proper cleanup
    if (onClose) onClose();
  };

  return ws;
}
