'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getPublishedToons } from '@/lib/firestore';
import type { Toon } from '@/types';
import { DocumentSnapshot } from 'firebase/firestore';

export default function GalleryPage() {
  const [toons, setToons] = useState<Toon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // 초기 로드
  useEffect(() => {
    loadToons();
  }, []);

  const loadToons = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getPublishedToons(12, loadMore ? lastDoc ?? undefined : undefined);

      if (loadMore) {
        setToons((prev) => [...prev, ...result.toons]);
      } else {
        setToons(result.toons);
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.toons.length === 12);
    } catch (error) {
      console.error('Failed to load toons:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-indigo-600">갤러리 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-indigo-900 mb-3">
          인스타툰 갤러리
        </h1>
        <p className="text-gray-600">
          다양한 일상이 만화로 태어났어요
        </p>
      </div>

      {/* 툰 그리드 */}
      {toons.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg mb-4">
            아직 게시된 인스타툰이 없습니다.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            첫 번째 인스타툰 만들기
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {toons.map((toon) => (
              <ToonCard key={toon.id} toon={toon} />
            ))}
          </div>

          {/* 더보기 버튼 */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={() => loadToons(true)}
                disabled={loadingMore}
                className="px-8 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50"
              >
                {loadingMore ? '로딩 중...' : '더 보기'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToonCard({ toon }: { toon: Toon }) {
  // 첫 번째 패널 이미지를 썸네일로 사용
  const thumbnail = toon.panels[0]?.imageUrl;

  return (
    <Link href={`/toon/${toon.id}`}>
      <article className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer">
        {/* 썸네일 */}
        <div className="aspect-square relative bg-gray-100">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={toon.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
          {/* 패널 수 뱃지 */}
          <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-sm">
            {toon.panels.length}컷
          </div>
        </div>

        {/* 정보 */}
        <div className="p-4">
          <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1">
            {toon.title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2">
            {toon.storyboard.summary}
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
            <span>💬 {toon.commentCount}</span>
            <span>👀 {toon.viewCount}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
