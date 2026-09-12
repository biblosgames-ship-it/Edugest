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
  const getClampClass = (lines?: number) => {
    if (!lines) return '';
    switch (lines) {
      case 1: return 'line-clamp-1';
      case 2: return 'line-clamp-2';
      case 3: return 'line-clamp-3';
      case 4: return 'line-clamp-4';
      case 5: return 'line-clamp-5';
      case 6: return 'line-clamp-6';
      default: return 'line-clamp-3';
    }
  };

  const isLong = text.length > 200 || text.split('\n').length > 3;
  const shouldClamp = Boolean(clampLines && !isExpanded && allowExpand && isLong);

  return (
    <div className="space-y-1.5">
      <div
        style={{ color: '#0f172a' }}
        className={`whitespace-pre-line leading-relaxed break-words font-medium text-slate-900 ${className} ${
          shouldClamp ? getClampClass(clampLines) : ''
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
                style={{ color: '#3730a3', textDecorationColor: '#4f46e5' }}
                className="font-black underline underline-offset-4 hover:text-indigo-900 hover:bg-indigo-100/70 rounded px-1 py-0.5 transition-all break-all inline-flex items-center gap-1 cursor-pointer mx-0.5"
              >
                <span>{part.content}</span>
                <ExternalLink
                  size={12}
                  className="inline-block flex-shrink-0 opacity-80"
                />
              </a>
            );
          }
          return (
            <span key={idx} style={{ color: '#0f172a' }} className="text-slate-900">
              {part.content}
            </span>
          );
        })}
      </div>

      {clampLines && allowExpand && isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{ color: '#4338ca' }}
          className="text-[11px] font-black uppercase tracking-wider hover:text-indigo-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-indigo-50"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={13} /> Contraer texto
            </>
          ) : (
            <>
              <ChevronDown size={13} /> Leer tarea completa {hasLinks && '• tiene enlaces'}
            </>
          )}
        </button>
      )}
    </div>
  );
};
