import type { ToolExecutionResult, ToolExecutionContext } from '../types';

const MAX_FETCH_SIZE = 2 * 1024 * 1024; // 2MB
const FETCH_TIMEOUT = 15_000; // 15 seconds

/**
 * web-search: Search the web using z-ai-web-dev-sdk
 */
export async function executeWebSearch(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const query = args.query as string;
  if (!query) {
    return { output: 'Error: "query" argument is required for web-search.', isError: true };
  }

  const num = typeof args.num === 'number' ? Math.min(args.num, 20) : 10;

  try {
    // Dynamic import to avoid loading SDK when not needed
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const searchResult = await zai.functions.invoke('web_search', {
      query,
      num,
    });

    if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
      return { output: `No results found for: "${query}"` };
    }

    const lines: string[] = [`Web search results for: "${query}"\n${'='.repeat(60)}\n`];

    for (let i = 0; i < searchResult.length; i++) {
      const result = searchResult[i];
      lines.push(`${i + 1}. ${result.name || 'Untitled'}`);
      lines.push(`   URL: ${result.url}`);
      if (result.snippet) {
        lines.push(`   ${result.snippet}`);
      }
      if (result.host_name) {
        lines.push(`   Host: ${result.host_name}`);
      }
      lines.push('');
    }

    lines.push(`--- ${searchResult.length} result(s) returned ---`);

    return {
      output: lines.join('\n'),
      metadata: {
        query,
        resultCount: searchResult.length,
      },
    };
  } catch (error) {
    return {
      output: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
      metadata: { query },
    };
  }
}

/**
 * Basic HTML to text extraction
 */
function extractTextFromHtml(html: string): { title: string; text: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

  // Remove script and style tags
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|h[1-6]|br|li|tr|blockquote|pre|section|article|header|footer|nav|main|aside)[^>]*>/gi, '\n');

  // Replace remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return { title, text: text.trim() };
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

/**
 * web-fetch: Fetch and extract content from a URL
 */
export async function executeWebFetch(
  args: Record<string, unknown>,
  _context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const url = args.url as string;
  if (!url) {
    return { output: 'Error: "url" argument is required for web-fetch.', isError: true };
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { output: `Error: Invalid URL: "${url}"`, isError: true };
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { output: `Error: Only HTTP and HTTPS URLs are supported. Got: ${parsedUrl.protocol}`, isError: true };
  }

  const raw = !!args.raw;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CodeBot/3.0 (Tool Executor)',
        Accept: raw ? 'text/html,*/*' : 'text/html,application/xhtml+xml,text/plain,*/*',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        output: `Error: HTTP ${response.status} ${response.statusText} for URL: ${url}`,
        isError: true,
        metadata: { statusCode: response.status, url },
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

    // Check size limit
    if (contentLength > MAX_FETCH_SIZE) {
      return {
        output: `Error: Response too large (${contentLength} bytes, max ${MAX_FETCH_SIZE}). Consider using raw=false for text extraction.`,
        isError: true,
      };
    }

    const body = await response.text();

    if (raw) {
      return {
        output: body.substring(0, MAX_FETCH_SIZE),
        metadata: {
          url,
          statusCode: response.status,
          contentType,
          size: body.length,
          encoding: 'utf-8',
        },
      };
    }

    // Extract text from HTML
    const { title, text } = extractTextFromHtml(body);

    if (!text.trim()) {
      return {
        output: `Page returned empty content.\nURL: ${url}\nContent-Type: ${contentType}\nSize: ${body.length} bytes`,
        isError: true,
      };
    }

    // Truncate very long text content
    const maxTextLength = 50_000;
    let extractedText = text;
    let truncated = false;
    if (text.length > maxTextLength) {
      extractedText = text.substring(0, maxTextLength) + '\n\n... [CONTENT TRUNCATED] ...';
      truncated = true;
    }

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    const output = [
      `--- ${title || 'Untitled Page'} ---`,
      `URL: ${url}`,
      `Words: ${wordCount}${truncated ? ' (truncated)' : ''}`,
      '',
      extractedText,
    ].join('\n');

    return {
      output,
      metadata: {
        url,
        title,
        statusCode: response.status,
        contentType,
        wordCount,
        totalChars: text.length,
        truncated,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        output: `Error: Request timed out after ${FETCH_TIMEOUT / 1000}s while fetching: ${url}`,
        isError: true,
      };
    }
    return {
      output: `Error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
