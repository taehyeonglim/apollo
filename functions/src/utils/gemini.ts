import { GoogleGenAI, Type } from '@google/genai';
import { defineSecret } from 'firebase-functions/params';

// Secret Manager에서 API 키 로드
export const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Gemini 클라이언트 생성 (런타임에 호출)
export function createGeminiClient(): GoogleGenAI {
  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }
  return new GoogleGenAI({ apiKey });
}

// 스토리보드 생성용 스키마
export const storyboardSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: '인스타툰 제목 (짧고 캐치한)',
    },
    summary: {
      type: Type.STRING,
      description: '전체 스토리 요약 (1-2문장)',
    },
    panels: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order: {
            type: Type.NUMBER,
            description: '패널 순서 (0부터 시작)',
          },
          scene: {
            type: Type.STRING,
            description: '장면 설명',
          },
          caption: {
            type: Type.STRING,
            description: '패널에 표시될 캡션/대사',
          },
          imagePrompt: {
            type: Type.STRING,
            description: '이미지 생성을 위한 상세 프롬프트 (영문)',
          },
          emotion: {
            type: Type.STRING,
            description: '캐릭터의 감정 상태',
          },
          composition: {
            type: Type.STRING,
            description: '구도 설명 (close-up, wide shot 등)',
          },
        },
        required: ['order', 'scene', 'caption', 'imagePrompt', 'emotion', 'composition'],
      },
    },
    style: {
      type: Type.OBJECT,
      properties: {
        artStyle: {
          type: Type.STRING,
          description: '그림체 (예: cute cartoon, webtoon style)',
        },
        colorPalette: {
          type: Type.STRING,
          description: '색상 팔레트 설명',
        },
        mood: {
          type: Type.STRING,
          description: '전체적인 분위기',
        },
      },
      required: ['artStyle', 'colorPalette', 'mood'],
    },
  },
  required: ['title', 'summary', 'panels', 'style'],
};

// 욕설/스팸 필터용 금지어 목록
export const BANNED_WORDS = [
  '시발', '씨발', '병신', '지랄', '개새끼', '좆', '닥쳐',
  'fuck', 'shit', 'bitch', 'asshole', 'dick',
  // 스팸 키워드
  '광고', '홍보', 'http://', 'https://', 'www.',
];

export function containsBannedWords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BANNED_WORDS.some((word) => lowerText.includes(word.toLowerCase()));
}
