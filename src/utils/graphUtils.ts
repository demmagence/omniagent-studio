import { Node, Edge } from '../types';

export function serializeGraph(nodes: Node[], edges: Edge[]): string {
  let hasApiKey = false;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].data?.apiKey) {
      hasApiKey = true;
      break;
    }
  }

  let sanitizedNodes = nodes;
  if (hasApiKey) {
    sanitizedNodes = nodes.map(node => {
      if (node.data && node.data.apiKey) {
        const { apiKey, ...restData } = node.data;
        return { ...node, data: restData };
      }
      return node;
    });
  }
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

function computeInDegreeAndAdjList(nodes: Node[], edges: Edge[]) {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
    const list = adjList.get(edge.source);
    if (list) {
      list.push(edge.target);
    }
    const degree = inDegree.get(edge.target);
    if (degree !== undefined) {
      inDegree.set(edge.target, degree + 1);
    }
  }
  return { inDegree, adjList };
}

export function hasCycle(nodes: Node[], edges: Edge[]): boolean {
  if (edges.length === 0) return false;

  const adjList = new Map<string, string[]>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    let list = adjList.get(edge.source);
    if (!list) {
      list = [];
      adjList.set(edge.source, list);
    }
    list.push(edge.target);
  }

  // 0 = unvisited, 1 = visiting (in recursion stack), 2 = visited
  const state = new Map<string, number>();

  function dfs(nodeId: string): boolean {
    const s = state.get(nodeId) || 0;
    if (s === 1) return true;
    if (s === 2) return false;

    state.set(nodeId, 1);

    const neighbors = adjList.get(nodeId);
    if (neighbors) {
      for (let i = 0; i < neighbors.length; i++) {
        if (dfs(neighbors[i])) return true;
      }
    }

    state.set(nodeId, 2);
    return false;
  }

  for (let i = 0; i < nodes.length; i++) {
    const id = nodes[i].id;
    if ((state.get(id) || 0) === 0) {
      if (dfs(id)) return true;
    }
  }
  return false;
}

function computeLayers(nodes: Node[], inDegree: Map<string, number>, adjList: Map<string, string[]>) {
  const layers: string[][] = [];
  const layerMap = new Map<string, number>();
  const queue: string[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
      layerMap.set(nodeId, 0);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const u = queue[head++]!;
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

  return finalLayers;
}

function assignPositions(
  layers: string[][],
  startX: number,
  startY: number,
  layerGap: number,
  nodeGap: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  for (let col = 0; col < layers.length; col++) {
    const nodesInLayer = layers[col] || [];
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
  if (nodes.length === 0) return new Map<string, { x: number; y: number }>();

  // Compute in-degree per node
  const { inDegree, adjList } = computeInDegreeAndAdjList(nodes, edges);

  // BFS layering
  const finalLayers = computeLayers(nodes, inDegree, adjList);

  // Assign positions
  return assignPositions(finalLayers, startX, startY, layerGap, nodeGap);
}
