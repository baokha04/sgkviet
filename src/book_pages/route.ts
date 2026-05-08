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

bookPagesRoute.openapi(
  createRoute({
    method: 'get',
    path: '/find-id',
    request: {
      query: z.object({
        book_id: z.coerce.number().openapi({ description: 'Book ID' }),
        page_id: z.coerce.number().openapi({ description: 'Page number' })
      })
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ id: z.number() }) }
        },
        description: 'Find book page ID'
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Book page not found'
      }
    }
  }),
  async (c) => {
    const { book_id, page_id } = c.req.valid('query');
    const service = new BookPagesService(c.env);
    const result = await service.findIdByBookAndPage(book_id, page_id);

    if (!result) {
      return c.json({ error: 'Book page not found' }, 404);
    }

    return c.json(result, 200);
  }
);

bookPagesRoute.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}/ocr-process',
    request: {
      params: IdSchema,
      body: {
        content: {
          'application/json': {
            schema: z.object({ ocr_process_id: z.number() })
          }
        }
      }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: BookPageSchema } },
        description: 'Update book page OCR process ID'
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Book page not found'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const { ocr_process_id } = await c.req.json();
    const service = new BookPagesService(c.env);
    const result = await service.updateOcrProcessId(id, ocr_process_id);

    if (!result) {
      return c.json({ error: 'Book page not found' }, 404);
    }

    return c.json(result as any, 200);
  }
);

export { bookPagesRoute };
