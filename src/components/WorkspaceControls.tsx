import React from 'react';
import { useGraphStore, graphStore } from '../store/graphStore';

interface WorkspaceControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToScreen: () => void;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToScreen
}) => {
  const { canUndo, canRedo, selectedRunId } = useGraphStore();

  return (
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
      <button
        data-testid="zoom-in-btn"
        onClick={onZoomIn}
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
        onClick={onZoomOut}
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
        onClick={onResetView}
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
        onClick={onFitToScreen}
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

      <div style={{ width: '1px', height: '18px', backgroundColor: '#4b5563', margin: '0 4px' }} />

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
  );
};
