import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';

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
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
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
        </Providers>
      </body>
    </html>
  );
}
