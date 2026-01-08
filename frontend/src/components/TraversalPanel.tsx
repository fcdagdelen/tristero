import { useEffect, useState, useRef } from 'react';
import { Search, GitBranch, MapPin, MessageSquare, CheckCircle2, Circle } from 'lucide-react';
import type { TraversalState } from '../hooks/useGraph';

interface TraversalPanelProps {
  traversalState: TraversalState;
}

interface Phase {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const phases: Phase[] = [
  { id: 'embedding_search', label: 'Semantic Search', icon: Search },
  { id: 'edge_expansion', label: 'Expanding Edges', icon: GitBranch },
  { id: 'entity_match', label: 'Finding Entities', icon: MapPin },
  { id: 'llm_thinking', label: 'Generating Response', icon: MessageSquare },
  { id: 'complete', label: 'Complete', icon: CheckCircle2 },
];

function getPhaseIndex(phaseId: string | null): number {
  if (!phaseId) return -1;
  return phases.findIndex((p) => p.id === phaseId);
}

export function TraversalPanel({ traversalState }: TraversalPanelProps) {
  const [visible, setVisible] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevPhaseRef = useRef<string | null>(null);

  // Show panel when traversal becomes active
  useEffect(() => {
    if (traversalState.isActive) {
      setVisible(true);
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    } else if (traversalState.visitedNodes.size > 0) {
      // Keep visible for a bit after completion, then fade
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setCompletedPhases(new Set());
      }, 3000);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [traversalState.isActive, traversalState.visitedNodes.size]);

  // Track completed phases
  useEffect(() => {
    const currentPhase = traversalState.currentPhase;
    const prevPhase = prevPhaseRef.current;

    if (currentPhase && prevPhase && currentPhase !== prevPhase) {
      // Previous phase is now complete
      setCompletedPhases((prev) => new Set([...prev, prevPhase]));
    }

    if (currentPhase === 'complete') {
      // Mark all phases as complete
      setCompletedPhases(new Set(phases.slice(0, -1).map((p) => p.id)));
    }

    prevPhaseRef.current = currentPhase;
  }, [traversalState.currentPhase]);

  // Reset completed phases when new traversal starts
  useEffect(() => {
    if (traversalState.isActive && traversalState.visitedNodes.size === 0) {
      setCompletedPhases(new Set());
    }
  }, [traversalState.isActive, traversalState.visitedNodes.size]);

  if (!visible) return null;

  const currentPhaseIndex = getPhaseIndex(traversalState.currentPhase);
  const isComplete = traversalState.currentPhase === 'complete';

  return (
    <div className="absolute top-24 left-4 z-20 animate-slide-in-left">
      <div className="w-56 bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-400' : 'bg-blue-400 animate-pulse'}`} />
          <span className="text-sm font-medium text-slate-200">
            {isComplete ? 'Query Complete' : 'Traversing...'}
          </span>
        </div>

        {/* Timeline */}
        <div className="p-4">
          <div className="space-y-1">
            {phases.map((phase, index) => {
              const isActive = traversalState.currentPhase === phase.id;
              const isCompleted = completedPhases.has(phase.id) || currentPhaseIndex > index;
              const isPending = !isActive && !isCompleted;
              const Icon = phase.icon;

              return (
                <div
                  key={phase.id}
                  className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-all duration-300 ${
                    isActive ? 'bg-blue-500/20' : ''
                  }`}
                >
                  {/* Timeline dot/icon */}
                  <div className="relative flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : isActive ? (
                      <div className="relative">
                        <Icon className="w-4 h-4 text-blue-400" />
                        <div className="absolute inset-0 w-4 h-4 bg-blue-400/30 rounded-full animate-ping" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600" />
                    )}
                    {/* Connecting line */}
                    {index < phases.length - 1 && (
                      <div
                        className={`absolute left-1.5 top-5 w-0.5 h-4 ${
                          isCompleted ? 'bg-green-400/50' : 'bg-slate-700'
                        }`}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-xs transition-colors duration-300 ${
                      isActive
                        ? 'text-blue-300 font-medium'
                        : isCompleted
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`}
                  >
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50">
          <div className="flex justify-between text-xs">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400 tabular-nums">
                {traversalState.visitedNodes.size}
              </div>
              <div className="text-slate-500">Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400 tabular-nums">
                {traversalState.visitedEdges.size}
              </div>
              <div className="text-slate-500">Edges</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400 tabular-nums">
                {traversalState.glowIntensities.size}
              </div>
              <div className="text-slate-500">Active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
