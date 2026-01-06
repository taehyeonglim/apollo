'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getEpisode, subscribeToComments } from '@/lib/firestore';
import { getPublicUrl } from '@/lib/storage';
import { addComment } from '@/lib/api';
import { useToast } from '@/components/Toast';
import type { Episode, Comment, Panel } from '@/types';
import { ALLOWED_EMOJIS } from '@/types';

interface PageProps {
  params: Promise<{ episodeId: string }>;
}

export default function EpisodePage({ params }: PageProps) {
  const { episodeId } = use(params);

  const { showToast } = useToast();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelImageUrls, setPanelImageUrls] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Comment[]>([]);

  // 에피소드 로드
  useEffect(() => {
    const loadEpisode = async () => {
      try {
        const ep = await getEpisode(episodeId);
        setEpisode(ep);

        if (ep?.panels) {
          loadPanelImages(ep.panels);
        }
      } catch (error) {
        console.error('[Episode] Load error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEpisode();
  }, [episodeId]);

  // 댓글 구독
  useEffect(() => {
    const unsubscribe = subscribeToComments(episodeId, setComments);
    return () => unsubscribe();
  }, [episodeId]);

  // 패널 이미지 URL 로드
  const loadPanelImages = async (panels: Panel[]) => {
    const urls: Record<number, string> = {};
    for (const panel of panels) {
      try {
        const url = await getPublicUrl(panel.imagePath);
        urls[panel.index] = url;
      } catch {
        // 이미지 없음
      }
    }
    setPanelImageUrls(urls);
  };

  // 댓글 추가
  const handleAddComment = async (emoji: string, text: string) => {
    try {
      const result = await addComment({ episodeId, emoji, text });
      if (result.success) {
        showToast('success', '댓글이 등록되었습니다!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '댓글 등록에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">에피소드를 찾을 수 없습니다.</p>
        <Link href="/gallery" className="text-indigo-600 hover:underline">
          갤러리로 이동
        </Link>
      </div>
    );
  }

  if (episode.status !== 'published') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">아직 공개되지 않은 에피소드입니다.</p>
        <Link href="/gallery" className="text-indigo-600 hover:underline">
          갤러리로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* 제목 영역 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{episode.title}</h1>
          {episode.finalPrompt?.summary && (
            <p className="text-gray-600 mt-2">{episode.finalPrompt.summary}</p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            {episode.publishedAt
              ? new Date(episode.publishedAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : ''}
          </p>
        </div>

        {/* 패널들 (스크롤) */}
        <div className="space-y-4 mb-8">
          {episode.panels.map((panel) => {
            const imageUrl = panelImageUrls[panel.index];

            return (
              <div key={panel.index} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="aspect-[4/5] bg-gray-100">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`Panel ${panel.index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      로딩 중...
                    </div>
                  )}
                </div>
                {panel.caption && (
                  <div className="px-4 py-3 text-center border-t border-gray-100">
                    <p className="text-gray-800">{panel.caption}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 댓글 섹션 */}
        <CommentSection comments={comments} onAddComment={handleAddComment} />

        {/* 갤러리 링크 */}
        <div className="text-center mt-8">
          <Link
            href="/gallery"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← 갤러리로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

/* 댓글 섹션 */
interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (emoji: string, text: string) => Promise<void>;
}

function CommentSection({ comments, onAddComment }: CommentSectionProps) {
  const [selectedEmoji, setSelectedEmoji] = useState<string>('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmoji) return;

    setIsSubmitting(true);
    try {
      await onAddComment(selectedEmoji, commentText);
      setSelectedEmoji('');
      setCommentText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <h3 className="font-bold text-lg text-gray-900 mb-4">
        댓글 {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* 댓글 입력 폼 */}
      <form onSubmit={handleSubmit} className="mb-6">
        {/* 이모지 선택 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {ALLOWED_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setSelectedEmoji(emoji)}
              className={`text-2xl p-1 rounded-lg transition-all ${
                selectedEmoji === emoji
                  ? 'bg-indigo-100 scale-110'
                  : 'hover:bg-gray-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* 텍스트 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="한마디 남기기 (선택)"
            maxLength={80}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!selectedEmoji || isSubmitting}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedEmoji && !isSubmitting
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? '...' : '등록'}
          </button>
        </div>
      </form>

      {/* 댓글 목록 */}
      {comments.length === 0 ? (
        <p className="text-center text-gray-400 py-4">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3 py-2">
              <span className="text-2xl">{comment.emoji}</span>
              <div className="flex-1">
                {comment.text && (
                  <p className="text-gray-800">{comment.text}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
