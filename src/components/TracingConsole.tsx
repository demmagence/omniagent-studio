import React from 'react';
import { useGraphStore } from '../store/graphStore';
import { executeWorkflow } from '../services/executor';

export const TracingConsole: React.FC = () => {
  const { traceSteps, isRunning, nodes } = useGraphStore();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleRun = async () => {
    setErrorMsg(null);
    try {
      await executeWorkflow();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const totalTokens = traceSteps.reduce((acc, step) => acc + (step.tokensConsumed || 0), 0);

  return (
    <div
      data-testid="tracing-console"
      style={{
        backgroundColor: '#1f2937',
        color: '#f3f4f6',
        padding: '16px',
        borderTop: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '15px' }}>Execution Tracing Console</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>
            Total Tokens: <strong style={{ color: '#60a5fa' }} data-testid="total-tokens">{totalTokens}</strong>
          </span>
          <button
            data-testid="run-workflow-btn"
            disabled={isRunning || nodes.length === 0}
            onClick={handleRun}
            style={{
              padding: '6px 16px',
              backgroundColor: isRunning ? '#4b5563' : '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: isRunning || nodes.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isRunning ? 'Running...' : 'Run Workflow'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          data-testid="execution-error"
          style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: '4px', fontSize: '13px' }}
        >
          <strong>Error: </strong>{errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {traceSteps.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>No trace steps. Hit "Run Workflow" to execute.</p>
        ) : (
          traceSteps.map((step) => {
            const node = nodes.find(n => n.id === step.nodeId);
            const label = node?.data.label || step.nodeId;
            const statusColors = {
              pending: '#9ca3af',
              running: '#fbbf24',
              completed: '#34d399',
              failed: '#f87171'
            };
            return (
              <div
                key={step.nodeId}
                data-testid={`trace-step-${step.nodeId}`}
                style={{
                  borderLeft: `4px solid ${statusColors[step.status]}`,
                  backgroundColor: '#111827',
                  padding: '8px 12px',
                  borderRadius: '0 4px 4px 0',
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>{label}</span>
                  <span style={{ color: statusColors[step.status] }} data-testid={`trace-status-${step.nodeId}`}>
                    {step.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  {step.log && <div><strong>Log:</strong> {step.log}</div>}
                  {step.input !== null && step.input !== undefined && (
                    <div><strong>Input:</strong> {typeof step.input === 'object' ? JSON.stringify(step.input) : String(step.input)}</div>
                  )}
                  {step.output !== null && step.output !== undefined && (
                    <div><strong>Output:</strong> {typeof step.output === 'object' ? JSON.stringify(step.output) : String(step.output)}</div>
                  )}
                  {(step.tokensConsumed !== undefined && step.tokensConsumed > 0) && <div><strong>Tokens:</strong> {step.tokensConsumed}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
