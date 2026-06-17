import React from 'react';
import { graphStore, useGraphStore } from '../store/graphStore';
import { NodeType } from '../types';
import { serializeGraph, deserializeGraph, autoLayout } from '../utils/graphUtils';

export const Sidebar: React.FC = () => {
  const { nodes, edges, isFallbackMode, history, selectedRunId, maxConcurrency } = useGraphStore();
  const [importJson, setImportJson] = React.useState('');
  const [serializedJson, setSerializedJson] = React.useState('');

  const nodeTypes: NodeType[] = ['LLM', 'Prompt', 'Tool', 'Router', 'Output', 'VectorDB', 'JSONPath'];

  const handleAddNode = (type: NodeType) => {
    if (selectedRunId !== null) return;
    const offset = nodes.length * 40;
    graphStore.addNode(type, { x: 100 + offset, y: 100 + offset });
  };

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

  const handleReset = () => {
    graphStore.resetGraph();
    setSerializedJson('');
    setImportJson('');
  };

  const handleToggleFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    graphStore.setFallbackMode(e.target.checked);
  };

  const handleAutoLayout = () => {
    if (selectedRunId !== null) return;
    const positions = autoLayout(nodes, edges);
    positions.forEach((pos, nodeId) => {
      graphStore.updateNodePosition(nodeId, pos);
    });
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
      <h3 style={{ margin: 0 }}>OmniAgent Studio</h3>
      {selectedRunId !== null && (
        <div style={{ padding: '6px', backgroundColor: '#b45309', borderRadius: '4px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>
          Replay Mode Active
        </div>
      )}
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Nodes Palette</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {nodeTypes.map((type) => (
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
          ))}
        </div>
      </div>

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
              onChange={(e) => graphStore.setMaxConcurrency(parseInt(e.target.value, 10) || 1)}
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
              return (
                <div
                  key={run.id}
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
            })
          )}
        </div>
      </div>

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
