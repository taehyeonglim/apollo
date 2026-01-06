import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <div className="text-6xl md:text-8xl mb-6 animate-bounce-slow">🌙</div>
          <h1 className="text-4xl md:text-6xl font-bold text-indigo-900 mb-4">
            일기를 인스타툰으로
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            오늘 하루를 적어보세요. AI가 당신의 일상을 귀여운 만화로 바꿔드릴게요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              ✨ 시작하기
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold text-lg border-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
            >
              🎨 갤러리 둘러보기
            </Link>
          </div>
        </div>

        {/* 기능 카드 */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <FeatureCard
            emoji="📝"
            title="일기 작성"
            description="오늘 있었던 일, 감정, 생각을 자유롭게 작성해주세요."
          />
          <FeatureCard
            emoji="🤖"
            title="AI 스토리보드"
            description="Gemini AI가 일기를 분석하고 인스타툰 스토리보드를 생성합니다."
          />
          <FeatureCard
            emoji="🎨"
            title="이미지 생성"
            description="캐릭터 일관성을 유지하며 패널별 이미지를 자동 생성합니다."
          />
        </div>

        {/* 플로우 설명 */}
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-center text-indigo-900 mb-8">
            어떻게 사용하나요?
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <StepCard step={1} title="일기 작성" description="오늘의 이야기를 적어요" />
            <StepCard step={2} title="캐릭터 설정" description="나만의 캐릭터를 설명해요" />
            <StepCard step={3} title="이미지 생성" description="AI가 만화를 그려요" />
            <StepCard step={4} title="공유하기" description="갤러리에 게시해요" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="text-4xl mb-4">{emoji}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-xl font-bold text-indigo-600">{step}</span>
      </div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
