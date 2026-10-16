import { z } from 'zod';
import type { PublicSiteContent } from './defaults';

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalEmail = z.union([z.literal(''), z.email().trim().max(254)]);

const imagePath = z
  .string()
  .max(180)
  .regex(
    /^\/images\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g|avif)$/,
    'Use a local /images/ image path.',
  );
const stableId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/);
const settingsSchema = z.object({
  businessName: shortText(100),
  shortName: shortText(50),
  eyebrow: shortText(100),
  email: optionalEmail,
  privacyEmail: optionalEmail,
  location: shortText(160),
  privacyNoticeVersion: shortText(50),
  homeEyebrow: shortText(100),
  homeHeadline: shortText(150),
  homeEmphasis: shortText(100),
  homeLede: shortText(500),
  homePrimaryCta: shortText(70),
  homeSecondaryCta: shortText(70),
  servicesEyebrow: shortText(100),
  servicesHeadline: shortText(150),
  servicesEmphasis: shortText(100),
  servicesLead: shortText(500),
  aboutEyebrow: shortText(100),
  aboutHeadline: shortText(150),
  aboutEmphasis: shortText(100),
  aboutLead: shortText(500),
  approachEyebrow: shortText(100),
  approachHeadline: shortText(150),
  approachEmphasis: shortText(100),
  approachLead: shortText(500),
  contactEyebrow: shortText(100),
  contactHeadline: shortText(100),
  contactEmphasis: shortText(100),
  contactLead: shortText(500),
  footerTagline: shortText(180),
  pricingNote: shortText(600).default(
    'Scope and fees are confirmed in writing before work begins.',
  ),
  portfolioLead: shortText(500).default('Explore the work we can support.'),
});
const serviceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/),
  title: shortText(100),
  description: shortText(500),
  image: imagePath.default('/images/service-admin.webp'),
  examples: z.array(shortText(80)).max(8),
  published: z.boolean(),
});
const faqSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/),
  question: shortText(180),
  answer: shortText(1200),
  published: z.boolean(),
});

const planSchema = z.object({
  id: stableId,
  name: shortText(60),
  price: shortText(60),
  period: z.string().trim().max(40),
  description: shortText(240),
  features: z.array(shortText(100)).min(1).max(8),
  featured: z.boolean(),
  published: z.boolean(),
});
const portfolioSchema = z
  .object({
    id: stableId,
    title: shortText(120),
    category: shortText(80),
    description: shortText(500),
    image: imagePath,
    outcome: shortText(600),
    kind: z.enum(['example', 'case-study']),
    approved: z.boolean(),
    published: z.boolean(),
  })
  .refine((item) => !item.published || item.kind === 'example' || item.approved, {
    message: 'A published client case study needs owner approval and permission to share.',
  });
const teamSchema = z.object({
  id: stableId,
  name: shortText(120),
  role: shortText(100),
  bio: shortText(500),
  image: imagePath,
  published: z.boolean(),
});

export const publicSiteContentSchema = z
  .object({
    settings: settingsSchema,
    services: z
      .array(serviceSchema)
      .min(1)
      .max(12)
      .refine((items) => items.some((item) => item.published)),
    faqs: z.array(faqSchema).max(20),
    plans: z.array(planSchema).max(8).default([]),
    portfolio: z.array(portfolioSchema).max(16).default([]),
    team: z.array(teamSchema).max(12).default([]),
  })
  .superRefine((content, context) => {
    for (const [key, values] of [
      ['services', content.services.map((item) => item.id)],
      ['faqs', content.faqs.map((item) => item.id)],
      ['plans', content.plans.map((item) => item.id)],
      ['portfolio', content.portfolio.map((item) => item.id)],
      ['team', content.team.map((item) => item.id)],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: 'custom', path: [key], message: 'IDs must be unique.' });
      }
    }
    if (content.plans.filter((item) => item.published && item.featured).length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['plans'],
        message: 'Choose only one featured public package.',
      });
    }
    const names = content.services.map((item) => item.title.toLowerCase());
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: 'custom',
        path: ['services'],
        message: 'Service names must be unique.',
      });
    }
  });

export const saveSiteContentSchema = z.object({
  revision: z.number().int().nonnegative(),
  content: publicSiteContentSchema,
});

export type ValidatedSiteContent = z.infer<typeof publicSiteContentSchema> & PublicSiteContent;
