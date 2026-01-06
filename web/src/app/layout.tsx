import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'A.P.O.L.L.O. - AI 인스타툰 생성기',
  description: '일기를 인스타툰으로 변환하세요. AI가 당신의 일상을 귀여운 만화로 만들어드립니다.',
  keywords: ['인스타툰', 'AI', '일기', '만화', '웹툰', 'Gemini'],
  authors: [{ name: 'A.P.O.L.L.O. Team' }],
  openGraph: {
    title: 'A.P.O.L.L.O. - AI 인스타툰 생성기',
    description: '일기를 인스타툰으로 변환하세요',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <div className="min-h-screen flex flex-col">
          {/* 헤더 */}
          <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <span className="text-2xl">🌙</span>
                <span className="font-bold text-xl text-indigo-900">A.P.O.L.L.O.</span>
              </a>
              <nav className="flex items-center gap-4">
                <a
                  href="/gallery"
                  className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  갤러리
                </a>
              </nav>
            </div>
          </header>

          {/* 메인 콘텐츠 */}
          <main className="flex-1">
            {children}
          </main>

          {/* 푸터 */}
          <footer className="bg-indigo-950 text-white py-6">
            <div className="max-w-6xl mx-auto px-4 text-center">
              <p className="text-indigo-300 text-sm">
                A.P.O.L.L.O. - AI-Prompt-Orchestrated Life Log Overlays
              </p>
              <p className="text-indigo-400 text-xs mt-2">
                Powered by Gemini AI
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
