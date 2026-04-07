'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Components } from 'react-markdown';

// ─── CopyButton ───
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ─── MermaidDiagram ───
function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState(false);
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let cancelled = false;
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        const { svg: renderedSvg } = await mermaid.render(id.current, code);
        if (!cancelled) setSvg(renderedSvg);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-xs text-amber-400">Failed to render diagram</p>
        <pre className="mt-1 text-[11px] text-muted-foreground overflow-x-auto">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-2 rounded-lg border border-border/50 bg-muted/30 p-6 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Loading diagram...</span>
      </div>
    );
  }

  return (
    <div
      className="my-2 overflow-x-auto rounded-lg border border-border/50 bg-card/50 p-4"
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ─── Math Inline / Block Placeholder ───
function MathBlock({ content, inline }: { content: string; inline: boolean }) {
  if (inline) {
    return (
      <code className="rounded border border-violet-500/20 bg-violet-500/5 px-1.5 py-0.5 font-mono text-xs text-violet-300">
        {content}
      </code>
    );
  }
  return (
    <div className="my-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 font-mono text-xs text-violet-300 overflow-x-auto">
      <pre className="whitespace-pre-wrap">{content}</pre>
    </div>
  );
}

// ─── Pre-process content for math placeholders ───
function preprocessMathContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  const inlineMathRegex = /\$([^\$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // First, handle block math ($$...$$)
  const blockMatches: { index: number; length: number; content: string }[] = [];
  while ((match = blockMathRegex.exec(content)) !== null) {
    blockMatches.push({ index: match.index, length: match[0].length, content: match[1].trim() });
  }

  // Build a string with placeholders for block math
  let processed = content;
  const placeholders: string[] = [];
  for (let i = blockMatches.length - 1; i >= 0; i--) {
    const bm = blockMatches[i];
    const placeholder = `%%MATH_BLOCK_${i}%%`;
    processed = processed.slice(0, bm.index) + placeholder + processed.slice(bm.index + bm.length);
    placeholders[i] = bm.content;
  }

  // Then handle inline math ($...$) in the remaining string
  // We'll process the content through ReactMarkdown and handle math in a different way
  // For simplicity, we'll replace inline math with a special span that ReactMarkdown will pass through
  let finalContent = processed;
  while ((match = inlineMathRegex.exec(finalContent)) !== null) {
    // Only process if not inside a block math placeholder
    const isInsidePlaceholder = placeholders.some((_, idx) => {
      const placeholder = `%%MATH_BLOCK_${idx}%%`;
      const start = finalContent.indexOf(placeholder);
      const end = start + placeholder.length;
      return match!.index >= start && match!.index <= end;
    });
    if (!isInsidePlaceholder) {
      // Replace with a styled code block inline
      const escaped = match[1].replace(/`/g, '\\`');
      finalContent =
        finalContent.slice(0, match.index) +
        `<code class="math-inline">${escaped}</code>` +
        finalContent.slice(match.index + match[0].length);
      inlineMathRegex.lastIndex = match.index + `<code class="math-inline">${escaped}</code>`.length;
    }
  }

  // Handle block math placeholders - replace with styled blocks
  for (let i = 0; i < placeholders.length; i++) {
    const escaped = placeholders[i].replace(/`/g, '\\`');
    const blockHtml = `<div class="math-block"><pre>${escaped}</pre></div>`;
    finalContent = finalContent.replace(`%%MATH_BLOCK_${i}%%`, blockHtml);
  }

  return [finalContent];
}

// ─── RichContentRenderer ───
interface RichContentRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function RichContentRenderer({ content, isStreaming }: RichContentRendererProps) {
  const processedContent = preprocessMathContent(content);

  const components: Components = {
    code({ className, children, node, ...props }) {
      // Check if this is a math inline code
      if (className === 'math-inline') {
        return <MathBlock content={String(children)} inline />;
      }

      // Check if this is inside a pre block (code block) or inline code
      const isBlock = node?.position?.start?.line !== node?.position?.end?.line;

      if (isBlock) {
        const match = /language-(\w+)/.exec(className || '');
        const lang = match ? match[1] : '';
        const codeString = String(children).replace(/\n$/, '');

        // Mermaid diagram
        if (lang === 'mermaid') {
          return <MermaidDiagram code={codeString} />;
        }

        // Regular code block
        return (
          <div className="codebot-code-block my-2">
            <div className="codebot-code-header">
              <span className="font-mono text-xs">{lang || 'code'}</span>
              <CopyButton text={codeString} />
            </div>
            <SyntaxHighlighter
              style={oneDark}
              language={lang || 'text'}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'oklch(0.09 0.005 260)',
                fontSize: '0.75rem',
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      // Inline code
      return (
        <code
          className="rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.8em] text-emerald-400/90"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
    // Table styling
    table({ children }) {
      return (
        <div className="my-2 overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-xs">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return (
        <thead className="border-b border-border/50 bg-muted/50">{children}</thead>
      );
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
          {children}
        </th>
      );
    },
    td({ children }) {
      return <td className="px-3 py-2 border-t border-border/30">{children}</td>;
    },
    // Task list styling
    input({ checked, ...props }) {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mr-2 h-3.5 w-3.5 rounded border-border accent-emerald-500"
          {...props}
        />
      );
    },
    // Image styling
    img({ src, alt, ...props }) {
      return (
        <div className="my-2 overflow-hidden rounded-lg border border-border/50">
          <img
            src={src}
            alt={alt || ''}
            className="max-h-64 w-auto object-contain"
            loading="lazy"
            {...props}
          />
        </div>
      );
    },
    // Math block from pre-processor
    div({ className: cName, children, ...props }) {
      if (cName === 'math-block') {
        return (
          <div className="my-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 font-mono text-xs text-violet-300 overflow-x-auto">
            {children}
          </div>
        );
      }
      return (
        <div className={cName} {...props}>
          {children}
        </div>
      );
    },
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processedContent[0] as string}
      </ReactMarkdown>
    </div>
  );
}
