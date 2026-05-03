import { z } from '@hono/zod-openapi';

export const OcrProcessSchema = z.object({
  id: z.number().optional(),
  book_page_id: z.number(),
  markdown: z.string().nullable().optional(),
  status: z.string(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const OcrProcessBatchResponseSchema = z.object({
  processed_pages: z.number(),
  success_count: z.number(),
  failure_count: z.number()
});
