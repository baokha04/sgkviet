import { z } from '@hono/zod-openapi';

export const OcrFailSchema = z.object({
  id: z.number().optional(),
  book_page_id: z.number().nullable().optional(),
  reason: z.string().nullable().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});
