import { z } from '@hono/zod-openapi';

export const IdSchema = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: '1' })
});
