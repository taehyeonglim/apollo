'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { subscribeToDraft } from '@/lib/firestore';
import { generatePanel, publishToon } from '@/lib/api';
import type { Draft, Panel } from '@/types';

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPanels, setGeneratingPanels] = useState<Set<number>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 드래프트 구독
  useEffect(() => {
    const unsubscribe = subscribeToDraft(draftId, (data) => {
      setDraft(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [draftId]);

  // 패널 이미지 생성
  const handleGeneratePanel = useCallback(async (panelIndex: number, regenerate = false) => {
    if (generatingPanels.has(panelIndex)) return;

    setGeneratingPanels((prev) => new Set(prev).add(panelIndex));
    setError(null);

    try {
      const result = await generatePanel({
        draftId,
        panelIndex,
        regenerate,
      });

      if (!result.success) {
        setError(result.error || '이미지 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Panel generation error:', err);
      setError('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingPanels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(panelIndex);
        return newSet;
      });
    }
  }, [draftId, generatingPanels]);

  // 모든 패널 생성
  const handleGenerateAll = useCallback(async () => {
    if (!draft?.storyboard) return;

    for (let i = 0; i < draft.storyboard.panels.length; i++) {
      const existingPanel = draft.panels.find((p) => p.order === i);
      if (!existingPanel) {
        await handleGeneratePanel(i);
      }
    }
  }, [draft, handleGeneratePanel]);

  // 게시
  const handlePublish = async () => {
    if (!draft) return;

    setPublishing(true);
    setError(null);

    try {
      const result = await publishToon({ draftId });

      if (result.success && result.toonId) {
        router.push(`/toon/${result.toonId}`);
      } else {
        setError(result.error || '게시에 실패했습니다.');
      }
    } catch (err) {
      console.error('Publish error:', err);
      setError('게시 중 오류가 발생했습니다.');
    } finally {
      setPublishing(false);
    }
  };

  // 게시 가능 여부
  const canPublish = draft?.storyboard &&
    draft.panels.length === draft.storyboard.panels.length;

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

  if (!draft) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-4">
          드래프트를 찾을 수 없습니다
        </h1>
        <a href="/" className="text-indigo-600 hover:underline">
          홈으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-indigo-900 mb-2">
          {draft.storyboard?.title || '인스타툰 에디터'}
        </h1>
        {draft.storyboard?.summary && (
          <p className="text-gray-600">{draft.storyboard.summary}</p>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6 animate-fade-in">
          {error}
        </div>
      )}

      {/* 패널 그리드 */}
      {draft.storyboard && (
        <div className="panel-grid mb-8">
          {draft.storyboard.panels.map((spec, index) => {
            const panel = draft.panels.find((p) => p.order === index);
            const isGenerating = generatingPanels.has(index);

            return (
              <div
                key={index}
                className="bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in"
              >
                {/* 이미지 영역 */}
                <div className="aspect-square relative bg-gray-100">
                  {panel?.imageUrl ? (
                    <>
                      <Image
                        src={panel.imageUrl}
                        alt={spec.caption}
                        fill
                        className="object-cover"
                      />
                      {/* 재생성 버튼 */}
                      <button
                        onClick={() => handleGeneratePanel(index, true)}
                        disabled={isGenerating}
                        className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                        title="재생성"
                      >
                        🔄
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {isGenerating ? (
                        <div className="text-center">
                          <div className="spinner mx-auto mb-2"></div>
                          <p className="text-sm text-gray-500">생성 중...</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGeneratePanel(index)}
                          className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                          이미지 생성
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 캡션 */}
                <div className="p-4">
                  <p className="text-center font-medium text-gray-800">
                    {spec.caption}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {spec.composition} / {spec.emotion}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-4 justify-center">
        {/* 전체 생성 버튼 */}
        {draft.storyboard && draft.panels.length < draft.storyboard.panels.length && (
          <button
            onClick={handleGenerateAll}
            disabled={generatingPanels.size > 0}
            className="px-8 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50"
          >
            {generatingPanels.size > 0 ? '생성 중...' : '모든 이미지 생성'}
          </button>
        )}

        {/* 게시 버튼 */}
        <button
          onClick={handlePublish}
          disabled={!canPublish || publishing}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${
            canPublish && !publishing
              ? 'bg-gradient-to-r from-indigo-600 to-pink-500 text-white hover:shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {publishing ? '게시 중...' : '갤러리에 게시 🎉'}
        </button>
      </div>

      {/* 원본 일기 */}
      <div className="mt-12 bg-white/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-2">원본 일기</h3>
        <p className="text-gray-600 whitespace-pre-wrap text-sm">
          {draft.originalDiary}
        </p>
      </div>
    </div>
  );
}
