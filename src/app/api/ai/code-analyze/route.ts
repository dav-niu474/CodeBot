import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

type AnalyzeType = 'review' | 'explain' | 'optimize' | 'debug' | 'document';

const ANALYZE_PROMPTS: Record<AnalyzeType, string> = {
  review: `You are an expert code reviewer. Analyze the provided code and give a thorough review covering:
1. **Code Quality**: Naming conventions, readability, structure
2. **Potential Bugs**: Edge cases, null checks, error handling
3. **Performance**: Inefficiencies, unnecessary computations
4. **Security**: Vulnerabilities, input validation, injection risks
5. **Best Practices**: Design patterns, SOLID principles, DRY
Provide specific line references and actionable suggestions. Format your response with clear sections and bullet points.`,

  explain: `You are a patient and thorough code teacher. Explain the provided code in detail:
1. **Overview**: What does this code do at a high level?
2. **Step-by-Step**: Walk through the code logic line by line or block by block
3. **Key Concepts**: What programming concepts, patterns, or libraries are used?
4. **Dependencies**: What are the inputs, outputs, and side effects?
5. **Context**: When and why would someone use this code?
Use clear language, analogies where helpful, and code examples to illustrate points.`,

  optimize: `You are a performance optimization expert. Analyze the provided code and suggest optimizations:
1. **Time Complexity**: Identify algorithmic improvements (Big O analysis)
2. **Space Complexity**: Reduce memory usage
3. **Caching**: Opportunities for memoization or caching
4. **Parallelism**: Parts that could run concurrently
5. **Language-Specific**: Idiomatic optimizations for the language
Provide the optimized code with explanations for each change. Estimate the performance improvement where possible.`,

  debug: `You are a senior debugging specialist. Analyze the provided code for bugs:
1. **Runtime Errors**: Null/undefined access, type errors, out of bounds
2. **Logic Errors**: Incorrect conditions, off-by-one, race conditions
3. **Resource Leaks**: Unclosed connections, memory leaks, file handles
4. **Concurrency Issues**: Deadlocks, race conditions, missing synchronization
5. **Edge Cases**: Empty inputs, boundary values, unusual inputs
For each bug found, explain the issue, its impact, and provide the fix with corrected code.`,

  document: `You are a technical documentation expert. Generate comprehensive documentation for the provided code:
1. **Module Overview**: Purpose and scope
2. **API Reference**: Document all functions/classes/interfaces with parameters, return types, and examples
3. **Usage Examples**: Practical code examples showing common use cases
4. **Architecture**: How this code fits into a larger system
5. **Dependencies**: Required imports, external libraries, system requirements
Format the documentation in a clean, professional style suitable for a README or docs site.`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language, analyzeType } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'code is required and must be a string' },
        { status: 400 }
      );
    }

    if (!analyzeType || typeof analyzeType !== 'string') {
      return NextResponse.json(
        { error: 'analyzeType is required (review, explain, optimize, debug, document)' },
        { status: 400 }
      );
    }

    const validTypes: AnalyzeType[] = ['review', 'explain', 'optimize', 'debug', 'document'];
    if (!validTypes.includes(analyzeType as AnalyzeType)) {
      return NextResponse.json(
        { error: `Invalid analyzeType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const effectiveLanguage = language || 'auto-detect';
    const systemPrompt = ANALYZE_PROMPTS[analyzeType as AnalyzeType];

    const userMessage = `Please analyze the following ${effectiveLanguage} code:\n\n\`\`\`${effectiveLanguage}\n${code}\n\`\`\``;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });

    const analysisResult = completion.choices[0]?.message?.content || 'Unable to analyze the code.';

    return NextResponse.json({
      analysis: analysisResult,
      analyzeType,
      language: effectiveLanguage,
      codeLength: code.length,
    });
  } catch (error: unknown) {
    console.error('Code Analyze API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Failed to analyze code', details: message },
      { status: 500 }
    );
  }
}
