import React from 'react';
import { useGraphStore, graphStore } from '../store/graphStore';

export const ConfigPanel: React.FC = () => {
  const { nodes, selectedNodeId } = useGraphStore();
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div
        data-testid="config-panel"
        style={{
          width: '300px',
          backgroundColor: '#1f2937',
          color: '#f3f4f6',
          padding: '16px',
          borderLeft: '1px solid #374151',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          fontSize: '14px'
        }}
      >
        Select a node to configure parameters
      </div>
    );
  }

  const { data } = selectedNode;

  const handleChange = (key: string, value: string) => {
    graphStore.updateNodeData(selectedNode.id, { [key]: value });
  };

  return (
    <div
      data-testid="config-panel"
      style={{
        width: '300px',
        backgroundColor: '#1f2937',
        color: '#f3f4f6',
        padding: '16px',
        borderLeft: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto'
      }}
    >
      <h3 style={{ margin: 0, fontSize: '16px' }}>Configure Node</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '12px', color: '#9ca3af' }}>Node Label</label>
        <input
          data-testid="config-label-input"
          type="text"
          value={data.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
        />
      </div>

      {selectedNode.type === 'Prompt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>Prompt Template</label>
          <textarea
            data-testid="config-prompt-template-input"
            value={data.promptTemplate || ''}
            onChange={(e) => handleChange('promptTemplate', e.target.value)}
            rows={4}
            placeholder="Enter template, e.g. 'Solve: {input}'"
            style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px', fontFamily: 'monospace' }}
          />
        </div>
      )}

      {selectedNode.type === 'LLM' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>Provider</label>
            <select
              data-testid="config-provider-select"
              value={data.provider || 'openai'}
              onChange={(e) => handleChange('provider', e.target.value)}
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            >
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>Model</label>
            <input
              data-testid="config-model-input"
              type="text"
              value={data.model || ''}
              onChange={(e) => handleChange('model', e.target.value)}
              placeholder="e.g. gpt-4o-mini"
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>API Key</label>
            <input
              data-testid="config-apikey-input"
              type="password"
              value={data.apiKey || ''}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>Endpoint URL</label>
            <input
              data-testid="config-endpoint-input"
              type="text"
              value={data.endpointUrl || ''}
              onChange={(e) => handleChange('endpointUrl', e.target.value)}
              placeholder="Custom endpoint URL"
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>System Prompt</label>
            <textarea
              data-testid="config-system-prompt-input"
              value={data.systemPrompt || ''}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              rows={3}
              placeholder="Enter system prompt instructions"
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>
        </>
      )}

      {selectedNode.type === 'Tool' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>Tool Name</label>
          <select
            data-testid="config-tool-name-select"
            value={data.toolName || 'calculator'}
            onChange={(e) => handleChange('toolName', e.target.value)}
            style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
          >
            <option value="calculator">Calculator</option>
            <option value="webSearch">Web Search</option>
            <option value="dbLookup">DB Lookup</option>
          </select>
        </div>
      )}

      {selectedNode.type === 'Router' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>Routing Rules</label>
          <textarea
            data-testid="config-routing-rules-input"
            value={data.routingRules || ''}
            onChange={(e) => handleChange('routingRules', e.target.value)}
            rows={3}
            placeholder="e.g. contains 'error' -> error branch"
            style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
          />
        </div>
      )}

      {selectedNode.type === 'Output' && (
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          This node gathers the execution results of upstream nodes and outputs them.
        </div>
      )}

      {selectedNode.type === 'VectorDB' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>Embedding Model</label>
            <input
              data-testid="config-embedding-model-input"
              type="text"
              value={data.embeddingModel || ''}
              onChange={(e) => handleChange('embeddingModel', e.target.value)}
              placeholder="e.g. text-embedding-3-small"
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>Mock Index Documents</label>
            <textarea
              data-testid="config-documents-input"
              value={data.documents || ''}
              onChange={(e) => handleChange('documents', e.target.value)}
              rows={4}
              placeholder="Enter documents, one per line"
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>Similarity Threshold</label>
            <input
              data-testid="config-similarity-threshold-input"
              type="number"
              step="0.01"
              value={data.similarityThreshold !== undefined ? data.similarityThreshold : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                graphStore.updateNodeData(selectedNode.id, { similarityThreshold: isNaN(val) ? undefined : val });
              }}
              placeholder="e.g. 0.5"
              style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
            />
          </div>
        </>
      )}

      {selectedNode.type === 'JSONPath' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>JSON Key Path</label>
          <input
            data-testid="config-jsonpath-input"
            type="text"
            value={data.jsonPath || ''}
            onChange={(e) => handleChange('jsonPath', e.target.value)}
            placeholder="e.g. data.users[0].name"
            style={{ backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '4px', padding: '6px', fontSize: '13px' }}
          />
        </div>
      )}
    </div>
  );
};
