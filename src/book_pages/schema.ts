import { z } from '@hono/zod-openapi';

export const BookPageSchema = z.object({
  id: z.number().optional(),
  book_id: z.number(),
  page_number: z.number(),
  image_url: z.string().nullable().optional(),
  html_content: z.string().nullable().optional(),
  ocr_process_id: z.number().nullable().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});
