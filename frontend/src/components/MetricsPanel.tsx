import { Activity, Cpu, Clock, Database } from 'lucide-react';
import type { GraphState } from '../types';

interface Props {
  state: GraphState | null;
}

export function MetricsPanel({ state }: Props) {
  if (!state) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-gray-500 text-sm">Loading metrics...</p>
      </div>
    );
  }

  const llmRatio = state.total_queries > 0
    ? ((state.llm_calls / state.total_queries) * 100).toFixed(1)
    : '0';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-gray-500" />
        <h3 className="font-medium text-gray-900">Metrics</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Node count */}
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <Database className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{state.node_count}</p>
          <p className="text-xs text-blue-600">Nodes</p>
        </div>

        {/* Edge count */}
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <Activity className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-700">{state.edge_count}</p>
          <p className="text-xs text-green-600">Edges</p>
        </div>

        {/* Queries */}
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <Cpu className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{state.total_queries}</p>
          <p className="text-xs text-amber-600">Queries</p>
        </div>

        {/* Latency */}
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-purple-700">
            {state.avg_latency_ms.toFixed(0)}
          </p>
          <p className="text-xs text-purple-600">Avg ms</p>
        </div>
      </div>

      {/* LLM usage */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">LLM Usage</span>
          <span className="text-sm font-medium text-gray-800">{llmRatio}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(parseFloat(llmRatio), 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {state.llm_calls} of {state.total_queries} queries used LLM
        </p>
      </div>
    </div>
  );
}
