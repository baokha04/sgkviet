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
