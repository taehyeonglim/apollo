'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Episode } from '@/types';
import type { DocumentSnapshot } from 'firebase/firestore';

export default function GalleryPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  // 클라이언트 마운트 확인
  useEffect(() => {
    setMounted(true);
  }, []);

  // 초기 로드 (클라이언트에서만)
  useEffect(() => {
    if (!mounted) return;
    loadEpisodes();
  }, [mounted]);

  const loadEpisodes = async () => {
    try {
      // 동적 import로 Firebase 모듈 로드
      const { getPublishedEpisodes } = await import('@/lib/firestore');
      console.log('[Gallery] Loading published episodes...');
      const result = await getPublishedEpisodes(12);
      console.log('[Gallery] Loaded episodes:', result.episodes.length, result.episodes);
      setEpisodes(result.episodes);
      setLastDoc(result.lastDoc);
      setHasMore(result.episodes.length >= 12);
      setLoading(false);

      // 썸네일 URL 로드
      loadThumbnails(result.episodes);
    } catch (error) {
      console.error('[Gallery] Load error:', error);
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore) return;

    setLoadingMore(true);
    try {
      const { getPublishedEpisodes } = await import('@/lib/firestore');
      const result = await getPublishedEpisodes(12, lastDoc);
      setEpisodes((prev) => [...prev, ...result.episodes]);
      setLastDoc(result.lastDoc);
      setHasMore(result.episodes.length >= 12);

      // 새 에피소드들의 썸네일 URL 로드
      loadThumbnails(result.episodes);
    } catch (error) {
      console.error('[Gallery] Load more error:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, loadingMore]);

  const loadThumbnails = async (newEpisodes: Episode[]) => {
    const { getPublicUrl } = await import('@/lib/storage');
    const urls: Record<string, string> = {};
    for (const ep of newEpisodes) {
      if (ep.thumbPath) {
        try {
          const url = await getPublicUrl(ep.thumbPath);
          urls[ep.id] = url;
        } catch {
          // 썸네일 없음
        }
      }
    }
    setThumbnailUrls((prev) => ({ ...prev, ...urls }));
  };

  // 로딩 상태 (마운트 전 또는 데이터 로딩 중)
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">갤러리</h1>
          <p className="text-gray-600">다른 사람들이 만든 인스타툰을 구경해보세요</p>
        </div>

        {episodes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 mb-4">아직 게시된 인스타툰이 없어요</p>
            <Link
              href="/create"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              첫 번째 인스타툰 만들기
            </Link>
          </div>
        ) : (
          <>
            {/* 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {episodes.map((episode) => (
                <EpisodeCard
                  key={episode.id}
                  episode={episode}
                  thumbnailUrl={thumbnailUrls[episode.id]}
                />
              ))}
            </div>

            {/* 더 보기 */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-white px-6 py-3 rounded-xl text-indigo-600 font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loadingMore ? '로딩 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface EpisodeCardProps {
  episode: Episode;
  thumbnailUrl?: string;
}

function EpisodeCard({ episode, thumbnailUrl }: EpisodeCardProps) {
  return (
    <Link href={`/episode/${episode.id}`} className="group">
      <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all">
        {/* 썸네일 */}
        <div className="aspect-[4/5] bg-gray-100 overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={episode.title || '인스타툰'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-4xl">🌙</span>
            </div>
          )}
        </div>

        {/* 정보 */}
        <div className="p-3">
          <h3 className="font-medium text-gray-900 truncate">
            {episode.title || '제목 없음'}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              {episode.panelCount}컷
            </span>
            <span className="text-xs text-gray-400">
              {episode.publishedAt
                ? new Date(episode.publishedAt).toLocaleDateString('ko-KR')
                : ''}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
