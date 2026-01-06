'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth, useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { subscribeToEpisode, updateEpisodeCaptions } from '@/lib/firestore';
import { generatePanelImages, publishEpisode } from '@/lib/api';
import { getPublicUrl } from '@/lib/storage';
import type { Episode, PanelPrompt, AspectRatio } from '@/types';

interface PageProps {
  params: Promise<{ episodeId: string }>;
}

export default function EditPage({ params }: PageProps) {
  const { episodeId } = use(params);

  return (
    <RequireAuth>
      <EditContent episodeId={episodeId} />
    </RequireAuth>
  );
}

function EditContent({ episodeId }: { episodeId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // 에피소드 상태
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  // 편집 상태
  const [editedCaptions, setEditedCaptions] = useState<Record<number, string>>({});
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:5');

  // 이미지 생성 상태
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    total: number;
    completed: number;
    failed: number[];
  } | null>(null);

  // 게시 상태
  const [isPublishing, setIsPublishing] = useState(false);

  // 미리보기 모드
  const [previewMode, setPreviewMode] = useState(false);

  // 패널 이미지 URL 캐시
  const [panelImageUrls, setPanelImageUrls] = useState<Record<number, string>>({});

  // 에피소드 구독
  useEffect(() => {
    const unsubscribe = subscribeToEpisode(episodeId, (ep) => {
      setEpisode(ep);
      setLoading(false);

      if (ep?.finalPrompt?.panels) {
        // 캡션 초기화
        const captions: Record<number, string> = {};
        ep.finalPrompt.panels.forEach((panel) => {
          captions[panel.index] = panel.captionDraft;
        });
        setEditedCaptions(captions);
      }
    });

    return () => unsubscribe();
  }, [episodeId]);

  // 패널 이미지 URL 로드
  useEffect(() => {
    if (!episode?.panels) return;

    const loadUrls = async () => {
      const urls: Record<number, string> = {};
      for (const panel of episode.panels) {
        try {
          const url = await getPublicUrl(panel.imagePath);
          urls[panel.index] = url;
        } catch {
          // 이미지가 없거나 로드 실패
        }
      }
      setPanelImageUrls(urls);
    };

    loadUrls();
  }, [episode?.panels]);

  // 캡션 변경
  const handleCaptionChange = useCallback((index: number, value: string) => {
    setEditedCaptions((prev) => ({ ...prev, [index]: value }));
  }, []);

  // 캡션 저장
  const saveCaptions = useCallback(async () => {
    if (!episode) return;

    try {
      const captions = Object.entries(editedCaptions).map(([index, caption]) => ({
        index: Number(index),
        caption,
      }));
      await updateEpisodeCaptions(episodeId, captions);
      showToast('success', '캡션이 저장되었습니다.');
    } catch (error) {
      showToast('error', '캡션 저장에 실패했습니다.');
    }
  }, [episode, episodeId, editedCaptions, showToast]);

  // 이미지 생성
  const handleGenerateImages = useCallback(async (indices?: number[]) => {
    if (!episode?.finalPrompt) return;

    setIsGeneratingImages(true);
    const totalPanels = indices?.length || episode.finalPrompt.panels.length;
    setGenerationProgress({ total: totalPanels, completed: 0, failed: [] });

    try {
      // 먼저 캡션 저장
      await saveCaptions();

      showToast('info', '이미지 생성을 시작합니다...');

      const result = await generatePanelImages({
        episodeId,
        aspectRatio,
        indices,
      });

      if (result.success) {
        showToast('success', result.message);
        setGenerationProgress({
          total: totalPanels,
          completed: result.generated.length,
          failed: result.failed,
        });
      } else {
        showToast('error', result.message);
        setGenerationProgress({
          total: totalPanels,
          completed: result.generated.length,
          failed: result.failed,
        });
      }
    } catch (error) {
      console.error('[Edit] Generate images error:', error);
      showToast('error', '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingImages(false);
    }
  }, [episode, episodeId, aspectRatio, saveCaptions, showToast]);

  // 실패한 패널 재생성
  const retryFailedPanels = useCallback(() => {
    if (generationProgress?.failed.length) {
      handleGenerateImages(generationProgress.failed);
    }
  }, [generationProgress, handleGenerateImages]);

  // 게시
  const handlePublish = useCallback(async () => {
    if (!episode) return;

    // 모든 패널 이미지가 있는지 확인
    const expectedPanels = episode.finalPrompt?.panels.length || 0;
    if (episode.panels.length < expectedPanels) {
      showToast('error', '모든 패널 이미지를 먼저 생성해주세요.');
      return;
    }

    setIsPublishing(true);

    try {
      await saveCaptions();

      const result = await publishEpisode({ episodeId });
      if (result.success) {
        showToast('success', '에피소드가 게시되었습니다!');
        router.push(`/episode/${episodeId}`);
      } else {
        throw new Error(result.error || '게시에 실패했습니다.');
      }
    } catch (error) {
      console.error('[Edit] Publish error:', error);
      showToast('error', error instanceof Error ? error.message : '게시 중 오류가 발생했습니다.');
    } finally {
      setIsPublishing(false);
    }
  }, [episode, episodeId, saveCaptions, showToast, router]);

  // 로딩 상태
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  // 에피소드 없음
  if (!episode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">에피소드를 찾을 수 없습니다.</p>
        <Link href="/create" className="text-indigo-600 hover:underline">
          새로 만들기
        </Link>
      </div>
    );
  }

  // 권한 확인
  if (user?.uid !== episode.creatorUid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">이 에피소드를 편집할 권한이 없습니다.</p>
        <Link href="/gallery" className="text-indigo-600 hover:underline">
          갤러리로 이동
        </Link>
      </div>
    );
  }

  const panels = episode.finalPrompt?.panels || [];
  const hasAllImages = episode.panels.length >= panels.length && panels.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 툴바 */}
      <div className="bg-white border-b sticky top-[57px] z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {episode.title || '제목 없음'}
            </h1>
            <p className="text-sm text-gray-500">
              {panels.length}컷 · {episode.status === 'published' ? '게시됨' : '초안'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {previewMode ? '편집 모드' : '미리보기'}
            </button>
            {episode.status !== 'published' && (
              <button
                onClick={handlePublish}
                disabled={!hasAllImages || isPublishing}
                className={`px-4 py-2 rounded-lg font-medium ${
                  hasAllImages && !isPublishing
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isPublishing ? '게시 중...' : '게시하기'}
              </button>
            )}
          </div>
        </div>
      </div>

      {previewMode ? (
        /* 미리보기 모드 */
        <PreviewMode
          panels={panels}
          editedCaptions={editedCaptions}
          panelImageUrls={panelImageUrls}
          episode={episode}
        />
      ) : (
        /* 편집 모드 */
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 이미지 생성 컨트롤 */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">비율:</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  disabled={isGeneratingImages}
                >
                  <option value="4:5">4:5 (인스타그램)</option>
                  <option value="9:16">9:16 (스토리/릴스)</option>
                  <option value="1:1">1:1 (정사각형)</option>
                </select>
              </div>

              <button
                onClick={() => handleGenerateImages()}
                disabled={isGeneratingImages || panels.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  isGeneratingImages || panels.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isGeneratingImages ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>🎨 전체 이미지 생성</>
                )}
              </button>

              {generationProgress && generationProgress.failed.length > 0 && (
                <button
                  onClick={retryFailedPanels}
                  disabled={isGeneratingImages}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
                >
                  실패한 {generationProgress.failed.length}개 재시도
                </button>
              )}

              <button
                onClick={saveCaptions}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                💾 캡션 저장
              </button>
            </div>

            {/* 진행률 표시 */}
            {generationProgress && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>진행률</span>
                  <span>
                    {generationProgress.completed} / {generationProgress.total}
                    {generationProgress.failed.length > 0 && (
                      <span className="text-red-500 ml-2">
                        (실패: {generationProgress.failed.length}개)
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{
                      width: `${(generationProgress.completed / generationProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 패널 리스트 */}
          <div className="space-y-4">
            {panels.map((panel, idx) => (
              <PanelCard
                key={panel.index}
                panel={panel}
                panelNumber={idx + 1}
                imageUrl={panelImageUrls[panel.index]}
                hasImage={episode.panels.some((p) => p.index === panel.index)}
                caption={editedCaptions[panel.index] || panel.captionDraft}
                onCaptionChange={(value) => handleCaptionChange(panel.index, value)}
                onRegenerate={() => handleGenerateImages([panel.index])}
                isGenerating={isGeneratingImages}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* 패널 카드 컴포넌트 */
interface PanelCardProps {
  panel: PanelPrompt;
  panelNumber: number;
  imageUrl?: string;
  hasImage: boolean;
  caption: string;
  onCaptionChange: (value: string) => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}

function PanelCard({
  panel,
  panelNumber,
  imageUrl,
  hasImage,
  caption,
  onCaptionChange,
  onRegenerate,
  isGenerating,
}: PanelCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* 이미지 영역 */}
        <div className="w-full md:w-80 aspect-[4/5] bg-gray-100 flex-shrink-0 relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Panel ${panelNumber}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">🖼️</div>
                <p className="text-sm">이미지 미생성</p>
              </div>
            </div>
          )}
          {/* 패널 번호 뱃지 */}
          <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-lg text-sm font-medium">
            #{panelNumber}
          </div>
          {/* 재생성 버튼 */}
          {hasImage && (
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-700 px-3 py-1 rounded-lg text-sm shadow"
            >
              🔄 재생성
            </button>
          )}
        </div>

        {/* 정보 영역 */}
        <div className="flex-1 p-4">
          {/* 장면 설명 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">장면 설명</label>
            <p className="text-gray-700">{panel.scene}</p>
          </div>

          {/* 프롬프트 (접기) */}
          <details className="mb-4">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700">
              이미지 프롬프트 보기
            </summary>
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {panel.prompt}
            </p>
          </details>

          {/* 캡션 편집 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              캡션 (30자 이내)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              maxLength={30}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="캡션을 입력하세요..."
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {caption.length}/30
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 미리보기 모드 */
interface PreviewModeProps {
  panels: PanelPrompt[];
  editedCaptions: Record<number, string>;
  panelImageUrls: Record<number, string>;
  episode: Episode;
}

function PreviewMode({ panels, editedCaptions, panelImageUrls, episode }: PreviewModeProps) {
  return (
    <div className="max-w-md mx-auto py-8 px-4">
      {/* 제목 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{episode.title || '제목 없음'}</h2>
        {episode.finalPrompt?.summary && (
          <p className="text-gray-600 mt-2">{episode.finalPrompt.summary}</p>
        )}
      </div>

      {/* 패널들 */}
      <div className="space-y-4">
        {panels.map((panel) => {
          const imageUrl = panelImageUrls[panel.index];
          const caption = editedCaptions[panel.index] || panel.captionDraft;

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
                    이미지 미생성
                  </div>
                )}
              </div>
              {caption && (
                <div className="px-4 py-3 text-center">
                  <p className="text-gray-800">{caption}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
