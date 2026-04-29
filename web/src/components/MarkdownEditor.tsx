import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useRef } from 'react';
import TurndownService from 'turndown';
import { marked } from 'marked';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

function markdownToHtml(md: string): string {
  if (!md) return '';
  return marked.parse(md, { async: false }) as string;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  height?: number;
  className?: string;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  height = 200,
  className = '',
  placeholder = '',
}: MarkdownEditorProps) {
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToHtml(value),
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      onChange(md);
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
    },
  });

  const updateContent = useCallback(
    (newValue: string) => {
      if (!editor || editor.isDestroyed) return;
      const currentMd = htmlToMarkdown(editor.getHTML());
      if (newValue !== currentMd) {
        isUpdatingRef.current = true;
        editor.commands.setContent(markdownToHtml(newValue));
        isUpdatingRef.current = false;
      }
    },
    [editor],
  );

  useEffect(() => {
    updateContent(value);
  }, [value, updateContent]);

  if (!editor) return null;

  return (
    <div
      className={`rounded border border-primary bg-background overflow-y-auto ${className}`}
      style={{ height, minHeight: height }}
    >
      <style>{`
        .ProseMirror { min-height: ${height}px; padding: 0.875rem 1rem; outline: none; font-size: 0.95rem; line-height: 1.7; }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--color-muted-foreground, #a1a1aa);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          font-style: italic;
        }
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0; }
        .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0; }
        .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; }
        .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; }
        .ProseMirror code { background: rgba(255,255,255,0.08); padding: 0.15rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
        .ProseMirror pre { background: rgba(255,255,255,0.06); padding: 0.75rem; border-radius: 4px; }
        .ProseMirror pre code { background: none; padding: 0; }
        .ProseMirror blockquote { border-left: 3px solid var(--color-border, #333); padding-left: 0.75rem; opacity: 0.8; }
        .ProseMirror hr { border: none; border-top: 1px solid var(--color-border, #333); margin: 1rem 0; }
        .ProseMirror p { margin: 0.45rem 0; }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
}
