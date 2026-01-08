import { useState } from 'react';
import { Search, Loader2, Zap, Clock } from 'lucide-react';
import type { QueryResult } from '../types';

interface Props {
  onQuery: (query: string, useLlm: boolean) => Promise<QueryResult>;
}

export function QueryPanel({ onQuery }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [useLlm, setUseLlm] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await onQuery(query.trim(), useLlm);
      setResult(res);
    } catch (err) {
      console.error('Query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your knowledge..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Query
          </button>
        </div>

        <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
            className="rounded"
          />
          Use LLM for response synthesis
        </label>
      </form>

      {result && (
        <div className="border-t border-gray-100 pt-4">
          {/* Metrics */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {result.latency_ms.toFixed(0)}ms
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {result.used_llm ? 'LLM used' : 'Fast path'}
            </span>
            <span>{result.nodes.length} nodes found</span>
          </div>

          {/* Response */}
          {result.response && (
            <div className="bg-gray-50 rounded-md p-3 mb-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.response}</p>
            </div>
          )}

          {/* Source nodes */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase">Sources</p>
            <div className="flex flex-wrap gap-2">
              {result.nodes.slice(0, 8).map((node) => (
                <span
                  key={node.id}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                  title={node.content || node.name}
                >
                  {node.name.slice(0, 30)}
                </span>
              ))}
              {result.nodes.length > 8 && (
                <span className="px-2 py-1 text-gray-500 text-xs">
                  +{result.nodes.length - 8} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
