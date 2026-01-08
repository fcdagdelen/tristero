import { GitBranch, Sparkles } from 'lucide-react';
import type { SchemaType, AdaptationEvent } from '../types';

// Color mapping for entity types
const TYPE_COLORS: Record<string, string> = {
  note: 'bg-blue-100 text-blue-800',
  person: 'bg-green-100 text-green-800',
  place: 'bg-amber-100 text-amber-800',
  thing: 'bg-purple-100 text-purple-800',
  concept: 'bg-pink-100 text-pink-800',
  project: 'bg-cyan-100 text-cyan-800',
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || 'bg-gray-100 text-gray-800';
}

interface Props {
  schemaTypes: SchemaType[];
  adaptations: AdaptationEvent[];
}

export function SchemaPanel({ schemaTypes, adaptations }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      {/* Schema Types */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">Schema Evolution</h3>
        </div>

        <div className="space-y-2">
          {schemaTypes.map((type) => (
            <div
              key={type.name}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(type.name)}`}>
                  {type.name}
                </span>
                {!type.is_seed && (
                  <Sparkles className="w-3 h-3 text-amber-500" title="Evolved type" />
                )}
              </div>
              <span className="text-sm text-gray-500">{type.count}</span>
            </div>
          ))}

          {schemaTypes.length === 0 && (
            <p className="text-sm text-gray-500">No schema types yet</p>
          )}
        </div>
      </div>

      {/* Recent Adaptations */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Adaptations</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {adaptations.slice(0, 10).map((event, i) => (
            <div
              key={i}
              className="text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0"
            >
              <span className="font-medium text-gray-800 capitalize">
                {event.event_type.replace(/_/g, ' ')}
              </span>
              <p className="text-gray-500 truncate">{event.description}</p>
            </div>
          ))}

          {adaptations.length === 0 && (
            <p className="text-xs text-gray-400">No adaptations yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
