import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Node, Edge, GraphState, AdaptationEvent, GraphData } from '../types';
import * as api from '../api/client';

// Color mapping for entity types
const TYPE_COLORS: Record<string, string> = {
  note: '#3B82F6',      // Blue
  person: '#10B981',    // Green
  place: '#F59E0B',     // Amber
  thing: '#8B5CF6',     // Purple
  concept: '#EC4899',   // Pink
  project: '#06B6D4',   // Cyan
};

function getNodeColor(type: string): string {
  return TYPE_COLORS[type] || '#6B7280'; // Gray default
}

function getNodeSize(node: Node): number {
  const baseSize = node.entity_type === 'note' ? 8 : 5;
  return baseSize + Math.min(node.access_count, 10);
}

export interface ImportProgress {
  status: 'started' | 'completed' | 'cleared';
  current: number;
  total: number;
  imported: number;
  file?: string;
  errors?: Array<{ file: string; error: string }>;
}

// Traversal event from backend
export interface TraversalEvent {
  type: 'query_traversal' | 'edge_creation' | 'note_processing';
  phase?: 'embedding_search' | 'edge_expansion' | 'entity_match' | 'llm_thinking' | 'complete' | 'extracting' | 'linking' | 'embedding';
  node_id?: string;
  edge_id?: string;
  delay_ms?: number;
  score?: number;
  edge?: Edge;
  entity?: Node;
  progress?: number;
}

// Traversal state for visualization
export interface TraversalState {
  isActive: boolean;
  activeNodeId: string | null;
  visitedNodes: Set<string>;
  visitedEdges: Set<string>;
  glowIntensities: Map<string, number>;  // node_id -> 0-1 intensity
  edgeProgress: Map<string, number>;      // edge_id -> 0-1 draw progress
  currentPhase: string | null;
}

const initialTraversalState: TraversalState = {
  isActive: false,
  activeNodeId: null,
  visitedNodes: new Set(),
  visitedEdges: new Set(),
  glowIntensities: new Map(),
  edgeProgress: new Map(),
  currentPhase: null,
};

export function useGraph() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [state, setState] = useState<GraphState | null>(null);
  const [adaptations, setAdaptations] = useState<AdaptationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // Traversal visualization state
  const [traversalState, setTraversalState] = useState<TraversalState>(initialTraversalState);

  // Event queue for pacing traversal animations
  const [eventQueue, setEventQueue] = useState<TraversalEvent[]>([]);
  const isProcessingRef = useRef(false);

  // Animation refs for edge drawing
  const animationFrameRef = useRef<number | null>(null);

  // Memoized graphData - only recompute when nodes/edges actually change
  // IMPORTANT: Don't include highlighting in this - keep it structural only
  const graphData: GraphData = useMemo(() => ({
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.entity_type,
      val: getNodeSize(n),
      color: getNodeColor(n.entity_type),
    })),
    links: edges.map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      weight: e.weight,
      type: e.relation_type,
    })),
  }), [nodes, edges]);

  // Process traversal event queue with delays
  useEffect(() => {
    if (eventQueue.length === 0 || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const event = eventQueue[0];

    // Apply the traversal event
    applyTraversalEvent(event);

    // Wait for suggested delay, then process next
    const delay = event.delay_ms || 100;
    setTimeout(() => {
      setEventQueue((prev) => prev.slice(1));
      isProcessingRef.current = false;
    }, delay);
  }, [eventQueue]);

  // Apply a single traversal event to visualization state
  const applyTraversalEvent = useCallback((event: TraversalEvent) => {
    if (event.type === 'query_traversal') {
      setTraversalState((prev) => {
        const newGlowIntensities = new Map(prev.glowIntensities);
        const newVisitedNodes = new Set(prev.visitedNodes);
        const newVisitedEdges = new Set(prev.visitedEdges);

        // Fade previous active node
        if (prev.activeNodeId && prev.activeNodeId !== event.node_id) {
          const prevIntensity = newGlowIntensities.get(prev.activeNodeId) || 1.0;
          newGlowIntensities.set(prev.activeNodeId, Math.max(prevIntensity * 0.6, 0.3));
        }

        // Set new active node with full glow
        if (event.node_id) {
          newGlowIntensities.set(event.node_id, event.score || 1.0);
          newVisitedNodes.add(event.node_id);
        }

        // Track visited edge
        if (event.edge_id) {
          newVisitedEdges.add(event.edge_id);
          // Start edge draw animation
          startEdgeAnimation(event.edge_id);
        }

        return {
          ...prev,
          isActive: event.phase !== 'complete',
          activeNodeId: event.node_id || prev.activeNodeId,
          visitedNodes: newVisitedNodes,
          visitedEdges: newVisitedEdges,
          glowIntensities: newGlowIntensities,
          currentPhase: event.phase || prev.currentPhase,
        };
      });

      // If complete, start fade-out of all glows
      if (event.phase === 'complete') {
        startGlowFadeOut();
      }
    } else if (event.type === 'edge_creation' && event.edge) {
      // Add new edge to graph
      setEdges((prev) => {
        const edgeMap = new Map(prev.map((e) => [e.id, e]));
        edgeMap.set(event.edge!.id, event.edge!);
        return Array.from(edgeMap.values());
      });
      // Start draw animation for the new edge
      startEdgeAnimation(event.edge.id);
    } else if (event.type === 'note_processing' && event.entity) {
      // Add new entity to graph
      setNodes((prev) => {
        const nodeMap = new Map(prev.map((n) => [n.id, n]));
        nodeMap.set(event.entity!.id, event.entity!);
        return Array.from(nodeMap.values());
      });
      // Highlight the new entity
      setTraversalState((prev) => {
        const newGlowIntensities = new Map(prev.glowIntensities);
        newGlowIntensities.set(event.entity!.id, 1.0);
        return { ...prev, glowIntensities: newGlowIntensities };
      });
    }
  }, []);

  // Start edge draw animation
  const startEdgeAnimation = useCallback((edgeId: string) => {
    const startTime = Date.now();
    const duration = 180; // 180ms draw animation (faster)

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      setTraversalState((prev) => {
        const newEdgeProgress = new Map(prev.edgeProgress);
        newEdgeProgress.set(edgeId, progress);
        return { ...prev, edgeProgress: newEdgeProgress };
      });

      if (progress < 1.0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Fade out glows after traversal completes - visited nodes persist at 30%
  const startGlowFadeOut = useCallback(() => {
    const startTime = Date.now();
    const duration = 1500; // 1.5 second fade out (faster)
    const minIntensity = 0.3; // Visited nodes persist at 30% glow

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      setTraversalState((prev) => {
        if (prev.glowIntensities.size === 0) return prev;

        const newGlowIntensities = new Map<string, number>();
        prev.glowIntensities.forEach((intensity, nodeId) => {
          // Fade to minIntensity for visited nodes, not to zero
          const targetIntensity = prev.visitedNodes.has(nodeId) ? minIntensity : 0;
          const newIntensity = intensity - (intensity - targetIntensity) * progress;
          if (newIntensity > 0.02) {
            newGlowIntensities.set(nodeId, newIntensity);
          }
        });

        // Don't reset to initial state - keep visited nodes glowing
        return {
          ...prev,
          glowIntensities: newGlowIntensities,
          isActive: false,
          activeNodeId: null,
        };
      });

      if (progress < 1.0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Clear traversal state
  const clearTraversal = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setEventQueue([]);
    setTraversalState(initialTraversalState);
    isProcessingRef.current = false;
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [graphRes, stateRes, adaptRes] = await Promise.all([
        api.getFullGraph(),
        api.getState(),
        api.getAdaptations(20),
      ]);
      // Use ID-based deduplication
      setNodes(graphRes.nodes);
      setEdges(graphRes.edges);
      setState(stateRes);
      setAdaptations(adaptRes.events);
      setError(null);
    } catch (err) {
      setError('Failed to connect to backend. Is it running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize and set up WebSocket with proper reconnection handling
  useEffect(() => {
    fetchData();

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const handleWsMessage = (data: unknown) => {
      const msg = data as {
        type: string;
        data?: unknown;
        event?: unknown;
        status?: string;
        current?: number;
        total?: number;
        imported?: number;
        file?: string;
        errors?: Array<{ file: string; error: string }>;
        final_state?: GraphState;
        // Traversal event fields
        phase?: string;
        node_id?: string;
        edge_id?: string;
        delay_ms?: number;
        score?: number;
        edge?: Edge;
        entity?: Node;
        progress?: number;
      };

      if (msg.type === 'initial_state' || msg.type === 'state') {
        setState(msg.data as GraphState);
      } else if (msg.type === 'query_traversal' || msg.type === 'edge_creation' || msg.type === 'note_processing') {
        // Queue traversal events for animated processing
        setEventQueue((prev) => [...prev, msg as TraversalEvent]);
      } else if (msg.type === 'graph_update') {
        // Refresh on graph updates (traversal state checked inside fetchData if needed)
        fetchData();
      } else if (msg.type === 'adaptation') {
        setAdaptations((prev) => [msg.event as AdaptationEvent, ...prev.slice(0, 19)]);
      } else if (msg.type === 'import_status') {
        if (msg.status === 'started') {
          setImportProgress({
            status: 'started',
            current: 0,
            total: (msg as any).total || 0,
            imported: 0,
          });
        } else if (msg.status === 'completed') {
          setImportProgress({
            status: 'completed',
            current: msg.total || 0,
            total: msg.total || 0,
            imported: msg.imported || 0,
            errors: msg.errors,
          });
          if (msg.final_state) {
            setState(msg.final_state);
          }
          fetchData();
          setTimeout(() => setImportProgress(null), 3000);
        } else if (msg.status === 'cleared') {
          setNodes([]);
          setEdges([]);
        }
      } else if (msg.type === 'import_progress') {
        setImportProgress((prev) => ({
          status: 'started',
          current: msg.current || prev?.current || 0,
          total: msg.total || prev?.total || 0,
          imported: msg.imported || prev?.imported || 0,
          file: msg.file,
        }));
        // Incremental updates with deduplication
        const progressData = msg as any;
        if (progressData.note) {
          setNodes((prev) => {
            const nodeMap = new Map(prev.map((n) => [n.id, n]));
            nodeMap.set(progressData.note.id, progressData.note);
            return Array.from(nodeMap.values());
          });
        }
        if (progressData.entities) {
          setNodes((prev) => {
            const nodeMap = new Map(prev.map((n) => [n.id, n]));
            progressData.entities.forEach((e: Node) => nodeMap.set(e.id, e));
            return Array.from(nodeMap.values());
          });
        }
        if (progressData.edges) {
          setEdges((prev) => {
            const edgeMap = new Map(prev.map((e) => [e.id, e]));
            progressData.edges.forEach((e: Edge) => edgeMap.set(e.id, e));
            return Array.from(edgeMap.values());
          });
        }
      }
    };

    const connectWebSocket = () => {
      if (!isMounted) return;
      ws = api.createWebSocket(handleWsMessage, () => {
        // On close, attempt reconnection after 3 seconds (only if mounted)
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      });
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [fetchData]); // Removed traversalState.isActive - no longer causes reinit on query completion

  // Add a note
  const addNote = useCallback(async (content: string, title?: string) => {
    try {
      const result = await api.addNote(content, title);
      // Don't immediately refresh - let WebSocket handle streaming updates
      return result;
    } catch (err) {
      console.error('Failed to add note:', err);
      throw err;
    }
  }, []);

  // Query the graph (now with streaming traversal)
  const query = useCallback(async (queryText: string, useLlm = true) => {
    try {
      // Clear any previous traversal
      clearTraversal();
      // Start traversal mode
      setTraversalState((prev) => ({ ...prev, isActive: true }));

      const result = await api.queryGraph(queryText, useLlm);
      return result;
    } catch (err) {
      console.error('Failed to query:', err);
      clearTraversal();
      throw err;
    }
  }, [clearTraversal]);

  // Merge entities
  const mergeEntities = useCallback(async (keepId: string, mergeIds: string[]) => {
    try {
      await api.mergeEntities(keepId, mergeIds);
      await fetchData();
    } catch (err) {
      console.error('Failed to merge:', err);
      throw err;
    }
  }, [fetchData]);

  // Start Obsidian import
  const startImport = useCallback(async (vaultPath: string, clearExisting: boolean = true) => {
    try {
      const result = await api.importObsidian(vaultPath, clearExisting);
      return result;
    } catch (err) {
      console.error('Failed to start import:', err);
      throw err;
    }
  }, []);

  return {
    nodes,
    edges,
    graphData,
    state,
    adaptations,
    loading,
    error,
    importProgress,
    traversalState,
    addNote,
    query,
    mergeEntities,
    startImport,
    clearTraversal,
    refresh: fetchData,
  };
}
