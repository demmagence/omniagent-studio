# OmniAgent Studio 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/demmagence/omniagent-studio)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)](https://github.com/demmagence/omniagent-studio/pulls)
[![Stars](https://img.shields.io/github/stars/demmagence/omniagent-studio.svg?style=social)](https://github.com/demmagence/omniagent-studio/stargazers)

OmniAgent Studio is a premium, interactive, visual workflow builder and execution dashboard for LLM agents. Connect local models (Ollama) and cloud APIs (OpenAI) to design, simulate, trace, and debug complex multi-step agent chains entirely from a stunning dark-themed glassmorphism interface.

---

## Key Features 🌟

*   **Interactive Node Canvas**: Drag, connect, configure, and delete nodes. Complete layout state is computed instantly.
*   **Parallel Execution Engine**: Concurrently run independent workflow branches with custom `maxConcurrency` limits and fail-fast abort mechanics.
*   **Multi-Provider Integration**: Direct input fields for Ollama (`localhost:11434`) and OpenAI.
*   **Visual Execution Tracer**: See exactly where your agent chain is executing. Active nodes highlight in real-time (`pending` ➔ `running` ➔ `completed`/`failed`).
*   **Advanced Nodes**: Built-in support for Router, VectorDB (cosine similarity lookup), JSONPath extraction, and Tool nodes (Calculator, Web Search).
*   **Execution History & Replay**: Review history logs, token usage, and status badges of past runs with a single click.
*   **Graceful Simulator Mode**: Toggle simulated responses to test layout, logic, routing, and prompt structures without consuming API tokens or running local instances.
*   **Flow Serialization**: Instantly export your agent graphs to a JSON file and import them back to continue editing.

---

## UI Preview & Aesthetic Theme 🎨

OmniAgent Studio is styled with a premium developer dashboard look:
- **Glassmorphic panels** with backdrop-blur and thin high-contrast borders.
- **Dynamic accents** (emerald for successful steps, amber for running, slate for pending).
- **Responsive design** featuring a collapsible side parameters pane and collapsible trace logs console.

---

## Codebase Architecture 🏗️

```
src/
├── components/          # React layout elements
│   ├── Canvas.tsx       # Editor canvas rendering nodes and edges
│   ├── ConfigPanel.tsx  # Dynamic side forms matching selected node type
│   ├── Node.tsx         # Node component with custom styling and labels
│   ├── Sidebar.tsx      # Sidebar containing node presets & workspace controls
│   └── TracingConsole.tsx # Collapsible tracing console for step-by-step logs
├── store/
│   └── graphStore.ts    # Central Zustand-style state management
├── services/
│   ├── api.ts           # Ollama/OpenAI local connector client
│   └── executor.ts      # Topological traversal execution engine
├── utils/
│   └── graphUtils.ts    # Topological sorting and cycle detection
└── types/
    └── index.ts         # TypeScript interface contracts for graphs & traces
```

---

## Quick Start ⚡

### 1. Clone the repository
```bash
git clone https://github.com/demmagence/omniagent-studio.git
cd omniagent-studio
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## Testing & Validation 🧪

OmniAgent Studio is rigorously tested across 4 tiers:
1.  **Core Features**: Graph state logic, node addition/deletion, connection rules.
2.  **Boundary & Edge Cases**: Loop/cycle detection, execution timeout, empty configurations.
3.  **Integration & Tracing**: Prompt interpolation, conditional routing, tool outputs.
4.  **Real-world Scenarios**: Multi-step chains, serialization export/import preservation.

To run tests:
```bash
npm run test
```

---

## Contributing 🤝

Contributions are welcome! Please open an issue or submit a pull request for any features, bug fixes, or enhancements.

## License 📄

This project is licensed under the [MIT License](LICENSE).
