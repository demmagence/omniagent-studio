import React from 'react';
import { Node as NodeType } from '../types';
import { graphStore } from '../store/graphStore';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  allNodes: NodeType[];
}

export const Node: React.FC<NodeProps> = ({ node, isSelected, allNodes }) => {
  const [targetId, setTargetId] = React.useState('');

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    graphStore.selectNode(node.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    graphStore.removeNode(node.id);
  };

  const handleConnect = () => {
    if (targetId) {
      graphStore.addEdge(node.id, targetId);
      setTargetId('');
    }
  };

  const labelText = node.data.label || node.data.type;

  return (
    <div
      data-testid={`node-item-${node.id}`}
      data-testid-type={`node-${node.type}`}
      onClick={handleSelect}
      style={{
        border: isSelected ? '2px solid #3b82f6' : '1px solid #4b5563',
        padding: '12px',
        margin: '8px',
        borderRadius: '8px',
        backgroundColor: '#1f2937',
        color: '#f3f4f6',
        cursor: 'pointer',
        position: 'relative',
        minWidth: '150px'
      }}
    >
      <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
        <span>{labelText}</span>
        <button
          onClick={handleDelete}
          data-testid={`delete-node-${node.id}`}
          style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px' }}
        >
          X
        </button>
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af' }}>Type: {node.type}</div>
      
      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          data-testid={`connect-select-${node.id}`}
          style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', fontSize: '10px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Connect to...</option>
          {allNodes
            .filter((n) => n.id !== node.id)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.data.label || n.id}
              </option>
            ))}
        </select>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleConnect();
          }}
          data-testid={`connect-btn-${node.id}`}
          style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px' }}
        >
          +
        </button>
      </div>
    </div>
  );
};
