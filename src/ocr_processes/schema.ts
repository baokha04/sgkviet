import { z } from '@hono/zod-openapi';

export const OcrProcessSchema = z.object({
  id: z.number().optional(),
  book_page_id: z.number(),
  markdown: z.string().nullable().optional(),
  status: z.string(),
  review: z.string().nullable().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const OcrProcessBatchResponseSchema = z.object({
  processed_pages: z.number(),
  success_count: z.number(),
  failure_count: z.number()
});
export const OcrReviewRangeSchema = z.object({
  from_book_page_id: z.number(),
  to_book_page_id: z.number().nullable().optional()
});

export const OcrReviewRangeResponseSchema = z.object({
  total: z.number(),
  updated: z.number()
});
