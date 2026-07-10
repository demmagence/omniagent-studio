import { Node, Edge } from '../types';

export function serializeGraph(nodes: Node[], edges: Edge[]): string {
  const sanitizedNodes = nodes.map(node => {
    if (node.data && node.data.apiKey) {
      const { apiKey, ...restData } = node.data;
      return { ...node, data: restData };
    }
    return node;
  });
  return JSON.stringify({ nodes: sanitizedNodes, edges }, null, 2);
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

/**
 * Auto-layout nodes in a layered DAG arrangement.
 * Nodes are placed in columns by topological layer (depth from root),
 * vertically centered within each column.
 */
export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  options: { startX?: number; startY?: number; layerGap?: number; nodeGap?: number } = {}
): Map<string, { x: number; y: number }> {
  const { startX = 80, startY = 60, layerGap = 280, nodeGap = 160 } = options;
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;

  // Compute in-degree per node
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
    if (adjList.has(edge.source)) {
      adjList.get(edge.source)!.push(edge.target);
    }
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
    }
  }

  // BFS layering
  const layers: string[][] = [];
  const layerMap = new Map<string, number>();
  const queue: string[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
      layerMap.set(nodeId, 0);
    }
  }

  while (queue.length > 0) {
    const u = queue.shift()!;
    const layer = layerMap.get(u)!;
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(u);

    for (const v of adjList.get(u) || []) {
      const currentLayer = layerMap.get(v);
      const newLayer = layer + 1;
      if (currentLayer === undefined || newLayer > currentLayer) {
        layerMap.set(v, newLayer);
      }
      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // Recompute layers from layerMap (handles multi-parent nodes correctly)
  const finalLayers: string[][] = [];
  for (const [nodeId, layer] of layerMap.entries()) {
    if (!finalLayers[layer]) finalLayers[layer] = [];
    finalLayers[layer].push(nodeId);
  }

  // Any unplaced nodes (disconnected) go to layer 0
  for (const node of nodes) {
    if (!layerMap.has(node.id)) {
      if (!finalLayers[0]) finalLayers[0] = [];
      finalLayers[0].push(node.id);
    }
  }

  // Assign positions
  for (let col = 0; col < finalLayers.length; col++) {
    const nodesInLayer = finalLayers[col] || [];
    const totalHeight = (nodesInLayer.length - 1) * nodeGap;
    const offsetY = startY - totalHeight / 2;

    for (let row = 0; row < nodesInLayer.length; row++) {
      positions.set(nodesInLayer[row], {
        x: startX + col * layerGap,
        y: Math.max(20, offsetY + row * nodeGap),
      });
    }
  }

  return positions;
}
