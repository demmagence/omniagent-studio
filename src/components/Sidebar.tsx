import React from 'react';
import { graphStore, useGraphStore } from '../store/graphStore';
import { NodeType, NodeCategory, NODE_CATEGORY_MAP, NODE_CATEGORIES, RunHistoryEntry, Node, Edge } from '../types';
import { serializeGraph, deserializeGraph, autoLayout } from '../utils/graphUtils';

const HistoryEntryItem: React.FC<{ run: RunHistoryEntry; isSelected: boolean }> = ({ run, isSelected }) => {
  return (
    <div
      data-testid={`history-entry-${run.id}`}
      onClick={() => {
        if (isSelected) {
          graphStore.selectRun(null);
        } else {
          graphStore.selectRun(run.id);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px',
        borderRadius: '4px',
        backgroundColor: isSelected ? '#374151' : '#1f2937',
        border: isSelected ? '1px solid #3b82f6' : '1px solid #4b5563',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            data-testid={`run-status-dot-${run.id}`}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: run.status === 'success' ? '#10b981' : '#ef4444',
              display: 'inline-block'
            }}
          />
          <span style={{ fontWeight: 'bold' }}>{run.status.toUpperCase()}</span>
        </div>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          {run.nodes.length} nodes
        </span>
      </div>
      <div style={{ fontSize: '10px', color: '#9ca3af', wordBreak: 'break-all' }}>
        {run.timestamp}
      </div>
    </div>
  );
};

const NodePaletteSection: React.FC<{ nodesCount: number; selectedRunId: string | null }> = ({ nodesCount, selectedRunId }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<NodeCategory>('All');

  const nodeTypes: NodeType[] = ['LLM', 'Prompt', 'Tool', 'Router', 'Output', 'VectorDB', 'JSONPath'];

  const getCategoryForType = (type: NodeType): string => {
    return NODE_CATEGORY_MAP[type] || 'All';
  };

  const filteredNodeTypes = nodeTypes.filter((type) => {
    const matchesSearch = type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || getCategoryForType(type) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddNode = (type: NodeType) => {
    if (selectedRunId !== null) return;
    const offset = nodesCount * 40;
    graphStore.addNode(type, { x: 100 + offset, y: 100 + offset });
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Nodes Palette</h4>

      {/* Search Input */}
      <input
        data-testid="node-palette-search"
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search node types..."
        style={{
          width: '100%',
          backgroundColor: '#111827',
          border: '1px solid #374151',
          borderRadius: '4px',
          color: 'white',
          padding: '4px 8px',
          fontSize: '12px',
          marginBottom: '8px',
          boxSizing: 'border-box',
        }}
      />

      {/* Category Filters */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {NODE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '3px 6px',
                fontSize: '10px',
                backgroundColor: isSelected ? '#3b82f6' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: isSelected ? 'bold' : 'normal',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Node Types List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filteredNodeTypes.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '4px' }}>
            No matching node types.
          </div>
        ) : (
          filteredNodeTypes.map((type) => (
            <button
              key={type}
              data-testid={`add-node-${type}`}
              disabled={selectedRunId !== null}
              onClick={() => handleAddNode(type)}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedRunId !== null ? '#4b5563' : '#3b82f6',
                border: 'none',
                borderRadius: '4px',
                color: selectedRunId !== null ? '#9ca3af' : 'white',
                cursor: selectedRunId !== null ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                fontWeight: '500',
                opacity: selectedRunId !== null ? 0.6 : 1
              }}
            >
              + {type} Node
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const LayoutSection: React.FC<{ nodes: Node[]; edges: Edge[]; selectedRunId: string | null }> = ({ nodes, edges, selectedRunId }) => {
  const handleAutoLayout = () => {
    if (selectedRunId !== null) return;
    const positions = autoLayout(nodes, edges);
    positions.forEach((pos, nodeId) => {
      graphStore.updateNodePosition(nodeId, pos);
    });
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Layout</h4>
      <button
        data-testid="auto-layout-btn"
        disabled={selectedRunId !== null}
        onClick={handleAutoLayout}
        style={{
          width: '100%',
          padding: '6px 12px',
          backgroundColor: selectedRunId !== null ? '#4b5563' : '#8b5cf6',
          border: 'none',
          borderRadius: '4px',
          color: selectedRunId !== null ? '#9ca3af' : 'white',
          cursor: selectedRunId !== null ? 'not-allowed' : 'pointer',
          fontWeight: '500',
          opacity: selectedRunId !== null ? 0.6 : 1
        }}
      >
        Auto Layout Graph
      </button>
    </div>
  );
};

const ExecutionControlsSection: React.FC<{ isFallbackMode: boolean; maxConcurrency: number }> = ({ isFallbackMode, maxConcurrency }) => {
  const handleToggleFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    graphStore.setFallbackMode(e.target.checked);
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Execution Controls</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            data-testid="fallback-mode-toggle"
            checked={isFallbackMode}
            onChange={handleToggleFallback}
          />
          Fallback / Simulation Mode
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span>Max Concurrency:</span>
          <input
            type="number"
            min="1"
            max="10"
            data-testid="max-concurrency-input"
            value={maxConcurrency}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10) || 1;
              const clamped = Math.min(10, Math.max(1, parsed));
              graphStore.setMaxConcurrency(clamped);
            }}
            style={{
              width: '50px',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '4px',
              color: 'white',
              padding: '2px 6px',
              fontSize: '12px'
            }}
          />
        </label>
      </div>
    </div>
  );
};

const SerializationSection: React.FC<{ nodes: Node[]; edges: Edge[]; selectedRunId: string | null }> = ({ nodes, edges, selectedRunId }) => {
  const [importJson, setImportJson] = React.useState('');
  const [serializedJson, setSerializedJson] = React.useState('');

  const handleExport = () => {
    const jsonStr = serializeGraph(nodes, edges);
    setSerializedJson(jsonStr);
  };

  const handleImport = () => {
    try {
      const { nodes: newNodes, edges: newEdges } = deserializeGraph(importJson);
      graphStore.setGraph(newNodes, newEdges);
      setImportJson('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    }
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Serialization</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          data-testid="export-btn"
          onClick={handleExport}
          style={{
            padding: '6px 12px',
            backgroundColor: '#10b981',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Export Graph
        </button>
        {serializedJson && (
          <textarea
            data-testid="serialized-output"
            value={serializedJson}
            readOnly
            rows={4}
            style={{
              width: '100%',
              backgroundColor: '#111827',
              color: '#10b981',
              border: '1px solid #374151',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '11px',
              padding: '4px'
            }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
          <textarea
            data-testid="import-input"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste JSON here to import..."
            rows={3}
            disabled={selectedRunId !== null}
            style={{
              width: '100%',
              backgroundColor: '#111827',
              color: selectedRunId !== null ? '#9ca3af' : 'white',
              border: '1px solid #374151',
              borderRadius: '4px',
              fontSize: '11px',
              padding: '4px',
              cursor: selectedRunId !== null ? 'not-allowed' : 'text'
            }}
          />
          <button
            data-testid="import-btn"
            disabled={selectedRunId !== null}
            onClick={handleImport}
            style={{
              padding: '6px 12px',
              backgroundColor: selectedRunId !== null ? '#4b5563' : '#8b5cf6',
              border: 'none',
              borderRadius: '4px',
              color: selectedRunId !== null ? '#9ca3af' : 'white',
              cursor: selectedRunId !== null ? 'not-allowed' : 'pointer',
              opacity: selectedRunId !== null ? 0.6 : 1
            }}
          >
            Import Graph
          </button>
        </div>
      </div>
    </div>
  );
};

const ExecutionHistorySection: React.FC<{ history: RunHistoryEntry[]; selectedRunId: string | null }> = ({ history, selectedRunId }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>Execution History</h4>
        {history.length > 0 && (
          <button
            data-testid="clear-history-btn"
            onClick={() => graphStore.clearHistory()}
            style={{
              fontSize: '11px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div
        data-testid="history-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '180px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
      >
        {history.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>No past runs.</div>
        ) : (
          history.map((run) => {
            const isSelected = selectedRunId === run.id;
            return <HistoryEntryItem key={run.id} run={run} isSelected={isSelected} />;
          })
        )}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { nodes, edges, isFallbackMode, history, selectedRunId, maxConcurrency } = useGraphStore();

  const handleReset = () => {
    graphStore.resetGraph();
  };

  return (
    <div
      data-testid="sidebar"
      style={{
        width: '260px',
        backgroundColor: '#1f2937',
        color: '#f3f4f6',
        padding: '16px',
        borderRight: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img
          src="/logo.png"
          alt="OmniAgent Studio Logo"
          style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }}
        />
        <h3 style={{ margin: 0, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>OmniAgent Studio</h3>
      </div>
      {selectedRunId !== null && (
        <div style={{ padding: '6px', backgroundColor: '#b45309', borderRadius: '4px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>
          Replay Mode Active
        </div>
      )}
      
      <NodePaletteSection nodesCount={nodes.length} selectedRunId={selectedRunId} />

      <LayoutSection nodes={nodes} edges={edges} selectedRunId={selectedRunId} />

      <ExecutionControlsSection isFallbackMode={isFallbackMode} maxConcurrency={maxConcurrency} />

      <SerializationSection nodes={nodes} edges={edges} selectedRunId={selectedRunId} />

      <ExecutionHistorySection history={history} selectedRunId={selectedRunId} />

      <button
        data-testid="reset-btn"
        disabled={selectedRunId !== null}
        onClick={handleReset}
        style={{
          marginTop: 'auto',
          padding: '8px 12px',
          backgroundColor: selectedRunId !== null ? '#4b5563' : '#ef4444',
          border: 'none',
          borderRadius: '4px',
          color: selectedRunId !== null ? '#9ca3af' : 'white',
          cursor: selectedRunId !== null ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          opacity: selectedRunId !== null ? 0.6 : 1
        }}
      >
        Reset Workspace
      </button>
    </div>
  );
};
