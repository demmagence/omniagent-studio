# Contributing to OmniAgent Studio

Thank you for your interest in contributing to OmniAgent Studio! We welcome and appreciate contributions of all types, from bug fixes and documentation to new features and node designs.

Please take a moment to review this guide before getting started.

---

## 🛠️ Local Development Setup

OmniAgent Studio is built using **React (v18)**, **TypeScript**, **Vite (v6)**, and **TailwindCSS**.

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (LTS version recommended).

### 2. Clone and Install
Clone the repository and install dependencies:
```bash
git clone https://github.com/demmagence/omniagent-studio.git
cd omniagent-studio
npm install
```

### 3. Run Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 🧪 Testing and Building

Before submitting a Pull Request, please ensure all tests pass and the project builds successfully.

### Running Tests
We use [Vitest](https://vitest.dev/) for unit and integration testing. Run the test suite using:
```bash
npm run test
```

### Building the Project
Verify the TypeScript compiler and Vite production build succeed:
```bash
npm run build
```

---

## 🌿 Git Workflow & Branching

We follow a clean branch-and-merge workflow.

1. **Branch Naming**: Choose a descriptive name prefixed with the type of change:
   - `feat/some-feature` for new features
   - `fix/some-bug` for bug fixes
   - `docs/some-documentation` for doc updates
   - `refactor/some-code` for code refactoring
2. **Commit Messages**: Keep commit messages concise and descriptive (e.g., `feat: add Vector DB node configuration`).
3. **Pull Requests**: Open a PR from your branch to `main`. Ensure your description details what changes were made and how they were tested.

---

## 🤝 Community & Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to **demmagence@gmail.com**.

Thank you for building with us! 🚀
