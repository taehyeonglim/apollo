'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { getToon } from '@/lib/firestore';
import type { Toon } from '@/types';
import CommentSection from '@/components/CommentSection';

export default function ToonViewPage() {
  const params = useParams();
  const toonId = params.id as string;

  const [toon, setToon] = useState<Toon | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPanel, setCurrentPanel] = useState(0);

  useEffect(() => {
    loadToon();
  }, [toonId]);

  const loadToon = async () => {
    try {
      const data = await getToon(toonId);
      setToon(data);
    } catch (error) {
      console.error('Failed to load toon:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-indigo-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!toon) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-4">
          툰을 찾을 수 없습니다
        </h1>
        <a href="/gallery" className="text-indigo-600 hover:underline">
          갤러리로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 제목 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-indigo-900 mb-2">
          {toon.title}
        </h1>
        <p className="text-gray-600">{toon.storyboard.summary}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-gray-400">
          <span>💬 {toon.commentCount}</span>
          <span>👀 {toon.viewCount}</span>
          <span>
            {toon.publishedAt?.toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>

      {/* 패널 뷰어 (슬라이드) */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
        {/* 현재 패널 */}
        <div className="aspect-square relative bg-gray-100">
          {toon.panels[currentPanel]?.imageUrl && (
            <Image
              src={toon.panels[currentPanel].imageUrl}
              alt={`Panel ${currentPanel + 1}`}
              fill
              className="object-cover"
              priority
            />
          )}
        </div>

        {/* 캡션 */}
        <div className="p-6 text-center">
          <p className="text-xl font-medium text-gray-800">
            {toon.panels[currentPanel]?.caption}
          </p>
        </div>

        {/* 네비게이션 */}
        <div className="flex items-center justify-between px-4 pb-4">
          <button
            onClick={() => setCurrentPanel((prev) => Math.max(0, prev - 1))}
            disabled={currentPanel === 0}
            className="px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-200 transition-colors"
          >
            ← 이전
          </button>

          {/* 인디케이터 */}
          <div className="flex gap-2">
            {toon.panels.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPanel(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentPanel
                    ? 'bg-indigo-600'
                    : 'bg-indigo-200 hover:bg-indigo-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() =>
              setCurrentPanel((prev) => Math.min(toon.panels.length - 1, prev + 1))
            }
            disabled={currentPanel === toon.panels.length - 1}
            className="px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-200 transition-colors"
          >
            다음 →
          </button>
        </div>
      </div>

      {/* 전체 보기 (그리드) */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">전체 보기</h2>
        <div className="panel-grid">
          {toon.panels.map((panel, index) => (
            <button
              key={panel.id}
              onClick={() => setCurrentPanel(index)}
              className={`aspect-square relative rounded-lg overflow-hidden transition-all ${
                index === currentPanel
                  ? 'ring-4 ring-indigo-500 scale-[1.02]'
                  : 'hover:ring-2 hover:ring-indigo-300'
              }`}
            >
              <Image
                src={panel.imageUrl}
                alt={`Panel ${index + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {/* 댓글 섹션 */}
      <CommentSection toonId={toonId} />
    </div>
  );
}
