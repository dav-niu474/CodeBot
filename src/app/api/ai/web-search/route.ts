import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, num = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    const numResults = Math.min(Math.max(Number(num) || 5, 1), 20);

    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query,
      num: numResults,
    });

    if (!results || results.length === 0) {
      return NextResponse.json({
        query,
        results: [],
        count: 0,
        message: 'No results found for the given query.',
      });
    }

    const formattedResults = results.map((result: { url: string; name: string; snippet: string; host_name: string; rank: number; date: string; favicon: string }) => ({
      url: result.url,
      title: result.name,
      snippet: result.snippet,
      hostName: result.host_name,
      rank: result.rank,
      date: result.date,
      favicon: result.favicon,
    }));

    return NextResponse.json({
      query,
      results: formattedResults,
      count: formattedResults.length,
    });
  } catch (error: unknown) {
    console.error('Web Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to perform web search', details: message },
      { status: 500 }
    );
  }
}
