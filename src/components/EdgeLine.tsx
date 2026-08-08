import React from 'react';
import type { Node, Edge } from '../types';

interface EdgeLineProps {
  edge: Edge;
  srcNode: Node;
  tgtNode: Node;
  status: 'running' | 'completed' | 'failed' | null;
  getBezierPath: (x1: number, y1: number, x2: number, y2: number) => string;
}

export const EdgeLine: React.FC<EdgeLineProps> = ({
  edge,
  srcNode,
  tgtNode,
  status,
  getBezierPath
}) => {
  const x1 = srcNode.position.x + 200;
  const y1 = srcNode.position.y + 60;
  const x2 = tgtNode.position.x;
  const y2 = tgtNode.position.y + 60;

  let strokeColor = '#4b5563';
  let className = '';

  if (status === 'running') {
    strokeColor = '#3b82f6';
    className = 'edge-flow-running';
  } else if (status === 'completed') {
    strokeColor = '#10b981';
    className = 'edge-pulse-completed';
  } else if (status === 'failed') {
    strokeColor = '#ef4444';
  }

  const bezierPath = getBezierPath(x1, y1, x2, y2);

  return (
    <g data-testid={`edge-group-${edge.id}`}>
      <path
        d={bezierPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={5}
        opacity={status === 'running' ? 0.3 : 0.15}
      />
      <path
        d={bezierPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        className={className}
        style={{ transition: 'stroke 0.3s ease' }}
      />
    </g>
  );
};
