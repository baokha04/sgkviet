import { z } from '@hono/zod-openapi';

export const BookSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  unsigned_title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  total_pages: z.number().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});
