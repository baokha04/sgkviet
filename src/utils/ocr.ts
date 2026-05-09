import { Buffer } from 'node:buffer';
import { AiProviderChain, VisionRequest } from '../ai';

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

/**
 * Process a batch of pages using the AI provider chain (vision capability).
 * Downloads each image, converts to base64, then sends to the chain.
 */
export async function processOcrBatch(
  pages: OcrPage[],
  aiChain: AiProviderChain
): Promise<OcrResult[]> {
  const results = await Promise.allSettled(
    pages.map(async (page) => {
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

      const response = await aiChain.vision({
        system: OCR_PROMPT,
        imageBase64: base64Image,
        mimeType
      });

      return {
        id: page.id,
        markdown: response.text,
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
