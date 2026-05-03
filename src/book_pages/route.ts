import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { IdSchema } from '../common/schema';
import { BookPageSchema } from './schema';
import { BookPagesService } from './service';

const bookPagesRoute = new OpenAPIHono<{ Bindings: Env }>();

bookPagesRoute.openapi(
  createRoute({
    method: 'get',
    path: '/',
    request: {
      query: z.object({
        book_id: z.coerce
          .number()
          .optional()
          .openapi({ description: 'Filter by book ID' }),
        from_page: z.coerce
          .number()
          .optional()
          .openapi({ description: 'Filter from page number (inclusive)' }),
        to_page: z.coerce
          .number()
          .optional()
          .openapi({ description: 'Filter to page number (inclusive)' })
      })
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(BookPageSchema) } },
        description: 'List book pages'
      }
    }
  }),
  async (c) => {
    const { book_id, from_page, to_page } = c.req.valid('query');
    const service = new BookPagesService(c.env);
    const results = await service.findAll(book_id, from_page, to_page);
    return c.json(results as any, 200);
  }
);

bookPagesRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: BookPageSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: BookPageSchema } },
        description: 'Create book page'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const service = new BookPagesService(c.env);
    const result = await service.create(body);
    return c.json(result as any, 201);
  }
);

bookPagesRoute.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete book page'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const service = new BookPagesService(c.env);
    await service.softDelete(id);
    return c.json({ success: true }, 200);
  }
);

export { bookPagesRoute };
