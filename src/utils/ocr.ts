import { Buffer } from 'node:buffer';

export interface OcrPage {
  id: number;
  imageUrl: string;
}

export interface OcrResult {
  id: number;
  markdown?: string;
  error?: string;
  status: 'success' | 'failed';
}

const OCR_PROMPT = `Please perform high-fidelity OCR on this image and convert the content into structured Markdown format. The content contains Vietnamese, so pay close attention to diacritics and special characters to ensure 100% accuracy in spelling.
Requirements:
Maintain the original hierarchy of headings (using #, ##, ###).
Reconstruct all tables accurately using Markdown table syntax.
Preserve text styles such as bold, italics, and lists (bulleted or numbered).
If there are any mathematical formulas or technical symbols, render them in LaTeX.
Output the final result in clean Markdown code. Do not summarize or omit any information.`;

export async function processImagesWithOpenRouter(
  pages: OcrPage[],
  apiKey: string,
  model: string
): Promise<OcrResult[]> {
  const results = await Promise.allSettled(
    pages.map(async (page) => {
      // Fetch the image first to bypass CDN 403 restrictions on OpenRouter's side
      const imgRes = await fetch(page.imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://taphuan.nxbgd.vn/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
          'Connection': 'keep-alive'
        }
      });
      if (!imgRes.ok) {
        throw new Error(`Failed to download image from CDN: ${imgRes.status} ${imgRes.statusText}`);
      }
      
      const arrayBuffer = await imgRes.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: OCR_PROMPT
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: dataUrl
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as any;
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from OpenRouter');
      }

      return {
        id: page.id,
        markdown: data.choices[0].message.content,
        status: 'success'
      };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value as OcrResult;
    }
    return {
      id: pages[index].id,
      error: result.reason?.message || String(result.reason),
      status: 'failed'
    } as OcrResult;
  });
}

export async function chatWithOpenRouter(
  prompt: string,
  content: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: content
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as any;
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response format from OpenRouter');
  }

  return data.choices[0].message.content;
}

export async function chatWithCloudflare(
  prompt: string,
  content: string,
  ai: any,
  model: string = '@cf/meta/llama-3-8b-instruct',
  maxRetries: number = 3
): Promise<string> {
  if (!ai) {
    throw new Error('Cloudflare AI binding not found');
  }

  // Add a safety limit for content length to avoid overloading or 502s
  const MAX_CONTENT_LENGTH = 30000;
  let processedContent = content;
  if (content.length > MAX_CONTENT_LENGTH) {
    console.warn(`Content length (${content.length}) exceeds limit, truncating...`);
    processedContent = content.substring(0, MAX_CONTENT_LENGTH) + '... [truncated]';
  }

  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Use retry_after from the previous error if available, otherwise exponential backoff
        const retryAfter = lastError?.retry_after ? lastError.retry_after * 1000 : Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${retryAfter}ms before retrying Cloudflare AI (attempt ${attempt + 1}/${maxRetries + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
      }

      const response = await ai.run(model, {
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: processedContent }
        ]
      });

      if (!response) {
        throw new Error('Empty response from Cloudflare AI');
      }

      // Some models return the result directly, others wrap it in a response property
      const result =
        response.response ||
        response.result?.response ||
        response.result ||
        response;

      if (typeof result === 'string') {
        return result;
      }

      if (result && typeof result === 'object') {
        return result.response || JSON.stringify(result);
      }

      return String(result);
    } catch (error: any) {
      lastError = error;
      console.error(`Cloudflare AI attempt ${attempt + 1} failed:`, error.message || error);

      // Check if the error is retryable (like 502, 503, 504 or rate limits)
      const isRetryable =
        error.message?.includes('502') ||
        error.message?.includes('503') ||
        error.message?.includes('504') ||
        error.message?.includes('overloaded') ||
        error.status === 502 ||
        error.status === 503 ||
        error.retryable === true ||
        error.error_code === 502;

      if (!isRetryable || attempt === maxRetries) {
        break;
      }
    }
  }

  throw new Error(
    `Cloudflare AI failed after ${maxRetries + 1} attempts. Last error: ${
      lastError?.message || lastError?.title || 'Unknown error'
    }`
  );
}
