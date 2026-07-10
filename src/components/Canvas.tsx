import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGraphStore, graphStore } from '../store/graphStore';
import { Node } from './Node';

export const Canvas: React.FC = () => {
  const { nodes, edges, selectedNodeId, selectedRunId, canUndo, canRedo, traceSteps } = useGraphStore();
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const traceMap = useMemo(() => new Map(traceSteps.map(t => [t.nodeId, t])), [traceSteps]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeConnection, setActiveConnection] = useState<{
    nodeId: string;
    portType: 'in' | 'out';
    currentX: number;
    currentY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || activeEl.isContentEditable) {
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (selectedRunId === null) {
          if (e.shiftKey) {
            graphStore.redo();
          } else {
            graphStore.undo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (selectedRunId === null) {
          graphStore.redo();
        }
      } else if (e.key === 'Escape') {
        graphStore.selectNode(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && selectedRunId === null) {
        graphStore.removeNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, selectedRunId]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = 1.05;
      const nextZoom = e.deltaY < 0 
        ? Math.min(3, zoomRef.current * zoomFactor)
        : Math.max(0.1, zoomRef.current / zoomFactor);

      const dx = mouseX - panRef.current.x;
      const dy = mouseY - panRef.current.y;
      const scaleChange = nextZoom / zoomRef.current;

      setPan({
        x: mouseX - dx * scaleChange,
        y: mouseY - dy * scaleChange
      });
      setZoom(nextZoom);
    };

    canvasEl.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-testid^="node-item-"]') ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('.port-input') ||
      target.closest('.port-output')
    ) {
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const initPanX = panRef.current.x;
    const initPanY = panRef.current.y;
    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasMoved = true;
      }
      setPan({ x: initPanX + dx, y: initPanY + dy });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      if (!hasMoved) {
        graphStore.selectNode(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startDragNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    graphStore.selectNode(nodeId);

    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'OPTION' ||
      target.closest('.port-input') ||
      target.closest('.port-output')
    ) {
      return;
    }

    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const targetNode = nodeMap.get(nodeId);
    if (!targetNode) return;
    const initialNodeX = targetNode.position.x;
    const initialNodeY = targetNode.position.y;

    let savedState = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const z = zoomRef.current;
      const dx = (moveEvent.clientX - initialMouseX) / z;
      const dy = (moveEvent.clientY - initialMouseY) / z;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (!savedState) {
          graphStore.saveHistoryState();
          savedState = true;
        }
      }
      graphStore.updateNodePosition(nodeId, {
        x: initialNodeX + dx,
        y: initialNodeY + dy,
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startConnect = (nodeId: string, portType: 'in' | 'out', e: React.MouseEvent) => {
    if (selectedRunId !== null) return;
    e.stopPropagation();
    e.preventDefault();

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    
    const z = zoomRef.current;
    const p = panRef.current;
    
    const initX = (e.clientX - rect.left - p.x) / z;
    const initY = (e.clientY - rect.top - p.y) / z;

    setActiveConnection({
      nodeId,
      portType,
      currentX: initX,
      currentY: initY,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const canvasElLatest = canvasRef.current;
      if (!canvasElLatest) return;
      const r = canvasElLatest.getBoundingClientRect();
      const zLatest = zoomRef.current;
      const pLatest = panRef.current;
      
      const currX = (moveEvent.clientX - r.left - pLatest.x) / zLatest;
      const currY = (moveEvent.clientY - r.top - pLatest.y) / zLatest;
      
      setActiveConnection({
        nodeId,
        portType,
        currentX: currX,
        currentY: currY,
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const portElement = element?.closest('[data-port-node-id]');
      if (portElement) {
        const targetNodeId = portElement.getAttribute('data-port-node-id');
        const targetPortType = portElement.getAttribute('data-port-type');
        if (targetNodeId && targetPortType && targetNodeId !== nodeId) {
          if (portType === 'out' && targetPortType === 'in') {
            graphStore.addEdge(nodeId, targetNodeId);
          } else if (portType === 'in' && targetPortType === 'out') {
            graphStore.addEdge(targetNodeId, nodeId);
          }
        }
      }
      setActiveConnection(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const cx1 = x1 + Math.max(50, dx / 2);
    const cy1 = y1;
    const cx2 = x2 - Math.max(50, dx / 2);
    const cy2 = y2;
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, z * 1.15));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.1, z / 1.15));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    if (nodes.length === 0) {
      handleResetView();
      return;
    }
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + 200);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + 120);
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const padding = 40;
    const paddedGraphWidth = graphWidth + padding * 2;
    const paddedGraphHeight = graphHeight + padding * 2;

    const zoomX = width / paddedGraphWidth;
    const zoomY = height / paddedGraphHeight;
    const nextZoom = Math.max(0.1, Math.min(1.5, Math.min(zoomX, zoomY)));

    const nextPanX = (width - graphWidth * nextZoom) / 2 - minX * nextZoom;
    const nextPanY = (height - graphHeight * nextZoom) / 2 - minY * nextZoom;

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  const handleRemoveEdge = (edgeId: string) => {
    if (selectedRunId !== null) return;
    graphStore.removeEdge(edgeId);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute('data-testid') === 'canvas') {
      graphStore.selectNode(null);
    }
  };

  return (
    <div
      ref={canvasRef}
      data-testid="canvas"
      onMouseDown={handleCanvasMouseDown}
      onClick={handleCanvasClick}
      style={{
        flex: 1,
        backgroundColor: '#111827',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '500px',
        border: '1px dashed #374151',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none'
      }}
    >
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, pointerEvents: 'none' }}>
        <h3 style={{ color: '#f3f4f6', margin: 0 }}>Workspace Canvas</h3>
        <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '11px' }}>
          Drag Canvas to Pan. Scroll Wheel to Zoom ({Math.round(zoom * 100)}%). Drag ports to Connect.
        </p>
      </div>

      {/* Floating Workspace Controls Overlay */}
      <div
        data-testid="workspace-controls-panel"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          backgroundColor: 'rgba(31, 41, 55, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(75, 85, 99, 0.5)',
          borderRadius: '8px',
          padding: '6px 10px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
          alignItems: 'center',
        }}
      >
        {/* Zoom Controls */}
        <button
          data-testid="zoom-in-btn"
          onClick={handleZoomIn}
          title="Zoom In"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f3f4f6',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          ➕
        </button>
        <button
          data-testid="zoom-out-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f3f4f6',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          ➖
        </button>
        <button
          data-testid="reset-view-btn"
          onClick={handleResetView}
          title="Reset View (100%)"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f3f4f6',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            fontWeight: 'bold',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          100%
        </button>
        <button
          data-testid="fit-view-btn"
          onClick={handleFitToScreen}
          title="Fit to Screen"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f3f4f6',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            fontWeight: 'bold',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Fit
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: '#4b5563', margin: '0 4px' }} />

        {/* Undo / Redo */}
        <button
          data-testid="undo-btn"
          onClick={() => graphStore.undo()}
          disabled={!canUndo || selectedRunId !== null}
          title="Undo (Ctrl+Z)"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: canUndo && selectedRunId === null ? '#3b82f6' : '#4b5563',
            fontSize: '12px',
            cursor: canUndo && selectedRunId === null ? 'pointer' : 'not-allowed',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s, color 0.2s',
            fontWeight: 'bold',
            opacity: canUndo && selectedRunId === null ? 1 : 0.4,
          }}
          onMouseOver={(e) => {
            if (canUndo && selectedRunId === null) {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            }
          }}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          ↶ Undo
        </button>
        <button
          data-testid="redo-btn"
          onClick={() => graphStore.redo()}
          disabled={!canRedo || selectedRunId !== null}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: canRedo && selectedRunId === null ? '#10b981' : '#4b5563',
            fontSize: '12px',
            cursor: canRedo && selectedRunId === null ? 'pointer' : 'not-allowed',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s, color 0.2s',
            fontWeight: 'bold',
            opacity: canRedo && selectedRunId === null ? 1 : 0.4,
          }}
          onMouseOver={(e) => {
            if (canRedo && selectedRunId === null) {
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
            }
          }}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Redo ↷
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none'
        }}
      >
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none'
          }}
        >
          {edges.map((edge) => {
            const srcNode = nodeMap.get(edge.source);
            const tgtNode = nodeMap.get(edge.target);
            if (!srcNode || !tgtNode) return null;

            const x1 = srcNode.position.x + 200;
            const y1 = srcNode.position.y + 60;
            const x2 = tgtNode.position.x;
            const y2 = tgtNode.position.y + 60;

            const trace = traceMap.get(srcNode.id);
            const status = trace ? trace.status : null;

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

            return (
              <g key={edge.id} data-testid={`edge-group-${edge.id}`}>
                <path
                  d={getBezierPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={5}
                  opacity={status === 'running' ? 0.3 : 0.15}
                />
                <path
                  d={getBezierPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={3}
                  className={className}
                  style={{ transition: 'stroke 0.3s ease' }}
                />
              </g>
            );
          })}

          {activeConnection && (() => {
            const srcNode = nodeMap.get(activeConnection.nodeId);
            if (!srcNode) return null;

            let x1, y1, x2, y2;
            if (activeConnection.portType === 'out') {
              x1 = srcNode.position.x + 200;
              y1 = srcNode.position.y + 60;
              x2 = activeConnection.currentX;
              y2 = activeConnection.currentY;
            } else {
              x1 = activeConnection.currentX;
              y1 = activeConnection.currentY;
              x2 = srcNode.position.x;
              y2 = srcNode.position.y + 60;
            }

            return (
              <path
                d={getBezierPath(x1, y1, x2, y2)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={3}
                strokeDasharray="4 4"
              />
            );
          })()}
        </svg>

        {nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            allNodes={nodes}
            onStartDrag={startDragNode}
            onPortMouseDown={startConnect}
          />
        ))}
      </div>

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
              const srcNode = nodeMap.get(edge.source);
              const tgtNode = nodeMap.get(edge.target);
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
    </div>
  );
};

