import { z } from 'zod';

export const inquirySchema = z.object({
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254),
  company: z.string().trim().max(160).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  service: z.string().trim().min(1).max(120),
  message: z.string().trim().min(10).max(5000),
  requestedPlan: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,59}$/)
    .or(z.literal(''))
    .optional()
    .default(''),
  privacyAcknowledged: z.literal(true),
  website: z.string().max(300).optional().default(''),
  captchaToken: z.string().max(4096).optional(),
});
export const privacyRequestSchema = z.object({
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254),
  requestType: z.enum(['access', 'correction', 'export', 'deletion', 'other']),
  message: z.string().trim().min(5).max(2000),
  privacyAcknowledged: z.literal(true),
  website: z.string().max(300).optional().default(''),
  captchaToken: z.string().max(4096).optional(),
});
export const statusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'waiting', 'closed']),
});
export const inquiryNoteSchema = z.object({
  idempotencyKey: z.uuid(),
  body: z.string().trim().min(2).max(2000),
});
export const clientStatusSchema = z.object({ status: z.enum(['active', 'paused', 'closed']) });
export const privacyCompletionSchema = z.object({
  identityVerified: z.literal(true),
  action: z.enum([
    'delete_all_records',
    'delete_inquiry_records',
    'retained_under_policy',
    'handled_outside_system',
    'handled_as_requested',
  ]),
  note: z.string().trim().min(10).max(1000),
});
