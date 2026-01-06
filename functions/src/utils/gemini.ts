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

// ==========================================
// Structured Output용 JSON Schema
// ==========================================

/**
 * FinalPrompt 생성을 위한 Gemini JSON Schema
 * global + panels 구조
 */
export const finalPromptSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: '인스타툰 제목 (짧고 캐치하게, 한국어, 15자 이내)',
    },
    summary: {
      type: Type.STRING,
      description: '전체 스토리 요약 (한국어, 1-2문장)',
    },
    global: {
      type: Type.OBJECT,
      description: '전역 스타일 설정 (모든 패널에 공통 적용)',
      properties: {
        artStyle: {
          type: Type.STRING,
          description: '그림체 설명 (영문, 예: cute chibi webtoon style, soft shading, expressive eyes)',
        },
        colorPalette: {
          type: Type.STRING,
          description: '색상 팔레트 (영문, 예: warm pastel colors with pink and orange accents)',
        },
        cameraRules: {
          type: Type.STRING,
          description: '카메라/구도 규칙 (영문, 예: vary between close-up, medium, and wide shots)',
        },
        typographyRules: {
          type: Type.STRING,
          description: '캡션 스타일 규칙 (한국어, 예: 간결하고 위트있게, 이모지 1개 허용)',
        },
        negatives: {
          type: Type.STRING,
          description: '피해야 할 요소 (영문, 예: realistic style, dark colors, complex backgrounds)',
        },
      },
      required: ['artStyle', 'colorPalette', 'cameraRules', 'typographyRules', 'negatives'],
    },
    panels: {
      type: Type.ARRAY,
      description: '패널별 프롬프트 배열',
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.NUMBER,
            description: '패널 순서 (0부터 시작)',
          },
          scene: {
            type: Type.STRING,
            description: '장면 설명 (한국어, 어떤 상황인지)',
          },
          prompt: {
            type: Type.STRING,
            description: '이미지 생성 프롬프트 (영문). 반드시 캐릭터 외형 묘사를 포함해야 함.',
          },
          captionDraft: {
            type: Type.STRING,
            description: '캡션 초안 (한국어, 30자 이내, 대사 또는 나레이션)',
          },
        },
        required: ['index', 'scene', 'prompt', 'captionDraft'],
      },
    },
  },
  required: ['title', 'summary', 'global', 'panels'],
};

// ==========================================
// 욕설/스팸 필터
// ==========================================

export const BANNED_WORDS = [
  '시발', '씨발', '병신', '지랄', '개새끼', '좆', '닥쳐',
  'fuck', 'shit', 'bitch', 'asshole', 'dick',
  '광고', '홍보', 'http://', 'https://', 'www.',
];

export function containsBannedWords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BANNED_WORDS.some((word) => lowerText.includes(word.toLowerCase()));
}

// ==========================================
// 유틸리티
// ==========================================

/**
 * 문자열의 SHA-256 해시 생성 (처음 16자)
 */
export async function hashText(text: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * 텍스트 요약 (로그용, 민감 정보 제거)
 */
export function summarizeForLog(text: string, maxLength: number = 50): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength) + '...';
}
