import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import {
  createGeminiClient,
  geminiApiKey,
  finalPromptSchema,
  hashText,
  summarizeForLog,
} from './utils/gemini';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { FinalPrompt, GlobalStyle, PanelPrompt } from './utils/types';

const db = admin.firestore();

// ==========================================
// Zod 입력 검증 스키마
// ==========================================

const GenerateStoryboardInputSchema = z.object({
  episodeId: z.string().min(1, 'episodeId는 필수입니다'),
  diaryText: z
    .string()
    .min(10, '일기는 최소 10자 이상이어야 합니다')
    .max(5000, '일기는 5000자 이내로 입력해주세요'),
  panelCount: z
    .number()
    .int()
    .min(2, '패널 수는 최소 2개입니다')
    .max(10, '패널 수는 최대 10개입니다')
    .default(4),
  characterSheetText: z
    .string()
    .min(50, '캐릭터 시트는 최소 50자 이상이어야 합니다')
    .max(3000, '캐릭터 시트는 3000자 이내로 입력해주세요'),
  refImagePaths: z.array(z.string()).max(5, '레퍼런스 이미지는 최대 5개').optional(),
});

// Type inferred from schema (used for documentation)

// ==========================================
// Gemini 응답 검증 스키마
// ==========================================

const GeminiResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  global: z.object({
    artStyle: z.string(),
    colorPalette: z.string(),
    cameraRules: z.string(),
    typographyRules: z.string(),
    negatives: z.string(),
  }),
  panels: z.array(
    z.object({
      index: z.number(),
      scene: z.string(),
      prompt: z.string(),
      captionDraft: z.string(),
    })
  ),
});

// ==========================================
// 캐릭터 고정 시스템 프롬프트
// ==========================================

function buildSystemPrompt(characterSheetText: string, panelCount: number): string {
  return `You are an expert Instagram webtoon (인스타툰) storyboard creator.
Your task is to transform a Korean diary entry into a ${panelCount}-panel comic storyboard.

═══════════════════════════════════════════════════════════════
🎭 CRITICAL: CHARACTER CONSISTENCY RULES (MUST FOLLOW STRICTLY)
═══════════════════════════════════════════════════════════════

The following character description MUST be maintained IDENTICALLY across ALL panels:

"""
${characterSheetText}
"""

CHARACTER CONSISTENCY REQUIREMENTS:
1. EVERY panel's "prompt" field MUST include a condensed version of the character's physical appearance
2. Hair style, hair color, eye color, skin tone, clothing must be IDENTICAL in every panel
3. Accessories and distinctive features must appear consistently
4. The character's proportions and art style must remain constant
5. Include character description at the START of each panel prompt (before the scene description)

Example of required character description in each prompt:
"A young woman with shoulder-length dark brown wavy hair, big round dark brown eyes, fair skin with warm undertone, wearing a cozy cream hoodie, [then describe the scene...]"

═══════════════════════════════════════════════════════════════
📋 OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

1. Create EXACTLY ${panelCount} panels (index 0 to ${panelCount - 1})
2. title: 한국어, 15자 이내, 캐치하고 재미있게
3. summary: 한국어, 1-2문장으로 스토리 요약
4. global.artStyle: 영문, 상세한 그림체 설명
5. global.colorPalette: 영문, 색상 팔레트
6. global.cameraRules: 영문, 구도 변화 규칙 (close-up, medium, wide shot 혼합)
7. global.typographyRules: 한국어, 캡션 스타일 가이드
8. global.negatives: 영문, 피해야 할 요소들
9. panels[].scene: 한국어, 장면 설명
10. panels[].prompt: 영문, 이미지 생성 프롬프트 (캐릭터 묘사 필수 포함!)
11. panels[].captionDraft: 한국어, 30자 이내 캡션

═══════════════════════════════════════════════════════════════
🎨 STYLE GUIDELINES
═══════════════════════════════════════════════════════════════

- 귀엽고 공감가는 일상툰 스타일
- 감정 표현은 과장되고 풍부하게
- 상황의 유머와 감성을 잘 살려서
- 구도는 다양하게 (클로즈업, 미디엄샷, 와이드샷 혼합)
- 캡션은 짧고 임팩트 있게

Return a valid JSON object matching the specified schema.`;
}

// ==========================================
// Cloud Function: generateStoryboard
// ==========================================

export const generateStoryboard = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    memory: '512MiB',
    enforceAppCheck: false, // 프로덕션에서 true로 변경
  },
  async (request) => {
    // ----------------------------------------
    // 1. 입력 검증 (Zod)
    // ----------------------------------------
    const parseResult = GenerateStoryboardInputSchema.safeParse(request.data);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(', ');
      throw new HttpsError('invalid-argument', `입력 검증 실패: ${errors}`);
    }

    const {
      episodeId,
      diaryText,
      panelCount,
      characterSheetText,
      refImagePaths,
    } = parseResult.data;

    // ----------------------------------------
    // 2. 로깅 (민감 정보 제외)
    // ----------------------------------------
    const diaryHash = await hashText(diaryText);
    const charSheetHash = await hashText(characterSheetText);

    console.log('[generateStoryboard] Request received:', {
      episodeId,
      panelCount,
      diaryTextHash: diaryHash,
      diaryTextPreview: summarizeForLog(diaryText, 30),
      characterSheetHash: charSheetHash,
      refImageCount: refImagePaths?.length || 0,
    });

    // ----------------------------------------
    // 3. Rate Limiting
    // ----------------------------------------
    const clientIP = getClientIP(request);
    const { allowed, remaining } = await checkRateLimit(
      clientIP,
      'generateStoryboard',
      5,
      60000
    );
    if (!allowed) {
      console.warn('[generateStoryboard] Rate limit exceeded:', { clientIP: await hashText(clientIP) });
      throw new HttpsError(
        'resource-exhausted',
        '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
      );
    }

    // ----------------------------------------
    // 4. Episode 존재 확인 (idempotent를 위해)
    // ----------------------------------------
    const episodeRef = db.collection('episodes').doc(episodeId);
    const episodeDoc = await episodeRef.get();

    // Episode가 없으면 생성 (또는 이미 있으면 덮어쓰기)
    if (!episodeDoc.exists) {
      // 새 episode 생성
      const now = admin.firestore.Timestamp.now();
      await episodeRef.set({
        status: 'draft',
        title: '',
        diaryText,
        panelCount,
        panels: [],
        createdAt: now,
        updatedAt: now,
        creatorUid: request.auth?.uid || 'anonymous',
      });
      console.log('[generateStoryboard] Created new episode:', { episodeId });
    }

    // ----------------------------------------
    // 5. Gemini API 호출
    // ----------------------------------------
    const genai = createGeminiClient();
    const systemPrompt = buildSystemPrompt(characterSheetText, panelCount);

    const userPrompt = `다음 일기를 ${panelCount}컷 인스타툰 스토리보드로 변환해주세요:

"""
${diaryText}
"""

위 일기의 감정과 상황을 귀엽고 공감가는 만화로 표현해주세요.
각 패널의 prompt에는 반드시 캐릭터 외형 묘사를 포함해야 합니다!`;

    try {
      console.log('[generateStoryboard] Calling Gemini API...');

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: finalPromptSchema,
          temperature: 0.8,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Gemini API returned empty response');
      }

      console.log('[generateStoryboard] Gemini response received, parsing...');

      // ----------------------------------------
      // 6. 응답 파싱 및 검증
      // ----------------------------------------
      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[generateStoryboard] JSON parse error:', parseError);
        throw new Error('Gemini 응답을 파싱할 수 없습니다.');
      }

      const validationResult = GeminiResponseSchema.safeParse(parsedResponse);
      if (!validationResult.success) {
        console.error('[generateStoryboard] Response validation failed:', validationResult.error);
        throw new Error('Gemini 응답 형식이 올바르지 않습니다.');
      }

      const geminiResult = validationResult.data;

      // 패널 수 검증
      if (geminiResult.panels.length !== panelCount) {
        console.warn('[generateStoryboard] Panel count mismatch:', {
          expected: panelCount,
          received: geminiResult.panels.length,
        });
        // 자동 조정하지 않고 경고만 로그
      }

      // ----------------------------------------
      // 7. FinalPrompt 구성 및 Firestore 저장
      // ----------------------------------------
      const now = admin.firestore.Timestamp.now();

      const finalPrompt: FinalPrompt = {
        title: geminiResult.title,
        summary: geminiResult.summary,
        global: geminiResult.global as GlobalStyle,
        panels: geminiResult.panels as PanelPrompt[],
        characterSheetDigest: charSheetHash,
        generatedAt: now,
      };

      // Firestore에 최종 프롬프트만 저장 (중간 산출물 없음)
      await episodeRef.update({
        title: finalPrompt.title,
        finalPrompt,
        panelCount: geminiResult.panels.length,
        updatedAt: now,
      });

      console.log('[generateStoryboard] Saved finalPrompt to Firestore:', {
        episodeId,
        title: finalPrompt.title,
        panelCount: finalPrompt.panels.length,
      });

      // ----------------------------------------
      // 8. 응답 반환
      // ----------------------------------------
      return {
        success: true,
        episodeId,
        finalPrompt: {
          title: finalPrompt.title,
          summary: finalPrompt.summary,
          global: finalPrompt.global,
          panels: finalPrompt.panels,
        },
        remaining, // 남은 요청 횟수
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[generateStoryboard] Error:', {
        episodeId,
        error: errorMessage,
      });

      throw new HttpsError('internal', `스토리보드 생성 중 오류가 발생했습니다: ${errorMessage}`);
    }
  }
);
