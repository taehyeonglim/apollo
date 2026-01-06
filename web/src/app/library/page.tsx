'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RequireAuth, useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { uploadLibraryImage, getLibraryImageUrl } from '@/lib/storage';
import {
  addLibraryImage,
  subscribeToLibraryImages,
  updateLibraryImageName,
  removeLibraryImage,
} from '@/lib/firestore';
import type { LibraryImage } from '@/types';

export default function LibraryPage() {
  return (
    <RequireAuth>
      <LibraryContent />
    </RequireAuth>
  );
}

function LibraryContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [images, setImages] = useState<LibraryImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 라이브러리 이미지 구독
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToLibraryImages(user.uid, (libraryImages) => {
      setImages(libraryImages);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 이미지 URL 로드
  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const img of images) {
        if (!imageUrls[img.id]) {
          try {
            urls[img.id] = await getLibraryImageUrl(img.storagePath);
          } catch (error) {
            console.error('Failed to load image URL:', error);
          }
        }
      }
      if (Object.keys(urls).length > 0) {
        setImageUrls((prev) => ({ ...prev, ...urls }));
      }
    };
    loadUrls();
  }, [images, imageUrls]);

  // 이미지 업로드
  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0 || !user) return;

      setIsUploading(true);

      try {
        for (const file of files) {
          // Storage에 업로드
          const storagePath = await uploadLibraryImage(user.uid, file);

          // Firestore에 메타데이터 저장
          const name = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거
          await addLibraryImage(user.uid, storagePath, name);
        }

        showToast('success', `${files.length}개 이미지가 업로드되었습니다.`);
      } catch (error) {
        console.error('Upload error:', error);
        showToast('error', '이미지 업로드에 실패했습니다.');
      } finally {
        setIsUploading(false);
        // input 초기화
        e.target.value = '';
      }
    },
    [user, showToast]
  );

  // 이름 수정 시작
  const startEditing = (image: LibraryImage) => {
    setEditingId(image.id);
    setEditingName(image.name);
  };

  // 이름 수정 저장
  const saveEditing = async () => {
    if (!user || !editingId || !editingName.trim()) return;

    try {
      await updateLibraryImageName(user.uid, editingId, editingName.trim());
      showToast('success', '이름이 변경되었습니다.');
    } catch (error) {
      console.error('Update error:', error);
      showToast('error', '이름 변경에 실패했습니다.');
    } finally {
      setEditingId(null);
      setEditingName('');
    }
  };

  // 이미지 삭제
  const handleDelete = async (image: LibraryImage) => {
    if (!user) return;
    if (!confirm(`"${image.name}" 이미지를 삭제하시겠습니까?`)) return;

    try {
      await removeLibraryImage(user.uid, image.id, image.storagePath);
      showToast('success', '이미지가 삭제되었습니다.');
    } catch (error) {
      console.error('Delete error:', error);
      showToast('error', '이미지 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">레퍼런스 라이브러리</h1>
                <p className="text-indigo-200 mt-2">
                  캐릭터 레퍼런스 이미지를 미리 업로드하고 관리하세요
                </p>
              </div>
              <button
                onClick={() => router.push('/create')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                새 인스타툰 만들기
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* 업로드 영역 */}
            <div className="mb-8">
              <label
                className={`
                  flex flex-col items-center justify-center w-full h-32
                  border-2 border-dashed rounded-xl cursor-pointer
                  transition-all
                  ${
                    isUploading
                      ? 'border-gray-300 bg-gray-50'
                      : 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'
                  }
                `}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="flex items-center gap-3 text-gray-500">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    업로드 중...
                  </div>
                ) : (
                  <>
                    <span className="text-4xl mb-2">📁</span>
                    <span className="text-gray-600 font-medium">
                      이미지를 드래그하거나 클릭하여 업로드
                    </span>
                    <span className="text-sm text-gray-400 mt-1">
                      PNG, JPG, WEBP (최대 5MB)
                    </span>
                  </>
                )}
              </label>
            </div>

            {/* 이미지 그리드 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <span className="text-5xl block mb-4">🖼️</span>
                <p>아직 업로드한 이미지가 없습니다.</p>
                <p className="text-sm mt-1">위 영역을 클릭하여 이미지를 업로드하세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative bg-gray-100 rounded-xl overflow-hidden aspect-square"
                  >
                    {/* 이미지 */}
                    {imageUrls[image.id] ? (
                      <Image
                        src={imageUrls[image.id]}
                        alt={image.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {/* 오버레이 */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      {/* 이름 수정 */}
                      {editingId === image.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm rounded bg-white text-gray-900"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            onClick={saveEditing}
                            className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div
                          className="text-white text-sm font-medium truncate cursor-pointer hover:underline"
                          onClick={() => startEditing(image)}
                          title="클릭하여 이름 수정"
                        >
                          {image.name}
                        </div>
                      )}

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDelete(image)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 사용 안내 */}
            <div className="mt-8 p-4 bg-indigo-50 rounded-xl">
              <h3 className="font-semibold text-indigo-900 mb-2">💡 사용 방법</h3>
              <ul className="text-sm text-indigo-700 space-y-1">
                <li>• 여기에 업로드한 이미지는 인스타툰 생성 시 레퍼런스로 선택할 수 있습니다.</li>
                <li>• 캐릭터 이미지를 미리 업로드해두면 매번 다시 업로드할 필요가 없습니다.</li>
                <li>• 이미지 이름을 클릭하면 이름을 수정할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
