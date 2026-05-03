import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { Env } from './types';

// Import Routes
import { booksRoute } from './books/route';
import { configsRoute } from './configs/route';
import { bookPagesRoute } from './book_pages/route';
import { ocrProcessesRoute } from './ocr_processes/route';
import { ocrFailsRoute } from './ocr_fails/route';
import { crawlRoute } from './crawl/route';

const app = new OpenAPIHono<{ Bindings: Env }>();

// Mount routes
app.route('/books', booksRoute);
app.route('/configs', configsRoute);
app.route('/book_pages', bookPagesRoute);
app.route('/ocr_processes', ocrProcessesRoute);
app.route('/ocr_fails', ocrFailsRoute);
app.route('/crawl', crawlRoute);

// Swagger
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'SGKViet API',
    version: '1.0.0'
  }
});

app.get('/swagger', swaggerUI({ url: '/doc' }));

export default app;
