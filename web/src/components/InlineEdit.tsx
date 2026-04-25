import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface InlineEditProps {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  tag?: 'h1' | 'p' | 'div';
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  markdown?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  className,
  tag: Tag = 'div',
  placeholder = '',
  multiline = false,
  maxLength,
  markdown = false,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editing) {
    if (markdown) {
      return (
        <div
          className={`cursor-pointer rounded transition-colors p-0.5 px-1 -m-0.5 -mx-1 hover:bg-white/[0.04] ${!value ? 'text-muted-foreground italic' : ''} ${className || ''}`}
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {value ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            placeholder
          )}
        </div>
      );
    }
    return (
      <Tag
        className={`cursor-pointer rounded transition-colors p-0.5 px-1 -m-0.5 -mx-1 hover:bg-white/[0.04] ${!value ? 'text-muted-foreground italic' : ''} ${className || ''}`}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || placeholder}
      </Tag>
    );
  }

  const save = () => {
    if (maxLength && draft.length > maxLength) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  const inputBaseClass = `w-full bg-background border border-primary rounded px-2 py-1 resize-vertical ${className || ''}`;
  const overLimit = maxLength !== undefined && draft.length > maxLength;

  if (markdown) {
    return (
      <div>
        <MDEditor
          value={draft}
          onChange={(v) => setDraft(v ?? '')}
          onBlur={save}
          height={200}
          preview="live"
          className="rounded border border-primary"
        />
        {maxLength !== undefined && (
          <div className={`text-[11px] mt-1 ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {draft.length}/{maxLength}
          </div>
        )}
      </div>
    );
  }

  if (multiline) {
    return (
      <div>
        <textarea
          className={inputBaseClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          autoFocus
          maxLength={maxLength}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
          }}
        />
        {maxLength !== undefined && (
          <div className={`text-[11px] mt-1 ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {draft.length}/{maxLength}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        className={inputBaseClass}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        autoFocus
        maxLength={maxLength}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
      {maxLength !== undefined && (
        <div className={`text-[11px] mt-1 ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
          {draft.length}/{maxLength}
        </div>
      )}
    </div>
  );
}
