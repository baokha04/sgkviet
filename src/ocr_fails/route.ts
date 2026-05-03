import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { IdSchema } from '../common/schema';
import { OcrFailSchema } from './schema';
import { OcrFailsService } from './service';

const ocrFailsRoute = new OpenAPIHono<{ Bindings: Env }>();

ocrFailsRoute.openapi(
  createRoute({
    method: 'get',
    path: '/',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(OcrFailSchema) } },
        description: 'List OCR failures'
      }
    }
  }),
  async (c) => {
    const service = new OcrFailsService(c.env);
    const results = await service.findAll();
    return c.json(results as any, 200);
  }
);

ocrFailsRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: OcrFailSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: OcrFailSchema } },
        description: 'Create OCR failure record'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const service = new OcrFailsService(c.env);
    const result = await service.create(body);
    return c.json(result as any, 201);
  }
);

ocrFailsRoute.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete OCR failure'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const service = new OcrFailsService(c.env);
    await service.softDelete(id);
    return c.json({ success: true }, 200);
  }
);

export { ocrFailsRoute };
