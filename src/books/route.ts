import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { IdSchema } from '../common/schema';
import { BookSchema } from './schema';
import { BooksService } from './service';

const booksRoute = new OpenAPIHono<{ Bindings: Env }>();

booksRoute.openapi(
  createRoute({
    method: 'get',
    path: '/',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(BookSchema) } },
        description: 'List books'
      }
    }
  }),
  async (c) => {
    const service = new BooksService(c.env);
    const results = await service.findAll();
    return c.json(results as any, 200);
  }
);

booksRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: BookSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: BookSchema } },
        description: 'Create book'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const service = new BooksService(c.env);
    const result = await service.create(body);
    return c.json(result as any, 201);
  }
);

booksRoute.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete book'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const service = new BooksService(c.env);
    await service.softDelete(id);
    return c.json({ success: true }, 200);
  }
);

export { booksRoute };
