import { describe, it, expect, beforeEach } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

describe('Tier 4: Real-World Scenarios', () => {
  beforeEach(() => {
    graphStore.resetGraph();
  });

  it('1. Simple LLM Agent: Prompt -> LLM -> Output', async () => {
    // 1. Build the graph
    const promptNode = graphStore.addNode('Prompt');
    const llmNode = graphStore.addNode('LLM');
    const outputNode = graphStore.addNode('Output');

    graphStore.addEdge(promptNode.id, llmNode.id);
    graphStore.addEdge(llmNode.id, outputNode.id);

    // 2. Configure node parameters
    graphStore.updateNodeData(promptNode.id, {
      label: 'System Prompt Template',
      promptTemplate: 'Please reply with high enthusiasm: {input}'
    });
    graphStore.updateNodeData(llmNode.id, {
      label: 'Primary LLM',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a professional assistant.'
    });
    graphStore.updateNodeData(outputNode.id, {
      label: 'Agent Output'
    });

    // 3. Execute
    const steps = await executeWorkflow({ fallback: true });

    // 4. Verify outputs
    const promptStep = steps.find(s => s.nodeId === promptNode.id);
    const llmStep = steps.find(s => s.nodeId === llmNode.id);
    const outputStep = steps.find(s => s.nodeId === outputNode.id);

    expect(promptStep?.status).toBe('completed');
    expect(promptStep?.output).toBe('Please reply with high enthusiasm: {input}');

    expect(llmStep?.status).toBe('completed');
    expect(llmStep?.input).toBe('Please reply with high enthusiasm: {input}');
    expect(llmStep?.output).toContain('[Simulated openai - Model: gpt-4o-mini]');

    expect(outputStep?.status).toBe('completed');
    expect(outputStep?.output).toBe(llmStep?.output);
  });

  it('2. Tool-Calling Agent: Prompt -> LLM -> Tool (Calculator) -> Output', async () => {
    // 1. Build the graph
    const promptNode = graphStore.addNode('Prompt');
    const llmNode = graphStore.addNode('LLM');
    const toolNode = graphStore.addNode('Tool');
    const outputNode = graphStore.addNode('Output');

    graphStore.addEdge(promptNode.id, llmNode.id);
    graphStore.addEdge(llmNode.id, toolNode.id);
    graphStore.addEdge(toolNode.id, outputNode.id);

    // 2. Configure parameters
    graphStore.updateNodeData(promptNode.id, {
      label: 'Math Input Prompt',
      promptTemplate: 'Perform math: 15 + 25'
    });
    graphStore.updateNodeData(llmNode.id, {
      label: 'Query Creator LLM',
      provider: 'ollama',
      model: 'llama3'
    });
    graphStore.updateNodeData(toolNode.id, {
      label: 'Math Tool Node',
      toolName: 'calculator'
    });
    graphStore.updateNodeData(outputNode.id, {
      label: 'Final Output'
    });

    // 3. Execute
    const steps = await executeWorkflow({ fallback: true });

    // 4. Verify outputs
    const promptStep = steps.find(s => s.nodeId === promptNode.id);
    const llmStep = steps.find(s => s.nodeId === llmNode.id);
    const toolStep = steps.find(s => s.nodeId === toolNode.id);
    const outputStep = steps.find(s => s.nodeId === outputNode.id);

    expect(promptStep?.output).toBe('Perform math: 15 + 25');
    expect(llmStep?.input).toBe('Perform math: 15 + 25');
    // Ollama fallback response contains numbers "15" and "25" in prompt
    expect(llmStep?.output).toContain('15 + 25');

    // Calculator tool should extract 15 and 25 and add them to get 40
    expect(toolStep?.output).toBe('Result: 40');
    expect(outputStep?.output).toBe('Result: 40');
  });

  it('3. Router Agent: Prompt -> LLM -> Router (Decision Tree) -> Output', async () => {
    // 1. Build the graph
    const promptNode = graphStore.addNode('Prompt');
    const llmNode = graphStore.addNode('LLM');
    const routerNode = graphStore.addNode('Router');
    const outputNode = graphStore.addNode('Output');

    graphStore.addEdge(promptNode.id, llmNode.id);
    graphStore.addEdge(llmNode.id, routerNode.id);
    graphStore.addEdge(routerNode.id, outputNode.id);

    // 2. Configure parameters
    graphStore.updateNodeData(promptNode.id, {
      label: 'Input prompt',
      promptTemplate: 'Simulate search trigger query'
    });
    graphStore.updateNodeData(llmNode.id, {
      label: 'Router Classifier LLM',
      provider: 'openai',
      model: 'gpt-4o',
      // Prompt LLM to contain keyword search
      systemPrompt: 'Include the word "search" in your response.'
    });
    graphStore.updateNodeData(routerNode.id, {
      label: 'Path Router',
      routingRules: "if contains 'search' -> Tool Branch"
    });

    // 3. Execute
    const steps = await executeWorkflow({ fallback: true });

    // 4. Verify outputs
    const llmStep = steps.find(s => s.nodeId === llmNode.id);
    const routerStep = steps.find(s => s.nodeId === routerNode.id);

    // Since LLM response has system prompt "Include the word 'search' in your response.",
    // the output should trigger the 'Tool Branch' routing rule
    expect(llmStep?.output).toContain('search');
    expect(routerStep?.output).toBe('Tool Branch');
  });

  it('4. Interactive Chat Agent: Prompt (History Formatter) -> LLM (Chat Response) -> Output', async () => {
    // 1. Build the graph
    const promptNode = graphStore.addNode('Prompt');
    const llmNode = graphStore.addNode('LLM');
    const outputNode = graphStore.addNode('Output');

    graphStore.addEdge(promptNode.id, llmNode.id);
    graphStore.addEdge(llmNode.id, outputNode.id);

    // 2. Configure parameters
    graphStore.updateNodeData(promptNode.id, {
      label: 'History Formatter',
      promptTemplate: 'Conversation History:\nUser: Hello\nAssistant: Hi\nUser: {input}\nAssistant:'
    });
    graphStore.updateNodeData(llmNode.id, {
      label: 'Conversational LLM',
      provider: 'openai',
      model: 'gpt-4o'
    });

    // 3. Execute
    const steps = await executeWorkflow({ fallback: true });

    // 4. Verify
    const promptStep = steps.find(s => s.nodeId === promptNode.id);
    const llmStep = steps.find(s => s.nodeId === llmNode.id);

    expect(promptStep?.output).toContain('Conversation History:');
    expect(llmStep?.input).toContain('Conversation History:');
    expect(llmStep?.output).toContain('[Simulated openai - Model: gpt-4o]');
  });

  it('5. Multi-Agent Collaboration: Prompt -> LLM (Planner) -> Router -> LLM (Writer) -> Output', async () => {
    // 1. Build the graph
    const inputPrompt = graphStore.addNode('Prompt');
    const plannerAgent = graphStore.addNode('LLM');
    const delegatorRouter = graphStore.addNode('Router');
    const writerAgent = graphStore.addNode('LLM');
    const finalOutput = graphStore.addNode('Output');

    graphStore.addEdge(inputPrompt.id, plannerAgent.id);
    graphStore.addEdge(plannerAgent.id, delegatorRouter.id);
    graphStore.addEdge(delegatorRouter.id, writerAgent.id);
    graphStore.addEdge(writerAgent.id, finalOutput.id);

    // 2. Configure parameters
    graphStore.updateNodeData(inputPrompt.id, {
      label: 'Task Prompt',
      promptTemplate: 'Write a story about a cute robot.'
    });
    graphStore.updateNodeData(plannerAgent.id, {
      label: 'Planner Agent',
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'Output a plan outlining the sections of the story.'
    });
    graphStore.updateNodeData(delegatorRouter.id, {
      label: 'Delegator Router',
      routingRules: "if plan exists -> send to writer"
    });
    graphStore.updateNodeData(writerAgent.id, {
      label: 'Writer Agent',
      provider: 'ollama',
      model: 'llama3',
      systemPrompt: 'Take the plan and write the final story.'
    });

    // 3. Execute
    const steps = await executeWorkflow({ fallback: true });

    // 4. Verify Multi-Agent workflow execution
    const plannerStep = steps.find(s => s.nodeId === plannerAgent.id);
    const routerStep = steps.find(s => s.nodeId === delegatorRouter.id);
    const writerStep = steps.find(s => s.nodeId === writerAgent.id);
    const outputStep = steps.find(s => s.nodeId === finalOutput.id);

    expect(plannerStep?.status).toBe('completed');
    expect(routerStep?.status).toBe('completed');
    expect(writerStep?.status).toBe('completed');
    expect(outputStep?.status).toBe('completed');

    expect(plannerStep?.output).toContain('System directive: Output a plan outlining the sections of the story.');
    expect(routerStep?.output).toBe('Default Route'); // Evaluates rules since it does not contain 'error' or 'tool'
    expect(writerStep?.input).toBe('Default Route');
    expect(writerStep?.output).toContain('[Simulated ollama - Model: llama3]');
  });
});
