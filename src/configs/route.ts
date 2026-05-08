import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { IdSchema } from '../common/schema';
import { ConfigSchema, KeySchema } from './schema';
import { ConfigsService } from './service';

const configsRoute = new OpenAPIHono<{ Bindings: Env }>();

configsRoute.openapi(
  createRoute({
    method: 'get',
    path: '/',
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(ConfigSchema) } },
        description: 'List configs (decrypted)'
      }
    }
  }),
  async (c) => {
    const service = new ConfigsService(c.env);
    const results = await service.findAll();
    return c.json(results as any, 200);
  }
);

configsRoute.openapi(
  createRoute({
    method: 'get',
    path: '/key/{key}',
    request: { params: KeySchema },
    responses: {
      200: {
        content: { 'application/json': { schema: ConfigSchema } },
        description: 'Get config by key (encrypted)'
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Config not found'
      }
    }
  }),
  async (c) => {
    const { key } = c.req.valid('param');
    const service = new ConfigsService(c.env);
    const result = await service.findByKey(key);

    if (!result) {
      return c.json({ error: 'Config not found' }, 404);
    }

    return c.json(result as any, 200);
  }
);

configsRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: ConfigSchema } } }
    },
    responses: {
      201: {
        content: { 'application/json': { schema: ConfigSchema } },
        description: 'Create config (encrypted)'
      }
    }
  }),
  async (c) => {
    const body = await c.req.json();
    const service = new ConfigsService(c.env);
    const result = await service.create(body);
    return c.json(result as any, 201);
  }
);

configsRoute.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    request: {
      params: IdSchema,
      body: { content: { 'application/json': { schema: ConfigSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ConfigSchema } },
        description: 'Update config (encrypted)'
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) }
        },
        description: 'Config not found'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = await c.req.json();
    const service = new ConfigsService(c.env);
    const result = await service.update(id, body);

    if (!result) {
      return c.json({ error: 'Config not found' }, 404);
    }

    return c.json(result as any, 200);
  }
);

configsRoute.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    request: { params: IdSchema },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.boolean() }) }
        },
        description: 'Soft delete config'
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const service = new ConfigsService(c.env);
    await service.softDelete(id);
    return c.json({ success: true }, 200);
  }
);

export { configsRoute };

