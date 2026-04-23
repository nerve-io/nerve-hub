import { useState, useEffect } from 'react';

interface InlineEditProps {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  tag?: 'h1' | 'p' | 'div';
  placeholder?: string;
  multiline?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  className,
  tag: Tag = 'div',
  placeholder = '',
  multiline = false,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editing) {
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
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  const inputBaseClass = `w-full bg-background border border-primary rounded px-2 py-1 resize-vertical ${className || ''}`;

  if (multiline) {
    return (
      <textarea
        className={inputBaseClass}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      />
    );
  }

  return (
    <input
      className={inputBaseClass}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
    />
  );
}
