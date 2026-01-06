'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RequireAuth, useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { generateStoryboard } from '@/lib/api';
import { uploadReferenceImages, getLibraryImageUrl } from '@/lib/storage';
import { getLibraryImages } from '@/lib/firestore';
import type { LibraryImage } from '@/types';

// Episode ID 생성 (nanoid 스타일)
function generateEpisodeId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function CreatePage() {
  return (
    <RequireAuth>
      <CreateContent />
    </RequireAuth>
  );
}

function CreateContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // 폼 상태
  const [diaryText, setDiaryText] = useState('');
  const [panelCount, setPanelCount] = useState(4);
  const [characterSheetText, setCharacterSheetText] = useState('');
  const [refImages, setRefImages] = useState<File[]>([]);
  const [refImagePreviews, setRefImagePreviews] = useState<string[]>([]);

  // 라이브러리 상태
  const [refSource, setRefSource] = useState<'upload' | 'library'>('upload');
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [libraryImageUrls, setLibraryImageUrls] = useState<Record<string, string>>({});
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // 로딩 상태
  const [isGenerating, setIsGenerating] = useState(false);

  // 라이브러리 이미지 로드
  useEffect(() => {
    if (refSource === 'library' && user && libraryImages.length === 0) {
      setIsLoadingLibrary(true);
      getLibraryImages(user.uid)
        .then(setLibraryImages)
        .catch(console.error)
        .finally(() => setIsLoadingLibrary(false));
    }
  }, [refSource, user, libraryImages.length]);

  // 라이브러리 이미지 URL 로드
  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const img of libraryImages) {
        if (!libraryImageUrls[img.id]) {
          try {
            urls[img.id] = await getLibraryImageUrl(img.storagePath);
          } catch (error) {
            console.error('Failed to load image URL:', error);
          }
        }
      }
      if (Object.keys(urls).length > 0) {
        setLibraryImageUrls((prev) => ({ ...prev, ...urls }));
      }
    };
    if (libraryImages.length > 0) {
      loadUrls();
    }
  }, [libraryImages, libraryImageUrls]);

  // 라이브러리 이미지 선택 토글
  const toggleLibraryImage = (imageId: string) => {
    setSelectedLibraryIds((prev) => {
      if (prev.includes(imageId)) {
        return prev.filter((id) => id !== imageId);
      }
      if (prev.length >= 5) {
        showToast('warning', '최대 5개까지 선택할 수 있습니다.');
        return prev;
      }
      return [...prev, imageId];
    });
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 5개 제한
    const newFiles = [...refImages, ...files].slice(0, 5);
    setRefImages(newFiles);

    // 미리보기 생성
    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setRefImagePreviews(previews);
  }, [refImages]);

  // 이미지 제거
  const removeImage = useCallback((index: number) => {
    setRefImages((prev) => prev.filter((_, i) => i !== index));
    setRefImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // 스토리보드 생성
  const handleGenerate = async () => {
    if (!user) {
      showToast('error', '로그인이 필요합니다.');
      return;
    }

    if (diaryText.length < 10) {
      showToast('error', '일기는 최소 10자 이상 작성해주세요.');
      return;
    }

    if (characterSheetText.length < 50) {
      showToast('error', '캐릭터 설명은 최소 50자 이상 작성해주세요.');
      return;
    }

    setIsGenerating(true);

    try {
      const episodeId = generateEpisodeId();
      let refImagePaths: string[] = [];

      // 1. 레퍼런스 이미지 처리
      if (refSource === 'upload' && refImages.length > 0) {
        // 새로 업로드하는 경우
        showToast('info', '레퍼런스 이미지 업로드 중...');
        refImagePaths = await uploadReferenceImages(user.uid, episodeId, refImages);
      } else if (refSource === 'library' && selectedLibraryIds.length > 0) {
        // 라이브러리에서 선택한 경우 - Storage 경로 직접 사용
        refImagePaths = selectedLibraryIds
          .map((id) => libraryImages.find((img) => img.id === id)?.storagePath)
          .filter((path): path is string => !!path);
      }

      // 2. 스토리보드 생성
      showToast('info', '스토리보드 생성 중...');
      const result = await generateStoryboard({
        episodeId,
        diaryText,
        panelCount,
        characterSheetText,
        refImagePaths,
      });

      if (result.success) {
        showToast('success', '스토리보드가 생성되었습니다!');
        router.push(`/edit/${episodeId}`);
      } else {
        throw new Error(result.error || '스토리보드 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('[Create] Error:', error);
      showToast('error', error instanceof Error ? error.message : '오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
            <h1 className="text-2xl font-bold">새 인스타툰 만들기</h1>
            <p className="text-indigo-200 mt-2">
              일기를 작성하면 AI가 귀여운 인스타툰으로 변환해드려요
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* 1. 일기 입력 */}
            <section>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                📝 일기 작성
              </label>
              <p className="text-sm text-gray-500 mb-3">
                오늘 있었던 일, 감정, 생각을 자유롭게 작성해주세요 (10~5000자)
              </p>
              <textarea
                value={diaryText}
                onChange={(e) => setDiaryText(e.target.value)}
                placeholder="오늘 카페에서 아이스 아메리카노를 마셨는데, 갑자기 비가 와서 우산 없이 뛰어갔다. 다행히 비를 많이 맞지 않았지만 신발이 젖어서 기분이 좀 그랬다..."
                className="w-full h-48 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isGenerating}
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                {diaryText.length} / 5000자
              </div>
            </section>

            {/* 2. 패널 수 선택 */}
            <section>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                🎨 패널 수
              </label>
              <p className="text-sm text-gray-500 mb-3">
                인스타툰의 패널(컷) 수를 선택해주세요
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={panelCount}
                  onChange={(e) => setPanelCount(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  disabled={isGenerating}
                />
                <div className="w-16 text-center">
                  <span className="text-2xl font-bold text-indigo-600">{panelCount}</span>
                  <span className="text-sm text-gray-500">컷</span>
                </div>
              </div>
            </section>

            {/* 3. 캐릭터 레퍼런스 이미지 */}
            <section>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                👤 캐릭터 레퍼런스 이미지 (선택)
              </label>
              <p className="text-sm text-gray-500 mb-3">
                캐릭터 스타일 참고용 이미지를 선택해주세요 (최대 5장)
              </p>

              {/* 탭 선택 */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setRefSource('upload')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    refSource === 'upload'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  disabled={isGenerating}
                >
                  새로 업로드
                </button>
                <button
                  type="button"
                  onClick={() => setRefSource('library')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    refSource === 'library'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  disabled={isGenerating}
                >
                  라이브러리에서 선택
                </button>
              </div>

              {/* 새로 업로드 */}
              {refSource === 'upload' && (
                <div className="flex flex-wrap gap-3">
                  {refImagePreviews.map((preview, index) => (
                    <div
                      key={index}
                      className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100"
                    >
                      <img
                        src={preview}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                        disabled={isGenerating}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {refImages.length < 5 && (
                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isGenerating}
                      />
                      <span className="text-3xl text-gray-400">+</span>
                    </label>
                  )}
                </div>
              )}

              {/* 라이브러리에서 선택 */}
              {refSource === 'library' && (
                <div>
                  {isLoadingLibrary ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : libraryImages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>라이브러리에 이미지가 없습니다.</p>
                      <button
                        type="button"
                        onClick={() => router.push('/library')}
                        className="mt-2 text-indigo-600 hover:underline"
                      >
                        라이브러리로 이동하여 이미지 업로드하기
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-3">
                        {libraryImages.map((image) => (
                          <button
                            key={image.id}
                            type="button"
                            onClick={() => toggleLibraryImage(image.id)}
                            className={`relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 transition-all ${
                              selectedLibraryIds.includes(image.id)
                                ? 'ring-3 ring-indigo-500 ring-offset-2'
                                : 'hover:ring-2 hover:ring-gray-300'
                            }`}
                            disabled={isGenerating}
                          >
                            {libraryImageUrls[image.id] ? (
                              <Image
                                src={libraryImageUrls[image.id]}
                                alt={image.name}
                                fill
                                className="object-cover"
                                sizes="96px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {selectedLibraryIds.includes(image.id) && (
                              <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                                <span className="text-white text-2xl">✓</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        {selectedLibraryIds.length}개 선택됨
                        {selectedLibraryIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedLibraryIds([])}
                            className="ml-2 text-red-500 hover:underline"
                          >
                            선택 해제
                          </button>
                        )}
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* 4. 캐릭터 설명 */}
            <section>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                ✍️ 캐릭터 설명
              </label>
              <p className="text-sm text-gray-500 mb-3">
                캐릭터의 외형을 상세하게 설명해주세요. 모든 패널에서 동일한 캐릭터가 등장합니다 (50~3000자)
              </p>
              <textarea
                value={characterSheetText}
                onChange={(e) => setCharacterSheetText(e.target.value)}
                placeholder={`20대 중반 여성, 어깨 길이의 갈색 웨이브 머리, 큰 갈색 눈, 밝은 피부
평소 캐주얼한 옷차림을 좋아하며, 오늘은 크림색 후드티와 청바지를 입고 있음
귀엽고 동글동글한 얼굴형, 표정이 풍부하고 감정 표현이 큼
작은 은색 귀걸이를 하고 있고, 항상 스마트폰을 들고 다님`}
                className="w-full h-36 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isGenerating}
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                {characterSheetText.length} / 3000자
              </div>
            </section>

            {/* 생성 버튼 */}
            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || diaryText.length < 10 || characterSheetText.length < 50}
                className={`
                  w-full py-4 rounded-xl text-white font-semibold text-lg
                  transition-all flex items-center justify-center gap-3
                  ${
                    isGenerating || diaryText.length < 10 || characterSheetText.length < 50
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                  }
                `}
              >
                {isGenerating ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    스토리보드 생성 중...
                  </>
                ) : (
                  <>
                    ✨ 스토리보드 생성하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
