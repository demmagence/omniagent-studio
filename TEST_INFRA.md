# OmniAgent Studio - Test Infrastructure (TEST_INFRA)

This document outlines the test methodology, feature inventory, mock strategies, and DOM selection contracts implemented for OmniAgent Studio.

## 1. Test Methodology

The test suite is structured into a **4-Tier Integration and E2E Testing Strategy** designed to verify complete visual, state, service, and scenario behaviors.

### Tier 1: Feature Coverage (>=25 Tests)
- **Objective**: Verifies the core capabilities of individual visual modules and state layers in isolation.
- **Coverage**:
  - **Sidebar**: Palette rendering, adding nodes, toggling execution modes.
  - **Canvas**: Node list rendering, node deletion, edge rendering, edge deletion, manual port selection/connection.
  - **Config Panel**: Dynamic input fields loading depending on selected node type, parameters editing (label, provider, model, API keys, system prompts, prompt templates, tools, routing rules).
  - **Tracing Console**: Initial state, total tokens counter, run button validation.
  - **Serialization**: Textarea export mapping, JSON input validation.

### Tier 2: Boundary & Edge Cases (>=25 Tests)
- **Objective**: Hardens the system against bad data, invalid states, networks, and limits.
- **Coverage**:
  - **Empty / Default Fields**: Executing prompt/LLM/tool/router/output nodes with missing inputs or empty configurations.
  - **Malformed Inputs**: Attempting to import non-JSON strings, non-object payloads, or objects with corrupted schemas.
  - **Circular Dependencies**: Graph cycles detection (`hasCycle`) and aborted workflow validation.
  - **Disconnected Graphs**: Ordering traversal on standalone nodes and linear clusters.
  - **Timeouts**: Simulating slow workflows and ensuring subsequent nodes are aborted correctly.
  - **Network Failures**: OpenAI and Ollama API status code failures (401, 500) and strict global fetch block validation.
  - **Stress & Load**: Evaluating outputs with extremely long strings, complex nested inputs/outputs, and complex 50-node execution flows.

### Tier 3: Cross-Feature Combinations (>=10 Tests)
- **Objective**: Tests sequential multi-step integration workflows.
- **Coverage**:
  - Node addition -> configuration -> visual verification.
  - Multi-node pipeline building -> parameter adjustments -> executing.
  - Build graph -> export JSON -> reset workspace -> import JSON -> execute imported graph.
  - Edge cases during interaction: invalid imports alerting, canvas deselect on background click, and duplicate/self-connection prevention.

### Tier 4: Real-World Scenarios (>=5 Tests)
- **Objective**: Simulates end-to-end execution of production agent architectures.
- **Coverage**:
  - **Simple LLM Agent**: Prompt template rendering output piped to OpenAI LLM.
  - **Tool-Calling Agent**: Prompt formatting a query, LLM generating parameters, and Calculator Tool evaluating sum.
  - **Router Agent**: LLM output processed through Router Node, directing execution paths.
  - **Interactive Chat Agent**: Formatting conversation history sequentially through a conversational LLM loop.
  - **Multi-Agent Collaboration**: Planner Agent generating a task outline, Router delegating work, and Writer Agent compiling the final response.

---

## 2. Mock Strategies

To satisfy network restrictions and run tests reliably in headless environments, the following mocks are implemented in `tests/setup.ts`:

1. **ResizeObserver**: Mocked globally to support layout adjustments.
2. **getBoundingClientRect**: Stubbed on `Element.prototype` to return standard rectangular dimensions for nodes.
3. **window.fetch**: Blocked globally to throw an error if any external call is attempted. Individual tests stub `fetch` via `vi.stubGlobal('fetch', ...)` to test specific API returns or status codes.
4. **Fallback / Simulation Mode**: Enabled by default in `graphStore` state (`isFallbackMode = true`). It allows executor to generate mocked LLM responses based on inputs and models.

---

## 3. DOM Selection & Test Contracts

The visual components utilize explicit `data-testid` attributes to decoupling testing assertions from CSS/styling classes.

| Selector | Element Description |
|---|---|
| `data-testid="sidebar"` | Sidebar container element |
| `data-testid="canvas"` | Main workspace editor canvas |
| `data-testid="config-panel"` | Selected node configuration panel |
| `data-testid="tracing-console"` | Execution tracing console |
| `data-testid="add-node-{NodeType}"` | Sidebar node creation buttons (`LLM`, `Prompt`, `Tool`, `Router`, `Output`) |
| `data-testid="node-item-{nodeId}"` | Visual node rendered in canvas |
| `data-testid="delete-node-{nodeId}"` | Delete button inside specific node |
| `data-testid="connect-select-{nodeId}"` | Target node select menu inside a node |
| `data-testid="connect-btn-{nodeId}"` | Connect button inside a node |
| `data-testid="edge-item-{edgeId}"` | Visual connection list item |
| `data-testid="delete-edge-{edgeId}"` | Edge deletion button |
| `data-testid="config-label-input"` | Config label input field |
| `data-testid="config-prompt-template-input"` | Config Prompt template textarea |
| `data-testid="config-provider-select"` | Config LLM provider select |
| `data-testid="config-model-input"` | Config LLM model name input |
| `data-testid="config-apikey-input"` | Config LLM API key input |
| `data-testid="config-endpoint-input"` | Config LLM custom endpoint URL input |
| `data-testid="config-system-prompt-input"` | Config LLM system prompt textarea |
| `data-testid="config-tool-name-select"` | Config Tool name select |
| `data-testid="config-routing-rules-input"` | Config Router rules textarea |
| `data-testid="run-workflow-btn"` | Trigger workflow execution button |
| `data-testid="total-tokens"` | Cumulative tokens counter display |
| `data-testid="trace-step-{nodeId}"` | Trace card showing node execution status |
| `data-testid="trace-status-{nodeId}"` | Node status text inside trace card (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`) |
| `data-testid="export-btn"` | Export graph action button |
| `data-testid="serialized-output"` | Textarea showing exported JSON |
| `data-testid="import-input"` | Textarea for pasting JSON string |
| `data-testid="import-btn"` | Import graph action button |
| `data-testid="reset-btn"` | Reset workspace action button |
