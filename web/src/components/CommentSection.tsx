'use client';

import { useState, useEffect } from 'react';
import { subscribeToComments } from '@/lib/firestore';
import { addComment } from '@/lib/api';
import type { Comment } from '@/types';
import { ALLOWED_EMOJIS } from '@/types';

interface CommentSectionProps {
  episodeId: string;
}

export default function CommentSection({ episodeId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 댓글 실시간 구독
  useEffect(() => {
    const unsubscribe = subscribeToComments(episodeId, setComments);
    return () => unsubscribe();
  }, [episodeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmoji) {
      setError('이모지를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await addComment({
        episodeId,
        emoji: selectedEmoji,
        text: text.trim(),
      });

      if (result.success) {
        setSelectedEmoji(null);
        setText('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || '댓글 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Comment error:', err);
      setError('댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">
        댓글 ({comments.length})
      </h2>

      {/* 댓글 작성 폼 */}
      <form onSubmit={handleSubmit} className="mb-8">
        {/* 이모지 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            이모지 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {ALLOWED_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                className={`emoji-btn ${
                  selectedEmoji === emoji ? 'selected' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 텍스트 입력 */}
        <div className="mb-4">
          <label
            htmlFor="comment-text"
            className="block text-sm font-medium text-gray-600 mb-2"
          >
            코멘트 (선택, 80자 이내)
          </label>
          <input
            id="comment-text"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            placeholder="짧은 코멘트를 남겨보세요..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            disabled={isSubmitting}
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {text.length}/80
          </div>
        </div>

        {/* 에러/성공 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">
            댓글이 등록되었습니다!
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={!selectedEmoji || isSubmitting}
          className={`w-full py-3 rounded-xl font-medium transition-all ${
            selectedEmoji && !isSubmitting
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? '등록 중...' : '댓글 달기'}
        </button>
      </form>

      {/* 댓글 목록 */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            첫 번째 댓글을 남겨보세요!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  const timeAgo = getTimeAgo(comment.createdAt);

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl animate-fade-in">
      <span className="text-2xl">{comment.emoji}</span>
      <div className="flex-1 min-w-0">
        {comment.text && (
          <p className="text-gray-700 break-words">{comment.text}</p>
        )}
        <span className="text-xs text-gray-400">{timeAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR');
}
