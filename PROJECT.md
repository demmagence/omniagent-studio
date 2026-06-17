# Project: OmniAgent Studio

## Architecture
OmniAgent Studio is a React-based single-page application (SPA) built with Vite, Tailwind CSS, TypeScript, and Vitest.
The core architecture consists of:
1. **Graph State Store**: Manages nodes, edges, selections, and active execution trace state. Can be implemented using a lightweight state library (like Zustand) or custom React state hooks.
2. **Editor Workspace**: A node-based canvas where users can render nodes, drag them, connect them via ports, and configure parameters.
3. **Execution Simulator / Runner**: A module that traverses the graph in topological order, resolves prompts/tools, and calls real APIs (Ollama, OpenAI) or executes simulated steps.
4. **Serialization Utility**: Functions to export/import the state store to/from JSON.
5. **Dashboard Shell**: The aesthetic dark-themed user interface container.

## Code Layout
```
c:\Users\wibis\Documents\Code\Org\star\
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/       # Visual graph editor, sidebar, log console, provider config
│   │   ├── Canvas.tsx
│   │   ├── Node.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ConfigPanel.tsx
│   │   └── TracingConsole.tsx
│   ├── services/         # LLM API client, simulation runner
│   │   ├── api.ts
│   │   └── executor.ts
│   ├── store/            # State management for nodes and connections
│   │   └── graphStore.ts
│   ├── types/            # Type definitions (Graph, Node, Edge, TraceState)
│   │   └── index.ts
│   └── utils/            # Helper functions (serialization, layout helpers)
│       └── graphUtils.ts
├── tests/                # Unit/Integration/E2E test files
└── E2E_TEST_READY.md     # E2E test confirmation artifact (same as TEST_READY.md)
```

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Project Setup | Initialize React + TS + Tailwind + Vitest. Establish build/test config. | None | DONE |
| 2 | M2: Visual Editor Canvas | Implement nodes, edges rendering, drag-and-drop, connections, selection. | M1 | DONE |
| 3 | M3: Form Configurations & APIs | Node parameters, LLM credentials (Ollama/OpenAI), API integration. | M2 | DONE |
| 4 | M4: Workflow Execution Engine | Graph traversal, LLM execution / simulation, token counting. | M3 | DONE |
| 5 | M5: Execution Tracing UI & Serialization | Live highlighting, step-by-step tracing logs, JSON import/export. | M4 | DONE |
| 6 | M6: Premium Dashboard Theme | UI/UX visual updates, glassmorphism, animations, responsive design. | M5 | DONE |
| 7 | M7: E2E and Adversarial Hardening | Run all E2E test tiers, perform adversarial verification & audits. | M6, E2E Test Suite | DONE |
| 8 | M8: Parallel Execution Engine | Concurrent branch execution, max concurrency limiting, fail-fast abort. | M7 | DONE |
| 9 | M9: Advanced Node Types | VectorDB similarity matching, JSONPath parser node. | M8 | DONE |
| 10 | M10: Run History & Replay | Run history, visual replays, and trace-state serialization. | M9 | DONE |

## Interface Contracts
### Graph State (`src/types/index.ts`)
```typescript
export type NodeType = 'LLM' | 'Prompt' | 'Tool' | 'Router' | 'Output' | 'VectorDB' | 'JSONPath';

export interface NodeData {
  label: string;
  type: NodeType;
  // Node parameters
  promptTemplate?: string;
  systemPrompt?: string;
  provider?: 'openai' | 'ollama';
  model?: string;
  apiKey?: string;
  endpointUrl?: string;
  toolName?: string;
  routingRules?: string; // Logic for router nodes
  outputVal?: string;
  embeddingModel?: string;
  documents?: string;
  similarityThreshold?: number;
  jsonPath?: string;
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
}

export interface GraphState {
  nodes: Node[];
  edges: Edge[];
}
```

### Execution Output (`src/types/index.ts`)
```typescript
export interface TraceStep {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: any;
  output: any;
  log?: string;
  tokensConsumed?: number;
}

export interface RunHistoryEntry {
  id: string;
  timestamp: string;
  nodes: Node[];
  edges: Edge[];
  traceSteps: TraceStep[];
  status: 'success' | 'failure';
}
```
