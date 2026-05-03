import { z } from '@hono/zod-openapi';

export const CrawlRequestSchema = z.object({
  url: z.string().url()
});

export const CrawlResponseSchema = z.object({
  book: z.object({
    id: z.number(),
    title: z.string(),
    total_pages: z.number()
  }),
  pages_inserted: z.number()
});
