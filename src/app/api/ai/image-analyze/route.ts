import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const message = formData.get('message') as string | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'system',
          content:
            'You are CodeBot, a helpful AI coding assistant. Analyze the provided image carefully and respond to the user query about it. Be detailed and specific in your analysis.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: message || 'Please analyze this image in detail.',
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
    });

    const responseContent =
      completion.choices[0]?.message?.content ||
      'Sorry, I could not analyze this image.';

    return NextResponse.json({
      content: responseContent,
      imagePreview: `data:${mimeType};base64,${base64}`,
    });
  } catch (error: unknown) {
    console.error('Image analyze API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to analyze image', details: message },
      { status: 500 }
    );
  }
}
