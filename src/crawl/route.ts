import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { Env } from '../types';
import { CrawlRequestSchema, CrawlResponseSchema } from './schema';
import { CrawlService } from './service';

const crawlRoute = new OpenAPIHono<{ Bindings: Env }>();

crawlRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: CrawlRequestSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: CrawlResponseSchema } },
        description: 'Crawl a book and store pages'
      }
    }
  }),
  async (c) => {
    const { url } = await c.req.json();
    const service = new CrawlService(c.env);
    const result = await service.crawl(url);
    return c.json(result, 200);
  }
);

export { crawlRoute };
