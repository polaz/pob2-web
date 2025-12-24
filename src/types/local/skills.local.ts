// src/types/local/skills.local.ts
// UI-only state extensions for skills and gems
// These extend proto-generated types with local-only fields

import type { SkillGroup, GemInstance, Gem } from 'src/protos/pob2_pb';

/**
 * Extended SkillGroup with UI state
 */
export interface LocalSkillGroup extends SkillGroup {
  // Editing state
  /** Group is currently being edited */
  editing?: boolean;
  /** Group is expanded in UI */
  expanded?: boolean;
  /** Group is collapsed */
  collapsed?: boolean;

  // Display state
  /** Group is selected */
  selected?: boolean;
  /** Group is highlighted */
  highlighted?: boolean;

  // Calculated values
  /** Total DPS for this skill group */
  totalDps?: number;
  /** Is this the main DPS skill */
  isMainSkill?: boolean;
}

/**
 * Extended GemInstance with UI state
 */
export interface LocalGemInstance extends GemInstance {
  // Editing state
  /** Gem is being edited */
  editing?: boolean;
  /** Gem has validation errors */
  hasErrors?: boolean;
  /** Validation error messages */
  errors?: string[];

  // Display state
  /** Gem is selected */
  selected?: boolean;
  /** Gem is being dragged */
  dragging?: boolean;
  /** Gem is highlighted (search) */
  highlighted?: boolean;

  // Calculated values
  /** DPS contribution from this gem */
  dpsContribution?: number;
  /** Whether gem meets level requirements */
  meetsRequirements?: boolean;
  /** Missing requirement (if any) */
  missingRequirement?: 'level' | 'str' | 'dex' | 'int';
}

/**
 * Extended Gem (base gem data) with UI state
 */
export interface LocalGem extends Gem {
  // Search/filter state
  /** Gem matches current search */
  matchesSearch?: boolean;
  /** Search relevance score */
  searchScore?: number;

  // Favorites
  /** User has favorited this gem */
  favorited?: boolean;
  /** Recently used */
  recentlyUsed?: boolean;
}

/**
 * Skill configuration panel state
 */
export interface SkillPanelState {
  /** Currently selected skill group ID */
  selectedGroupId?: string;
  /** Currently selected gem instance ID */
  selectedGemId?: string;
  /** Panel is in edit mode */
  editMode: boolean;
  /** Show disabled skills */
  showDisabled: boolean;
  /** Show support gems */
  showSupports: boolean;
  /** Gem search query */
  searchQuery?: string;
  /** Filter by gem tags */
  tagFilter?: string[];
}

/**
 * Default skill panel state
 */
export const DEFAULT_SKILL_PANEL_STATE: SkillPanelState = {
  editMode: false,
  showDisabled: true,
  showSupports: true,
};

/**
 * DPS breakdown for a skill
 */
export interface SkillDpsBreakdown {
  /** Skill group ID */
  skillGroupId: string;
  /** Total DPS */
  totalDps: number;
  /** Per-hit damage */
  damagePerHit: number;
  /** Hits per second */
  hitsPerSecond: number;
  /** Hit chance */
  hitChance: number;
  /** Crit chance */
  critChance: number;
  /** Crit multiplier */
  critMulti: number;
  /** Damage by type */
  damageByType: {
    physical: number;
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };
  /** Damage over time */
  dotDps?: number;
  /** Ignite DPS */
  igniteDps?: number;
  /** Bleed DPS */
  bleedDps?: number;
  /** Poison DPS */
  poisonDps?: number;
}
