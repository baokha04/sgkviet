import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { IdSchema } from '../common/schema';
import { OcrProcessSchema, OcrProcessBatchResponseSchema, OcrReviewRangeSchema, OcrReviewRangeResponseSchema } from './schema';
import { OcrProcessesService } from './service';

const ocrProcessesRoute = new OpenAPIHono<{ Bindings: Env }>();

ocrProcessesRoute.openapi(
  createRoute({
    method: 'get',
    path: '/',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(OcrProcessSchema) } },
        description: 'List OCR processes'
      }
    }
  }),
  async (c) => {
    const service = new OcrProcessesService(c.env);
    const results = await service.findAll();
    return c.json(results as any, 200);
  }
);

ocrProcessesRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: OcrProcessSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: OcrProcessSchema } },
        description: 'Create OCR process'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const service = new OcrProcessesService(c.env);
    const result = await service.create(body);
    return c.json(result as any, 201);
  }
);

ocrProcessesRoute.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    request: {
      params: IdSchema,
      body: { content: { 'application/json': { schema: OcrProcessSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: OcrProcessSchema } },
        description: 'Update OCR process'
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'OCR process not found'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = await c.req.json();
    const service = new OcrProcessesService(c.env);
    const result = await service.update(id, body);

    if (!result) {
      return c.json({ error: 'OCR process not found' }, 404);
    }

    return c.json(result as any, 200);
  }
);

ocrProcessesRoute.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete OCR process'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const service = new OcrProcessesService(c.env);
    await service.softDelete(id);
    return c.json({ success: true }, 200);
  }
);

ocrProcessesRoute.openapi(
  createRoute({
    method: 'post',
    path: '/process-batch',
    responses: {
      200: {
        content: {
          'application/json': { schema: OcrProcessBatchResponseSchema }
        },
        description: 'Process a batch of images for OCR'
      },
      500: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Server error'
      }
    }
  }),
  async (c) => {
    const service = new OcrProcessesService(c.env);
    try {
      const result = await service.processBatch();
      return c.json(result, 200);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  }
);

ocrProcessesRoute.openapi(
  createRoute({
    method: 'post',
    path: '/upsert',
    request: {
      body: { content: { 'application/json': { schema: OcrProcessSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: OcrProcessSchema } },
        description: 'Upsert OCR process'
      },
      201: {
        content: { 'application/json': { schema: OcrProcessSchema } },
        description: 'Created OCR process'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const service = new OcrProcessesService(c.env);
    const result = await service.upsertByBookPageId(body);
    return c.json(result as any, 200);
  }
);

ocrProcessesRoute.openapi(
  createRoute({
    method: 'post',
    path: '/review-range',
    request: {
      body: { content: { 'application/json': { schema: OcrReviewRangeSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: OcrReviewRangeResponseSchema } },
        description: 'Review OCR processes in a range'
      }
    }
  }),
  async (c) => {
    const { from_book_page_id, to_book_page_id } = c.req.valid('json');
    const service = new OcrProcessesService(c.env);
    const result = await service.reviewRange(from_book_page_id, to_book_page_id);
    return c.json(result, 200);
  }
);

export { ocrProcessesRoute };
