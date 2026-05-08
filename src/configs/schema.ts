import { z } from '@hono/zod-openapi';

export const ConfigSchema = z.object({
  id: z.number().optional(),
  key: z.string(),
  value: z.string().nullable().optional(),
  active: z.boolean().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const KeySchema = z.object({
  key: z.string().openapi({ param: { name: 'key', in: 'path' }, example: 'MY_KEY' })
});

export const DecryptRequestSchema = z.object({
  value: z.string(),
  key: z.string().optional()
});

export const DecryptResponseSchema = z.object({
  decrypted: z.string()
});


