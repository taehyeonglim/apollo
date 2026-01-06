'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getEpisode } from '@/lib/firestore';
import { getPublicUrl } from '@/lib/storage';
import CommentSection from '@/components/CommentSection';
import type { Episode, Panel } from '@/types';

interface PageProps {
  params: Promise<{ episodeId: string }>;
}

export default function EpisodePage({ params }: PageProps) {
  const { episodeId } = use(params);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelImageUrls, setPanelImageUrls] = useState<Record<number, string>>({});

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
        <CommentSection episodeId={episodeId} />

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
