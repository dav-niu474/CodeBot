import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/x-m4a',
      'audio/mp3',
    ];
    if (!validTypes.includes(audioFile.type) && !audioFile.name.match(/\.(webm|mp4|mp3|wav|ogg|m4a)$/i)) {
      return NextResponse.json(
        { error: 'Invalid audio format. Supported: webm, mp4, mp3, wav, ogg, m4a' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Audio = Buffer.from(uint8Array).toString('base64');

    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({
      file_base64: base64Audio,
    });

    const transcription = response.text || '';

    return NextResponse.json({
      text: transcription,
    });
  } catch (error) {
    console.error('[ASR Error]', error);
    const message = error instanceof Error ? error.message : 'Speech recognition failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
