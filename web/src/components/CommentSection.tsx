import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createComment, deleteComment } from '../api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { relativeTime } from '../utils';
import type { Comment } from '../types';

interface Props {
  taskId: string;
  comments: Comment[];
  onUpdated: () => void;
}

export function CommentSection({ taskId, comments, onUpdated }: Props) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await createComment(taskId, trimmed);
      setBody('');
      onUpdated();
    } catch (err: any) {
      toast(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      onUpdated();
    } catch (err: any) {
      toast(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        {t('comment.sectionTitle', { count: comments.length })}
      </h3>

      {/* Comment list */}
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground italic">{t('comment.empty')}</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group relative rounded-lg bg-background/50 border border-border/50 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{c.actor}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title={t('comment.deleteTitle')}
                >
                  {t('comment.delete')}
                </button>
              </div>
            </div>
            <p className="text-sm leading-6 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>

      {/* New comment form */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('comment.placeholder')}
          rows={2}
          maxLength={2000}
          className="min-h-[88px] flex-1 min-w-0 rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm leading-6 resize-vertical focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          className="self-end"
        >
          {submitting ? t('comment.sending') : t('comment.send')}
        </Button>
      </div>
    </div>
  );
}
