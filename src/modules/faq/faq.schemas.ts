import { z } from 'zod';

export const FAQRoleEnum = z.enum(['GENERAL', 'FREELANCER', 'CLIENT', 'INVESTOR', 'FOUNDER']);

export const faqCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  role: FAQRoleEnum.optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});

export const faqSchema = z.object({
  categoryId: z.string().min(1, "Category ID is required"),
  role: FAQRoleEnum,
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  slug: z.string().min(1, "Slug is required"),
  shortAnswer: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
  status: z.string().default("DRAFT"), // DRAFT, PUBLISHED, UNPUBLISHED, ARCHIVED
  isPublished: z.boolean().default(false),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
});

export const faqSeoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  canonicalUrl: z.string().optional().nullable(),
  robots: z.string().optional().nullable(),
  ogTitle: z.string().optional().nullable(),
  ogDescription: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable(),
  twitterTitle: z.string().optional().nullable(),
  twitterDescription: z.string().optional().nullable(),
  twitterImage: z.string().optional().nullable(),
});
