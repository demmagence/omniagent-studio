import React from 'react';
import { Node as NodeType, TraceStep } from '../types';
import { graphStore, useGraphStore } from '../store/graphStore';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  allNodes: NodeType[];
  nodeTrace?: TraceStep;
  onStartDrag?: (nodeId: string, e: React.MouseEvent) => void;
  onPortMouseDown?: (nodeId: string, portType: 'in' | 'out', e: React.MouseEvent) => void;
}

export const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  allNodes,
  nodeTrace,
  onStartDrag,
  onPortMouseDown
}) => {
  const { selectedRunId } = useGraphStore();
  const isReplayMode = selectedRunId !== null;
  const [targetId, setTargetId] = React.useState('');

  const nodeStatus = nodeTrace ? nodeTrace.status : null;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    graphStore.selectNode(node.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReplayMode) return;
    graphStore.removeNode(node.id);
  };

  const handleConnect = () => {
    if (isReplayMode) return;
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
      onMouseDown={(e) => onStartDrag?.(node.id, e)}
      onClick={handleSelect}
      style={{
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: '200px',
        height: '120px',
        border:
          nodeStatus === 'running'
            ? '2px solid #f59e0b'
            : nodeStatus === 'completed'
            ? '2px solid #10b981'
            : nodeStatus === 'failed'
            ? '2px solid #ef4444'
            : isSelected
            ? '2px solid #3b82f6'
            : '1px solid #4b5563',
        boxShadow:
          nodeStatus === 'running'
            ? '0 0 10px #f59e0b'
            : nodeStatus === 'completed'
            ? '0 0 10px #10b981'
            : nodeStatus === 'failed'
            ? '0 0 10px #ef4444'
            : 'none',
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: '#1f2937',
        color: '#f3f4f6',
        cursor: isReplayMode ? 'default' : 'move',
        boxSizing: 'border-box',
        zIndex: isSelected ? 5 : 2,
        pointerEvents: 'auto'
      }}
    >
      {/* Input Port (Left) */}
      <div
        data-testid={`port-in-${node.id}`}
        data-port-node-id={node.id}
        data-port-type="in"
        className="port-input"
        onMouseDown={(e) => {
          if (isReplayMode) return;
          onPortMouseDown?.(node.id, 'in', e);
        }}
        style={{
          position: 'absolute',
          left: '-8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: isReplayMode ? '#4b5563' : '#3b82f6',
          border: '3px solid #111827',
          cursor: isReplayMode ? 'not-allowed' : 'crosshair',
          zIndex: 10,
          opacity: isReplayMode ? 0.5 : 1
        }}
        title="Input Port (Drag to connect)"
      />

      {/* Output Port (Right) */}
      <div
        data-testid={`port-out-${node.id}`}
        data-port-node-id={node.id}
        data-port-type="out"
        className="port-output"
        onMouseDown={(e) => {
          if (isReplayMode) return;
          onPortMouseDown?.(node.id, 'out', e);
        }}
        style={{
          position: 'absolute',
          right: '-8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: isReplayMode ? '#4b5563' : '#10b981',
          border: '3px solid #111827',
          cursor: isReplayMode ? 'not-allowed' : 'crosshair',
          zIndex: 10,
          opacity: isReplayMode ? 0.5 : 1
        }}
        title="Output Port (Drag to connect)"
      />

      <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', userSelect: 'none' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
          {labelText}
        </span>
        <button
          disabled={isReplayMode}
          onClick={handleDelete}
          data-testid={`delete-node-${node.id}`}
          style={{
            background: isReplayMode ? '#4b5563' : '#ef4444',
            color: isReplayMode ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isReplayMode ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            padding: '2px 6px',
            zIndex: 11,
            opacity: isReplayMode ? 0.6 : 1
          }}
        >
          X
        </button>
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af', userSelect: 'none' }}>Type: {node.type}</div>
      
      <div
        data-testid={`node-status-${node.id}`}
        style={{
          marginTop: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          color:
            nodeStatus === 'completed'
              ? '#10b981'
              : nodeStatus === 'failed'
              ? '#ef4444'
              : nodeStatus === 'running'
              ? '#f59e0b'
              : '#9ca3af',
          textTransform: 'uppercase'
        }}
      >
        {nodeStatus || 'pending'}
      </div>

      <div style={{ marginTop: '12px', display: 'flex', gap: '4px' }}>
        <select
          disabled={isReplayMode}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          data-testid={`connect-select-${node.id}`}
          style={{
            backgroundColor: '#374151',
            color: isReplayMode ? '#9ca3af' : 'white',
            border: '1px solid #4b5563',
            borderRadius: '4px',
            fontSize: '10px',
            width: '110px',
            cursor: isReplayMode ? 'not-allowed' : 'default'
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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
          disabled={isReplayMode}
          onClick={(e) => {
            e.stopPropagation();
            handleConnect();
          }}
          data-testid={`connect-btn-${node.id}`}
          style={{
            backgroundColor: isReplayMode ? '#4b5563' : '#10b981',
            color: isReplayMode ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isReplayMode ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            padding: '2px 6px',
            flex: 1,
            opacity: isReplayMode ? 0.6 : 1
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          +
        </button>
      </div>
    </div>
  );
};
