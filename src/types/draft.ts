// src/types/draft.ts
// Types for the draft overlay system - session-only user edits

import type { TreeNodeType } from './tree';
import type { Gem } from './gems';
import type { Item } from 'src/protos/items_pb';

// ============================================================================
// Custom Tree Node Types
// ============================================================================

/**
 * Origin information for custom tree nodes.
 * Tracks where the node came from for debugging and display purposes.
 */
export interface CustomNodeOrigin {
  /** How the node was created */
  type: 'user_created' | 'imported' | 'sandbox';
  /** When the node was created */
  createdAt: Date;
  /** Optional description of why this node was created */
  description?: string;
}

/**
 * Custom tree node for sandbox mode.
 * Extends the base tree node concept with draft-specific fields.
 *
 * Custom nodes are temporary and exist only in memory during the session.
 * They can be connected to existing nodes or other custom nodes.
 */
export interface CustomTreeNode {
  /** Unique identifier - prefixed with 'custom_' to avoid ID collisions */
  id: string;
  /** Display name */
  name: string;
  /** Node type (normal, notable, keystone, mastery) */
  type: TreeNodeType;
  /** X coordinate in tree space */
  x: number;
  /** Y coordinate in tree space */
  y: number;
  /** Stat descriptions for this node */
  stats: string[];
  /** Icon identifier (optional) */
  icon?: string;
  /** Origin information */
  origin: CustomNodeOrigin;
  /**
   * Mastery effects for mastery nodes.
   * Only relevant when type is 'mastery'.
   */
  masteryEffects?: Array<{
    effect: number;
    stats: string[];
  }>;
}

/**
 * Connection between two nodes (can be custom or existing).
 * First element is source, second is target.
 */
export type NodeConnection = [string, string];

// ============================================================================
// Draft Edit Types
// ============================================================================

/**
 * Partial gem edit - only includes fields that are being modified.
 * Uses Partial<Gem> to allow any subset of gem fields to be overridden.
 */
export type GemDraft = Partial<Gem>;

/**
 * Partial item edit - only includes fields that are being modified.
 * Uses Partial<Item> to allow any subset of item fields to be overridden.
 */
export type ItemDraft = Partial<Item>;

// ============================================================================
// Draft Store State Types
// ============================================================================

/**
 * Statistics about current draft state.
 */
export interface DraftStats {
  /** Number of gem edits */
  gemEdits: number;
  /** Number of item edits */
  itemEdits: number;
  /** Number of i18n edits */
  i18nEdits: number;
  /** Number of custom nodes */
  customNodes: number;
  /** Number of custom connections */
  customConnections: number;
  /** Total number of changes */
  total: number;
}

/**
 * Draft state snapshot for export/debugging.
 */
export interface DraftSnapshot {
  /** Snapshot timestamp */
  timestamp: Date;
  /** Gem edits as plain object */
  skillEdits: Record<string, GemDraft>;
  /** Item edits as plain object */
  itemEdits: Record<string, ItemDraft>;
  /** i18n edits as plain object */
  i18nEdits: Record<string, string>;
  /** Custom nodes as plain object */
  customNodes: Record<string, CustomTreeNode>;
  /** Custom connections */
  customConnections: NodeConnection[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generate a unique ID for custom nodes.
 * Prefix ensures no collision with real node IDs.
 */
export function generateCustomNodeId(): string {
  return `custom_${crypto.randomUUID()}`;
}

/**
 * Check if a node ID is a custom node (vs. base data node).
 */
export function isCustomNodeId(id: string): boolean {
  return id.startsWith('custom_');
}
