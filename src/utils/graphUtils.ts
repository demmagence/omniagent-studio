import { Node, Edge } from '../types';

export function serializeGraph(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({ nodes, edges }, null, 2);
}

export function deserializeGraph(jsonStr: string): { nodes: Node[]; edges: Edge[] } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid graph data format');
    }
    if (data.nodes !== undefined && !Array.isArray(data.nodes)) {
      throw new Error('nodes must be an array');
    }
    if (data.edges !== undefined && !Array.isArray(data.edges)) {
      throw new Error('edges must be an array');
    }
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    return { nodes, edges };
  } catch (error) {
    throw new Error(`Failed to deserialize graph: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function hasCycle(nodes: Node[], edges: Edge[]): boolean {
  const adjList = new Map<string, string[]>();
  for (const node of nodes) {
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
    if (adjList.has(edge.source)) {
      adjList.get(edge.source)!.push(edge.target);
    }
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node.id)) return true;
  }
  return false;
}

export function getTopologicalOrder(nodes: Node[], edges: Edge[]): string[] {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (adjList.has(edge.source)) {
      adjList.get(edge.source)!.push(edge.target);
    }
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
    }
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);

    const neighbors = adjList.get(u) || [];
    for (const v of neighbors) {
      if (inDegree.has(v)) {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }
  }

  return order;
}
