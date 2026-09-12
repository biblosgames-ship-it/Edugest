import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface LinkifiedTextProps {
  text?: string | null;
  className?: string;
  clampLines?: number;
  allowExpand?: boolean;
}

interface TextPart {
  type: 'text' | 'link';
  content: string;
  href?: string;
}

export function parseTextWithLinks(text: string): TextPart[] {
  if (!text) return [];

  // Regex que detecta:
  // 1. Enlaces estilo markdown: [Título](url)
  // 2. URLs directas (http, https, www.) respetando puntuación final
  const urlRegex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<>()]+(?:\([^\s<>()]+\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;

  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    if (match[1] && match[2]) {
      // Formato markdown [título](url)
      const label = match[1];
      const url = match[2];
      const href = url.startsWith('www.') ? `https://${url}` : url;
      parts.push({ type: 'link', content: label, href });
    } else if (match[3]) {
      // URL plana
      const rawUrl = match[3];
      const href = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
      parts.push({ type: 'link', content: rawUrl, href });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className = '',
  clampLines,
  allowExpand = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const parts = parseTextWithLinks(text);
  const hasLinks = parts.some((p) => p.type === 'link');
  const isLong = text.length > 180 || text.split('\n').length > 3;
  const shouldClamp = clampLines && !isExpanded && allowExpand && isLong;

  return (
    <div className="space-y-1">
      <p
        className={`whitespace-pre-line leading-relaxed ${className} ${
          shouldClamp ? `line-clamp-${clampLines}` : ''
        }`}
      >
        {parts.map((part, idx) => {
          if (part.type === 'link' && part.href) {
            return (
              <a
                key={idx}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Abrir ${part.href}`}
                className="text-indigo-600 dark:text-indigo-400 font-bold underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 rounded px-0.5 transition-all break-all inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>{part.content}</span>
                <ExternalLink
                  size={11}
                  className="inline-block flex-shrink-0 opacity-70 ml-0.5"
                />
              </a>
            );
          }
          return <span key={idx}>{part.content}</span>;
        })}
      </p>

      {clampLines && allowExpand && isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition-colors cursor-pointer pt-0.5"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={12} /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Ver más {hasLinks && '(con enlaces)'}
            </>
          )}
        </button>
      )}
    </div>
  );
};
