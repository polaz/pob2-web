<template>
  <q-page class="overflow-hidden full-height">
    <!-- Loading state -->
    <div v-if="loading" class="absolute-center column items-center">
      <q-spinner-dots size="40px" color="primary" />
      <div class="q-mt-sm text-grey-6">Loading passive tree...</div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="absolute-center column items-center text-negative">
      <q-icon name="error" size="40px" />
      <div class="q-mt-sm">Failed to load tree data</div>
      <div class="text-caption text-grey">{{ error.message }}</div>
    </div>

    <!-- Canvas -->
    <PassiveTreeCanvas
      v-else
      :show-fps="true"
      @ready="onCanvasReady"
      @resize="onCanvasResize"
      @error="onCanvasError"
    />
  </q-page>
</template>

<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import PassiveTreeCanvas from 'src/components/tree/PassiveTreeCanvas.vue';
import type { TreeLayers } from 'src/composables/usePixiApp';
import { useTreeData } from 'src/composables/useTreeData';
import { useTreeStore } from 'src/stores/treeStore';
import type { PassiveTree, PassiveNode } from 'src/protos/pob2_pb';
import { NodeType } from 'src/protos/pob2_pb';
import type { TreeData, TreeNode } from 'src/types/tree';

// Load tree data
const { loading, error, treeData } = useTreeData();

// Tree store
const treeStore = useTreeStore();

/**
 * Stores reference to canvas layers for future tree rendering operations.
 * Will be used for node rendering, connections, and UI overlays.
 */
const canvasLayers = shallowRef<TreeLayers | null>(null);

/**
 * Convert TreeNodeType string to NodeType enum.
 */
function convertNodeType(type: string): NodeType {
  switch (type) {
    case 'normal':
      return NodeType.NODE_NORMAL;
    case 'notable':
      return NodeType.NODE_NOTABLE;
    case 'keystone':
      return NodeType.NODE_KEYSTONE;
    case 'mastery':
      return NodeType.NODE_MASTERY;
    default:
      return NodeType.NODE_TYPE_UNKNOWN;
  }
}

/**
 * Scale factor to convert tree coordinates to reasonable canvas units.
 * Original tree spans ~33000 units, we scale down to fit ~600-800 units
 * so the tree is viewable at zoom levels 0.5-2.0
 */
const COORDINATE_SCALE = 0.02;

/**
 * Convert TreeNode to PassiveNode proto format.
 */
function convertNode(node: TreeNode): PassiveNode {
  const passiveNode: PassiveNode = {
    id: node.id,
    nodeType: convertNodeType(node.type),
    stats: node.stats,
    linkedIds: Array.from(node.neighbors),
    // Scale down coordinates so tree fits at reasonable zoom levels
    position: {
      x: node.x * COORDINATE_SCALE,
      y: node.y * COORDINATE_SCALE,
    },
  };

  // Add optional fields only if they have values
  if (node.name) passiveNode.name = node.name;
  if (node.icon) passiveNode.icon = node.icon;
  if (node.ascendancy) passiveNode.ascendancyName = node.ascendancy;
  if (node.isAscendancyStart) passiveNode.isAscendancyStart = true;

  return passiveNode;
}

/**
 * Convert TreeData to PassiveTree proto format.
 */
function convertToPassiveTree(data: TreeData): PassiveTree {
  const nodes: PassiveNode[] = [];
  for (const node of data.nodes.values()) {
    nodes.push(convertNode(node));
  }

  return {
    version: data.version,
    nodes,
    groups: [],
    classStartNodes: {},
  };
}

// Watch for tree data load and populate store
watch(treeData, (data) => {
  if (data) {
    const passiveTree = convertToPassiveTree(data);
    treeStore.setTreeData(passiveTree);

    if (import.meta.env.DEV) {
      console.log(`[TreePage] Tree data loaded: ${passiveTree.nodes.length} nodes`);
    }
  }
});

function onCanvasReady(layers: TreeLayers): void {
  canvasLayers.value = layers;
  if (import.meta.env.DEV) {
    console.log('[TreePage] Canvas ready with layers:', Object.keys(layers));
  }
}

function onCanvasResize(width: number, height: number): void {
  if (import.meta.env.DEV) {
    console.log(`[TreePage] Canvas resized to ${width}x${height}`);
  }
}

function onCanvasError(error: Error): void {
  if (import.meta.env.DEV) {
    console.error('[TreePage] Canvas error:', error);
  }
}

// Expose canvas layers for parent component or testing access
defineExpose({
  canvasLayers,
});
</script>
