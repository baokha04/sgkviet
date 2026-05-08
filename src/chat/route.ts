import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Env } from '../types';
import { ChatService } from './service';
import { VectorService } from '../ocr_processes/vector_service';
import { generateEmbedding } from '../utils/embeddings';

const chatRoute = new OpenAPIHono<{ Bindings: Env }>();

const ChatRequestSchema = z.object({
  query: z.string().openapi({ example: 'Trong sách giáo khoa có bài thơ nào không?' }),
  session_id: z.string().optional().openapi({ example: 'session-123' }),
  stream: z.boolean().optional().default(true)
});

const ChatResponseSchema = z.object({
  response: z.string(),
  session_id: z.string().optional()
});

chatRoute.openapi(
  createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: ChatRequestSchema } } }
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ChatResponseSchema } },
        description: 'Chat with the assistant'
      }
    }
  }),
  async (c) => {
    try {
      const { query, session_id, stream } = c.req.valid('json');
      console.log('Chat request:', { query, session_id, stream });
      const chatService = new ChatService(c.env);
      const vectorService = new VectorService(c.env.VECTOR_INDEX);

      // 1. Generate embedding for query
      console.log('Generating embedding...');
      const queryEmbedding = await generateEmbedding(c.env.AI, query);
      console.log('Embedding generated.');

      // 2. Search Vectorize
      console.log('Querying Vectorize...');
      const matches = await vectorService.query(queryEmbedding, 5);
      console.log('Vectorize matches:', matches.length);
      const context = matches
        .map(m => `Book Page ${m.metadata.book_page_id}:\n${m.metadata.markdown}`)
        .join('\n\n---\n\n');

      // 3. Get History
      let history: any[] = [];
      if (session_id) {
        const logs = await chatService.getHistory(session_id, 10);
        history = logs.map(log => ({
          role: log.role,
          content: log.content
        }));
      }

      // 4. Save User Message
      await chatService.saveMessage({
        session_id,
        role: 'user',
        content: query
      });

      // 5. Generate Response with LLM
      const systemPrompt = `You are a helpful assistant for Vietnamese textbooks. 
Use the following context to answer the user's question. 
If the answer is not in the context, say you don't know based on the provided materials.
Always respond in Vietnamese.

Context:
${context}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: query }
      ];

      const llmModel = '@cf/meta/llama-3-8b-instruct';

      if (stream) {
        const responseStream = await c.env.AI.run(llmModel, {
          messages,
          stream: true
        });

        let fullResponse = '';
        const [s1, s2] = responseStream.tee();

        c.executionCtx.waitUntil((async () => {
          const reader = s2.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;
                try {
                  const json = JSON.parse(data);
                  if (json.response) fullResponse += json.response;
                } catch (e) {}
              }
            }
          }
          await chatService.saveMessage({
            session_id,
            role: 'assistant',
            content: fullResponse
          });
        })());

        return new Response(s1, {
          headers: { 'Content-Type': 'text/event-stream' }
        });
      } else {
        const aiResponse = await c.env.AI.run(llmModel, { messages });
        const assistantContent = aiResponse.response;

        await chatService.saveMessage({
          session_id,
          role: 'assistant',
          content: assistantContent
        });

        return c.json({
          response: assistantContent,
          session_id
        }, 200);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      return c.json({ error: error.message, stack: error.stack }, 500);
    }
  }
);

export { chatRoute };
