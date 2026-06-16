import React from 'react';
import { useGraphStore, graphStore } from '../store/graphStore';
import { Node } from './Node';

export const Canvas: React.FC = () => {
  const { nodes, edges, selectedNodeId } = useGraphStore();

  const handleCanvasClick = () => {
    graphStore.selectNode(null);
  };

  const handleRemoveEdge = (edgeId: string) => {
    graphStore.removeEdge(edgeId);
  };

  return (
    <div
      data-testid="canvas"
      onClick={handleCanvasClick}
      style={{
        flex: 1,
        backgroundColor: '#111827',
        position: 'relative',
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px',
        border: '1px dashed #374151'
      }}
    >
      <h3 style={{ color: '#f3f4f6', margin: '0 0 12px 0' }}>Workspace Canvas</h3>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            allNodes={nodes}
          />
        ))}
      </div>

      <div style={{ marginTop: '24px', borderTop: '1px solid #374151', paddingTop: '16px' }}>
        <h4 style={{ color: '#9ca3af', margin: '0 0 8px 0' }}>Connections (Edges)</h4>
        {edges.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '12px' }}>No connections yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {edges.map((edge) => {
              const srcNode = nodes.find(n => n.id === edge.source);
              const tgtNode = nodes.find(n => n.id === edge.target);
              const srcLabel = srcNode?.data.label || edge.source;
              const tgtLabel = tgtNode?.data.label || edge.target;
              return (
                <li
                  key={edge.id}
                  data-testid={`edge-item-${edge.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#1f2937',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    color: '#e5e7eb',
                    fontSize: '12px'
                  }}
                >
                  <span>{srcLabel} → {tgtLabel}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveEdge(edge.id);
                    }}
                    data-testid={`delete-edge-${edge.id}`}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
