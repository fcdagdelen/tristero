import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, RefreshCw, AlertCircle, Search, PenLine, FolderOpen, X, ChevronDown, ChevronUp, Activity, Zap, Database, GitBranch } from 'lucide-react';
import { GraphVisualization, TraversalPanel } from './components';
import { useGraph } from './hooks/useGraph';
import type { QueryResult } from './types';

function App() {
  const {
    graphData,
    state,
    adaptations,
    loading,
    error,
    addNote,
    query,
    refresh,
    importProgress,
    startImport,
    traversalState,
  } = useGraph();

  const [graphDimensions, setGraphDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Panel states
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showQueryPanel, setShowQueryPanel] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);

  // Query result state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryText, setQueryText] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [importPath, setImportPath] = useState('/Users/cemdagdelen/Desktop/Active/Tlon');

  // Update graph dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      setGraphDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleQuery = useCallback(async () => {
    if (!queryText.trim()) return;
    try {
      const result = await query(queryText);
      setQueryResult(result);
    } catch (err) {
      console.error(err);
    }
  }, [query, queryText]);

  const handleAddNote = useCallback(async () => {
    if (!noteContent.trim()) return;
    try {
      await addNote(noteContent, noteTitle || undefined);
      setNoteContent('');
      setNoteTitle('');
      setShowNoteInput(false);
    } catch (err) {
      console.error(err);
    }
  }, [addNote, noteContent, noteTitle]);

  const handleImport = useCallback(async () => {
    if (!importPath.trim()) return;
    try {
      await startImport(importPath, true);
      setShowImportModal(false);
    } catch (err) {
      console.error(err);
    }
  }, [startImport, importPath]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Initializing Knowledge Graph</p>
          <p className="text-sm text-slate-500 mt-2">Loading models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-slate-200 font-medium text-lg">Connection Error</p>
          <p className="text-slate-400 mt-2">{error}</p>
          <div className="mt-6 text-left bg-slate-800 rounded-lg p-4 text-sm font-mono border border-slate-700">
            <p className="text-slate-300">Start the backend:</p>
            <pre className="mt-2 text-slate-500">
              cd backend{'\n'}
              source venv/bin/activate{'\n'}
              python run.py
            </pre>
          </div>
          <button
            onClick={refresh}
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-2 mx-auto transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-900 overflow-hidden relative">
      {/* Full-screen Graph */}
      <div ref={graphContainerRef} className="absolute inset-0">
        <GraphVisualization
          data={graphData}
          width={graphDimensions.width}
          height={graphDimensions.height}
          traversalState={traversalState}
        />
      </div>

      {/* Traversal Side Panel */}
      <TraversalPanel traversalState={traversalState} />

      {/* Top Bar - Title and Actions */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-3 border border-slate-700/50">
            <Brain className="w-6 h-6 text-blue-400" />
            <span className="text-slate-200 font-medium">Tristero</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowQueryPanel(!showQueryPanel)}
            className={`p-2.5 rounded-lg transition-colors ${showQueryPanel ? 'bg-blue-600 text-white' : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'} backdrop-blur-sm border border-slate-700/50`}
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowNoteInput(!showNoteInput)}
            className={`p-2.5 rounded-lg transition-colors ${showNoteInput ? 'bg-green-600 text-white' : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'} backdrop-blur-sm border border-slate-700/50`}
            title="Add Note"
          >
            <PenLine className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="p-2.5 rounded-lg bg-slate-800/90 text-slate-300 hover:bg-slate-700 backdrop-blur-sm border border-slate-700/50 transition-colors"
            title="Import Obsidian Vault"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <button
            onClick={refresh}
            className="p-2.5 rounded-lg bg-slate-800/90 text-slate-300 hover:bg-slate-700 backdrop-blur-sm border border-slate-700/50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Query Panel - Top Center */}
      {showQueryPanel && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xl p-4 z-20">
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                  placeholder="Ask anything about your knowledge..."
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  onClick={handleQuery}
                  className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
                >
                  Search
                </button>
              </div>
            </div>
            {queryResult && (
              <div className="border-t border-slate-700/50 p-4 max-h-64 overflow-y-auto">
                {queryResult.response && (
                  <div className="text-slate-300 text-sm leading-relaxed mb-3">
                    {queryResult.response}
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {queryResult.latency_ms.toFixed(0)}ms
                  </span>
                  <span>{queryResult.nodes.length} nodes found</span>
                  {queryResult.used_llm && (
                    <span className="text-purple-400">LLM enhanced</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note Input Panel - Slide from right */}
      {showNoteInput && (
        <div className="absolute top-20 right-4 w-96 z-20">
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <span className="text-slate-200 font-medium">Add Note</span>
              <button onClick={() => setShowNoteInput(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm"
              />
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your note... Entities will be extracted automatically."
                rows={6}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={!noteContent.trim()}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Graph
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Panel - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full px-4 py-2 flex items-center justify-between text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Activity className="w-4 h-4" />
              Statistics
            </span>
            {showStats ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {showStats && state && (
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-400">{state.node_count}</div>
                  <div className="text-xs text-slate-500">Nodes</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-400">{state.edge_count}</div>
                  <div className="text-xs text-slate-500">Edges</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-400">{state.total_queries}</div>
                  <div className="text-xs text-slate-500">Queries</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-amber-400">{state.avg_latency_ms.toFixed(0)}ms</div>
                  <div className="text-xs text-slate-500">Avg Latency</div>
                </div>
              </div>
              {/* Schema Types */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Schema Types</div>
                <div className="flex flex-wrap gap-1">
                  {state.schema_types.slice(0, 8).map((t) => (
                    <span
                      key={t.name}
                      className={`text-xs px-2 py-1 rounded-full ${
                        t.is_seed ? 'bg-slate-600/50 text-slate-300' : 'bg-purple-600/30 text-purple-300'
                      }`}
                    >
                      {t.name} ({t.count})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full px-4 py-2 flex items-center justify-between text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="w-4 h-4" />
              Legend
            </span>
            {showLegend ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {showLegend && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-xs text-slate-400">Note</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-xs text-slate-400">Person</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-xs text-slate-400">Place</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span className="text-xs text-slate-400">Thing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-500"></span>
                <span className="text-xs text-slate-400">Concept</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                <span className="text-xs text-slate-400">Project</span>
              </div>
              <div className="border-t border-slate-700/50 pt-2 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-xs text-slate-400">Query Match</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Adaptations - Bottom Center */}
      {adaptations.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700/50 max-w-md">
            <div className="text-xs text-slate-400 truncate">
              <span className="text-purple-400 mr-2">Latest:</span>
              {adaptations[0]?.description}
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Overlay - Full width banner at top */}
      {importProgress && (
        <div className="absolute top-16 left-4 right-4 z-30">
          <div className="bg-gradient-to-r from-blue-900/95 via-slate-800/95 to-blue-900/95 backdrop-blur-sm rounded-xl border border-blue-500/30 shadow-2xl overflow-hidden">
            {/* Main progress section */}
            <div className="p-5">
              <div className="flex items-center justify-between gap-6">
                {/* Left side - status */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Database className={`w-8 h-8 text-blue-400 ${importProgress.status !== 'completed' ? 'animate-pulse' : ''}`} />
                    {importProgress.status !== 'completed' && (
                      <div className="absolute inset-0 w-8 h-8 bg-blue-400/30 rounded-full animate-pulse-ring" />
                    )}
                  </div>
                  <div>
                    <div className="text-slate-200 font-medium text-lg">
                      {importProgress.status === 'completed'
                        ? 'Import Complete!'
                        : 'Importing Obsidian Vault'}
                    </div>
                    <div className="text-blue-300 text-sm max-w-xs truncate">
                      {importProgress.status === 'completed'
                        ? `Successfully imported ${importProgress.imported} notes`
                        : `Processing: ${importProgress.file || 'Initializing...'}`}
                    </div>
                  </div>
                </div>

                {/* Center - progress bar */}
                <div className="flex-1 max-w-md">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Notes imported</span>
                    <span className="text-blue-300 font-mono">{importProgress.imported} / {importProgress.total}</span>
                  </div>
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 ease-out relative overflow-hidden"
                      style={{ width: `${Math.max((importProgress.current / importProgress.total) * 100, 2)}%` }}
                    >
                      {importProgress.status !== 'completed' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                      )}
                    </div>
                  </div>
                  {/* Percentage indicator */}
                  <div className="text-center text-xs text-slate-500 mt-1">
                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                  </div>
                </div>

                {/* Right side - live stats */}
                <div className="flex items-center gap-4">
                  <div className="text-center px-3 py-1 bg-slate-700/50 rounded-lg min-w-[70px]">
                    <div className="text-xl font-bold text-blue-400 tabular-nums">{state?.node_count || 0}</div>
                    <div className="text-xs text-slate-500">Nodes</div>
                  </div>
                  <div className="text-center px-3 py-1 bg-slate-700/50 rounded-lg min-w-[70px]">
                    <div className="text-xl font-bold text-green-400 tabular-nums">{state?.edge_count || 0}</div>
                    <div className="text-xs text-slate-500">Edges</div>
                  </div>
                  {importProgress.status === 'completed' && (
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium transition-colors"
                    >
                      Refresh View
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live activity feed - shows what's happening in real-time */}
            {importProgress.status !== 'completed' && (
              <div className="border-t border-blue-500/20 bg-slate-900/50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Activity className="w-3 h-3 text-green-400 animate-pulse" />
                    <span>Live:</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded text-xs text-blue-300 animate-slide-up">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Extracting entities...
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded text-xs text-green-300 animate-slide-up">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      Building connections...
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 rounded text-xs text-purple-300 animate-slide-up">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      Embedding vectors...
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    ~{Math.max(1, Math.round((importProgress.total - importProgress.current) * 0.5))}s remaining
                  </div>
                </div>
              </div>
            )}

            {/* Completion summary */}
            {importProgress.status === 'completed' && (
              <div className="border-t border-green-500/20 bg-green-900/20 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <Zap className="w-3 h-3" />
                    <span>Complete!</span>
                  </div>
                  <div className="flex-1 text-xs text-slate-400">
                    {importProgress.imported} notes processed • {state?.node_count || 0} total nodes • {state?.edge_count || 0} connections created
                  </div>
                  {importProgress.errors && importProgress.errors.length > 0 && (
                    <div className="text-xs text-amber-400">
                      {importProgress.errors.length} files skipped
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md m-4">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <span className="text-slate-200 font-medium">Import Obsidian Vault</span>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Vault Path</label>
                <input
                  type="text"
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  placeholder="/path/to/your/vault"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-amber-300 text-sm">
                  This will clear existing data and import all markdown files from the vault.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
                >
                  Start Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
