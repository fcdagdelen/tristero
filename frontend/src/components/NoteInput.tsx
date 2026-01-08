import { useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';

interface Props {
  onSubmit: (content: string, title?: string) => Promise<void>;
}

export function NoteInput({ onSubmit }: Props) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      await onSubmit(content.trim(), title.trim() || undefined);
      setContent('');
      setTitle('');
      setExpanded(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <form onSubmit={handleSubmit}>
        {expanded && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-3 py-2 mb-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        )}

        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Add a note... (thoughts, ideas, bookmarks)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            rows={expanded ? 3 : 1}
          />

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4" />
            )}
            Add
          </button>
        </div>

        {expanded && (
          <p className="mt-2 text-xs text-gray-500">
            Entities will be automatically extracted and linked
          </p>
        )}
      </form>
    </div>
  );
}
