'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateStoryboard } from '@/lib/api';

// MVP에서는 기본 캐릭터 ID 사용
const DEFAULT_CHARACTER_ID = 'default';

export default function HomePage() {
  const router = useRouter();
  const [diary, setDiary] = useState('');
  const [panelCount, setPanelCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!diary.trim()) {
      setError('일기 내용을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateStoryboard({
        diary: diary.trim(),
        characterId: DEFAULT_CHARACTER_ID,
        panelCount,
      });

      if (result.success && result.draftId) {
        // 에디터 페이지로 이동
        router.push(`/editor/${result.draftId}`);
      } else {
        setError(result.error || '스토리보드 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* 히어로 섹션 */}
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold text-indigo-900 mb-4">
          일기를 인스타툰으로
        </h1>
        <p className="text-lg text-indigo-700">
          오늘 하루를 적어보세요. AI가 귀여운 만화로 바꿔드릴게요.
        </p>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 일기 입력 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
          <label
            htmlFor="diary"
            className="block text-lg font-semibold text-indigo-900 mb-3"
          >
            오늘의 일기
          </label>
          <textarea
            id="diary"
            value={diary}
            onChange={(e) => setDiary(e.target.value)}
            placeholder="오늘 있었던 일을 자유롭게 적어보세요...&#10;&#10;예: 오늘 카페에서 공부하다가 깜빡 졸았는데, 일어나니까 옆자리 사람이 내 커피를 마시고 있었다. 서로 눈이 마주치고 어색하게 웃었다..."
            className="w-full h-48 p-4 border border-indigo-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            maxLength={5000}
            disabled={isLoading}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-500">
              {diary.length} / 5000자
            </span>
          </div>
        </div>

        {/* 옵션 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
          <label className="block text-lg font-semibold text-indigo-900 mb-3">
            패널 수
          </label>
          <div className="flex gap-3">
            {[2, 4, 6, 8].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPanelCount(num)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  panelCount === num
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
                disabled={isLoading}
              >
                {num}컷
              </button>
            ))}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 animate-fade-in">
            {error}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isLoading || !diary.trim()}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
            isLoading || !diary.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-pink-500 text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <span className="spinner !w-5 !h-5 !border-2"></span>
              스토리보드 생성 중...
            </span>
          ) : (
            '인스타툰 만들기 ✨'
          )}
        </button>
      </form>

      {/* 안내 */}
      <div className="mt-12 text-center text-gray-600 text-sm">
        <p>
          생성된 인스타툰은 에디터에서 수정 후 갤러리에 게시할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
