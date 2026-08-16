import React from 'react';
import { useGraphStore, graphStore } from '../store/graphStore';
import { Node, Edge } from '../types';

interface ConnectionsPanelProps {
  edges: Edge[];
  nodeMap: Record<string, Node>;
}

export const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({ edges, nodeMap }) => {
  const { selectedRunId } = useGraphStore();

  const handleRemoveEdge = (edgeId: string) => {
    if (selectedRunId !== null) return;
    graphStore.removeEdge(edgeId);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        right: '16px',
        zIndex: 10,
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #374151',
        maxHeight: '150px',
        overflowY: 'auto'
      }}
    >
      <h4 style={{ color: '#9ca3af', margin: '0 0 8px 0' }}>Connections (Edges)</h4>
      {edges.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '12px' }}>No connections yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {edges.map((edge) => {
            const srcNode = nodeMap[edge.source];
            const tgtNode = nodeMap[edge.target];
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
                  backgroundColor: '#111827',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  color: '#e5e7eb',
                  fontSize: '12px'
                }}
              >
                <span>{srcLabel} → {tgtLabel}</span>
                <button
                  disabled={selectedRunId !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveEdge(edge.id);
                  }}
                  data-testid={`delete-edge-${edge.id}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: selectedRunId !== null ? '#4b5563' : '#ef4444',
                    cursor: selectedRunId !== null ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    opacity: selectedRunId !== null ? 0.5 : 1
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
