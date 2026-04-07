import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Split text into chunks at sentence boundaries, max ~1000 chars per chunk
function splitTextIntoChunks(text: string, maxLen = 1000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at sentence boundary within maxLen
    let splitAt = -1;
    // Look for sentence-ending punctuation in the last 200 chars of the chunk
    const searchEnd = Math.min(maxLen, remaining.length);
    const searchStart = Math.max(maxLen - 200, 0);

    for (let i = searchEnd - 1; i >= searchStart; i--) {
      const ch = remaining[i];
      if (ch === '。' || ch === '！' || ch === '？' || ch === '；') {
        splitAt = i + 1;
        break;
      }
      if (ch === '.' || ch === '!' || ch === '?') {
        // Make sure it's not a decimal point
        if (i > 0 && /\d/.test(remaining[i - 1]) && i + 1 < remaining.length && /\d/.test(remaining[i + 1])) {
          continue;
        }
        splitAt = i + 1;
        break;
      }
      if (ch === '\n') {
        splitAt = i + 1;
        break;
      }
    }

    // If no sentence boundary found, try splitting at a space or comma
    if (splitAt === -1) {
      for (let i = searchEnd - 1; i >= searchStart; i--) {
        if (remaining[i] === ' ' || remaining[i] === ',' || remaining[i] === '，') {
          splitAt = i + 1;
          break;
        }
      }
    }

    // Last resort: hard split at maxLen
    if (splitAt === -1) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = 'tongtong', speed = 1.0 } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Validate voice
    const validVoices = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'];
    if (!validVoices.includes(voice)) {
      return NextResponse.json(
        { error: `Invalid voice. Must be one of: ${validVoices.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate speed
    if (typeof speed !== 'number' || speed < 0.5 || speed > 2.0) {
      return NextResponse.json(
        { error: 'Speed must be a number between 0.5 and 2.0' },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();
    const chunks = splitTextIntoChunks(text.trim());

    if (chunks.length === 1) {
      // Single chunk — return directly
      const response = await zai.audio.tts.create({
        input: chunks[0],
        voice,
        speed,
        response_format: 'mp3',
        stream: false,
      });

      const buffer = Buffer.from(new Uint8Array(await response.arrayBuffer()));
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Multiple chunks — concatenate audio buffers
    // For MP3, simple concatenation works well enough for sequential playback
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice,
        speed,
        response_format: 'mp3',
        stream: false,
      });
      const buf = Buffer.from(new Uint8Array(await response.arrayBuffer()));
      buffers.push(buf);
    }

    const concatenated = Buffer.concat(buffers);
    return new NextResponse(concatenated, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': concatenated.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[TTS Error]', error);
    const message = error instanceof Error ? error.message : 'Text-to-speech generation failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
