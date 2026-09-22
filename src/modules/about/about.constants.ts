export const ABOUT_SECTION_TYPES = {
  HERO: 'HERO',
  ROLES: 'ROLES',
  HOW_IT_WORKS: 'HOW_IT_WORKS',
  STORY: 'STORY',
  STATS: 'STATS',
  TIMELINE: 'TIMELINE',
  MISSION_VISION: 'MISSION_VISION',
  VALUES: 'VALUES',
  CTA: 'CTA',
} as const;

export type AboutSectionType = keyof typeof ABOUT_SECTION_TYPES;

export const ABOUT_SECTION_REQUIREMENTS: Record<AboutSectionType, { required: boolean }> = {
  [ABOUT_SECTION_TYPES.HERO]: { required: true },
  [ABOUT_SECTION_TYPES.ROLES]: { required: true },
  [ABOUT_SECTION_TYPES.HOW_IT_WORKS]: { required: true },
  [ABOUT_SECTION_TYPES.STORY]: { required: false },
  [ABOUT_SECTION_TYPES.STATS]: { required: false },
  [ABOUT_SECTION_TYPES.TIMELINE]: { required: false },
  [ABOUT_SECTION_TYPES.MISSION_VISION]: { required: false },
  [ABOUT_SECTION_TYPES.VALUES]: { required: false },
  [ABOUT_SECTION_TYPES.CTA]: { required: true },
};
