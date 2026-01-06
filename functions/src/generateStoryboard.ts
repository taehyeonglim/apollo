import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createGeminiClient, geminiApiKey, storyboardSchema } from './utils/gemini';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { Character, Storyboard, Draft } from './utils/types';

const db = admin.firestore();

interface GenerateStoryboardRequest {
  diary: string;
  characterId: string;
  panelCount?: number;
}

/**
 * 일기 텍스트 → 스토리보드 JSON 생성
 * Gemini 텍스트 모델 사용
 */
export const generateStoryboard = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    memory: '512MiB',
    enforceAppCheck: false, // MVP에서는 비활성화, 프로덕션에서 true
  },
  async (request) => {
    const { diary, characterId, panelCount = 4 } = request.data as GenerateStoryboardRequest;

    // 입력 검증
    if (!diary || diary.trim().length === 0) {
      throw new HttpsError('invalid-argument', '일기 내용을 입력해주세요.');
    }

    if (diary.length > 5000) {
      throw new HttpsError('invalid-argument', '일기는 5000자 이내로 입력해주세요.');
    }

    if (!characterId) {
      throw new HttpsError('invalid-argument', '캐릭터를 선택해주세요.');
    }

    if (panelCount < 1 || panelCount > 8) {
      throw new HttpsError('invalid-argument', '패널 수는 1-8개 사이여야 합니다.');
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const { allowed } = await checkRateLimit(clientIP, 'generateStoryboard', 5, 60000);
    if (!allowed) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    // 캐릭터 정보 로드
    const characterDoc = await db.collection('characters').doc(characterId).get();
    if (!characterDoc.exists) {
      throw new HttpsError('not-found', '캐릭터를 찾을 수 없습니다.');
    }
    const character = { id: characterDoc.id, ...characterDoc.data() } as Character;

    // Gemini 클라이언트 생성
    const genai = createGeminiClient();

    // 캐릭터 시트를 프롬프트에 포함
    const characterPrompt = buildCharacterPrompt(character);

    // 스토리보드 생성 프롬프트
    const systemPrompt = `You are an expert webtoon/instagram toon storyboard creator.
Your task is to transform a diary entry into a ${panelCount}-panel comic storyboard.

IMPORTANT CHARACTER INFORMATION (MUST FOLLOW EXACTLY):
${characterPrompt}

RULES:
1. Create exactly ${panelCount} panels
2. Each panel must feature the character described above CONSISTENTLY
3. The imagePrompt MUST include the character's physical description in every panel
4. Keep captions short and punchy (Korean, under 30 characters)
5. Vary compositions: close-up, medium shot, wide shot
6. Add visual humor and exaggeration appropriate for instagram toons
7. The style should be consistent across all panels

OUTPUT FORMAT: Return a valid JSON object matching the schema.`;

    const userPrompt = `Transform this diary entry into a ${panelCount}-panel instagram toon:

"""
${diary}
"""

Create a storyboard that captures the essence and emotion of this diary entry in a cute, relatable webtoon style.`;

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: storyboardSchema,
          temperature: 0.8,
          topP: 0.95,
        },
      });

      const storyboard = JSON.parse(response.text || '{}') as Storyboard;

      // 스토리보드 검증
      if (!storyboard.panels || storyboard.panels.length === 0) {
        throw new Error('스토리보드 생성에 실패했습니다.');
      }

      // 드래프트 생성 (Firestore에 저장)
      const draftRef = db.collection('drafts').doc();
      const now = admin.firestore.Timestamp.now();

      const draft: Omit<Draft, 'id'> = {
        originalDiary: diary,
        storyboard,
        panels: [], // 이미지는 별도로 생성
        characterId,
        createdAt: now,
        updatedAt: now,
      };

      await draftRef.set(draft);

      return {
        success: true,
        draftId: draftRef.id,
        storyboard,
      };
    } catch (error) {
      console.error('Storyboard generation error:', error);
      throw new HttpsError('internal', '스토리보드 생성 중 오류가 발생했습니다.');
    }
  }
);

/**
 * 캐릭터 정보를 프롬프트용 텍스트로 변환
 */
function buildCharacterPrompt(character: Character): string {
  const { traits } = character;

  return `
CHARACTER NAME: ${character.name}

PHYSICAL APPEARANCE (MUST BE CONSISTENT IN EVERY IMAGE):
- Age: ${traits.age}
- Gender: ${traits.gender}
- Hair: ${traits.hairStyle}, ${traits.hairColor}
- Eyes: ${traits.eyeColor}
- Skin: ${traits.skinTone}
- Height: ${traits.height}
- Body Type: ${traits.bodyType}
- Default Clothing: ${traits.clothing}
- Accessories: ${traits.accessories.join(', ')}
- Distinctive Features: ${traits.distinctiveFeatures.join(', ')}

DETAILED DESCRIPTION:
${character.description}

ART STYLE: ${character.defaultStyle}
`;
}
