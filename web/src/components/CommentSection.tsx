import { useState } from 'react';
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
      <h3 className="text-sm font-medium text-muted-foreground">
        评论 ({comments.length})
      </h3>

      {/* Comment list */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground italic">暂无评论</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group relative rounded-lg bg-white/[0.02] border border-border/30 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{c.actor}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除评论"
                >
                  删除
                </button>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>

      {/* New comment form */}
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="添加评论…"
          rows={2}
          maxLength={2000}
          className="flex-1 min-w-0 bg-background border border-primary rounded px-2 py-1.5 text-sm resize-vertical"
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
          {submitting ? '发送中…' : '发送'}
        </Button>
      </div>
    </div>
  );
}
