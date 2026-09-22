import { z } from 'zod';
import { ABOUT_SECTION_TYPES } from './about.constants.js';

export const AboutMediaSchema = z.object({
  mediaId: z.string(),
  url: z.string(),
  altText: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
});

export const AboutCtaSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  url: z.string().min(1, 'URL is required'),
});

export const HeroSectionSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  primaryCta: AboutCtaSchema.optional(),
  secondaryCta: AboutCtaSchema.optional(),
  image: AboutMediaSchema.optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
});

export const RolesSectionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  roles: z.array(z.object({
    role: z.string(),
    title: z.string(),
    description: z.string(),
    image: AboutMediaSchema.optional(),
    icon: z.string().optional(),
    cta: AboutCtaSchema.optional(),
  })).min(1, 'At least one role is required'),
});

export const HowItWorksSectionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
  })).min(1, 'At least one step is required'),
});

export const StatsSectionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  stats: z.array(z.object({
    key: z.string(),
    label: z.string(),
    source: z.enum(['MANUAL', 'DYNAMIC']),
    manualValue: z.string().optional(),
    icon: z.string().optional(),
  })),
});

export const GenericContentSchema = z.record(z.any());

export const AboutSectionSchemas = {
  [ABOUT_SECTION_TYPES.HERO]: HeroSectionSchema,
  [ABOUT_SECTION_TYPES.ROLES]: RolesSectionSchema,
  [ABOUT_SECTION_TYPES.HOW_IT_WORKS]: HowItWorksSectionSchema,
  [ABOUT_SECTION_TYPES.STATS]: StatsSectionSchema,
  [ABOUT_SECTION_TYPES.STORY]: GenericContentSchema,
  [ABOUT_SECTION_TYPES.TIMELINE]: GenericContentSchema,
  [ABOUT_SECTION_TYPES.MISSION_VISION]: GenericContentSchema,
  [ABOUT_SECTION_TYPES.VALUES]: GenericContentSchema,
  [ABOUT_SECTION_TYPES.CTA]: GenericContentSchema,
};
