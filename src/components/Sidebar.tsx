import React from 'react';
import { graphStore, useGraphStore } from '../store/graphStore';
import { NodeType } from '../types';
import { serializeGraph, deserializeGraph } from '../utils/graphUtils';

export const Sidebar: React.FC = () => {
  const { nodes, edges, isFallbackMode } = useGraphStore();
  const [importJson, setImportJson] = React.useState('');
  const [serializedJson, setSerializedJson] = React.useState('');

  const nodeTypes: NodeType[] = ['LLM', 'Prompt', 'Tool', 'Router', 'Output'];

  const handleAddNode = (type: NodeType) => {
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
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Nodes Palette</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {nodeTypes.map((type) => (
            <button
              key={type}
              data-testid={`add-node-${type}`}
              onClick={() => handleAddNode(type)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#3b82f6',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: '500'
              }}
            >
              + {type} Node
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9ca3af' }}>Execution Controls</h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            data-testid="fallback-mode-toggle"
            checked={isFallbackMode}
            onChange={handleToggleFallback}
          />
          Fallback / Simulation Mode
        </label>
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
              style={{
                width: '100%',
                backgroundColor: '#111827',
                color: 'white',
                border: '1px solid #374151',
                borderRadius: '4px',
                fontSize: '11px',
                padding: '4px'
              }}
            />
            <button
              data-testid="import-btn"
              onClick={handleImport}
              style={{
                padding: '6px 12px',
                backgroundColor: '#8b5cf6',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Import Graph
            </button>
          </div>
        </div>
      </div>

      <button
        data-testid="reset-btn"
        onClick={handleReset}
        style={{
          marginTop: 'auto',
          padding: '8px 12px',
          backgroundColor: '#ef4444',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Reset Workspace
      </button>
    </div>
  );
};
