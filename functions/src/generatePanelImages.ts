import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { createGeminiClient, geminiApiKey, hashText } from './utils/gemini';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { Episode, Panel, GlobalStyle } from './utils/types';
import type { Part } from '@google/genai';

const db = admin.firestore();
const storage = admin.storage();

// ==========================================
// Zod 입력 검증 스키마
// ==========================================

const AspectRatioSchema = z.enum(['4:5', '9:16', '1:1']).default('4:5');

const GeneratePanelImagesInputSchema = z.object({
  episodeId: z.string().min(1, 'episodeId는 필수입니다'),
  aspectRatio: AspectRatioSchema,
  refImagePaths: z.array(z.string()).max(5, '레퍼런스 이미지는 최대 5개').optional(),
  indices: z.array(z.number().int().min(0)).optional(), // 특정 패널만 생성할 때
});

export type AspectRatio = z.infer<typeof AspectRatioSchema>;

// ==========================================
// 상수
// ==========================================

// 동시 생성 제한 (rate limit, timeout 고려)
const CONCURRENCY_LIMIT = 2;

// Aspect ratio to dimension mapping (gemini-2.5-flash-image 지원)
const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '4:5': { width: 896, height: 1120 },
  '9:16': { width: 768, height: 1344 },
  '1:1': { width: 1024, height: 1024 },
};

// ==========================================
// 유틸리티 함수
// ==========================================

/**
 * Storage에서 이미지를 읽어 base64로 변환
 */
async function loadImageFromStorage(path: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(path);

    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[loadImageFromStorage] File not found: ${path}`);
      return null;
    }

    const [buffer] = await file.download();
    const base64 = buffer.toString('base64');

    // MIME 타입 추론
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : 'image/png';

    return { base64, mimeType };
  } catch (error) {
    console.error(`[loadImageFromStorage] Error loading ${path}:`, error);
    return null;
  }
}

/**
 * 이미지 생성 프롬프트 구성
 */
function buildImagePrompt(
  panelPrompt: string,
  globalStyle: GlobalStyle,
  aspectRatio: AspectRatio
): string {
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  return `Generate a single panel image for an Instagram webtoon (인스타툰).

STYLE: ${globalStyle.artStyle}
COLOR PALETTE: ${globalStyle.colorPalette}
CAMERA GUIDANCE: ${globalStyle.cameraRules}

SCENE DESCRIPTION:
${panelPrompt}

REQUIREMENTS:
1. Clean, professional webtoon illustration style
2. No text, speech bubbles, or captions in the image
3. Aspect ratio: ${aspectRatio} (${dimensions.width}x${dimensions.height})
4. High quality, vibrant colors matching the palette
5. Expressive character emotions and poses
6. Simple, clean background that doesn't distract from the character
7. CRITICAL: The character must match the reference images provided exactly (same hair, eyes, face shape, clothing)

AVOID: ${globalStyle.negatives}, text, watermarks, signatures, blurry, low quality`;
}

/**
 * 단일 패널 이미지 생성
 */
async function generateSinglePanelImage(
  genai: ReturnType<typeof createGeminiClient>,
  panelIndex: number,
  panelPrompt: string,
  globalStyle: GlobalStyle,
  aspectRatio: AspectRatio,
  refImageParts: Part[]
): Promise<{ index: number; base64: string; mimeType: string } | { index: number; error: string }> {
  try {
    const textPrompt = buildImagePrompt(panelPrompt, globalStyle, aspectRatio);

    // 멀티모달 입력 구성: 레퍼런스 이미지 + 텍스트 프롬프트
    const contents: Part[] = [
      ...refImageParts,
      { text: textPrompt },
    ];

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: contents,
      config: {
        responseModalities: ['image', 'text'],
        temperature: 1.0,
      },
    });

    // 응답에서 이미지 추출
    let imageBase64: string | null = null;
    let imageMimeType = 'image/png';

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data || null;
          imageMimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }
    }

    if (!imageBase64) {
      return { index: panelIndex, error: '이미지 생성 실패: 응답에 이미지 없음' };
    }

    return { index: panelIndex, base64: imageBase64, mimeType: imageMimeType };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[generateSinglePanelImage] Panel ${panelIndex} error:`, errorMessage);
    return { index: panelIndex, error: errorMessage };
  }
}

/**
 * 동시성 제한 유틸리티 (p-limit 대체)
 */
async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array(Math.min(limit, tasks.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

// ==========================================
// Cloud Function: generatePanelImages
// ==========================================

export const generatePanelImages = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9분 (여러 패널 생성 고려)
    memory: '1GiB',
    enforceAppCheck: true,
  },
  async (request) => {
    // ----------------------------------------
    // 0. 인증 확인
    // ----------------------------------------
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;

    // ----------------------------------------
    // 1. 입력 검증
    // ----------------------------------------
    const parseResult = GeneratePanelImagesInputSchema.safeParse(request.data);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(', ');
      throw new HttpsError('invalid-argument', `입력 검증 실패: ${errors}`);
    }

    const { episodeId, aspectRatio, refImagePaths, indices } = parseResult.data;

    console.log('[generatePanelImages] Request received:', {
      episodeId,
      aspectRatio,
      refImageCount: refImagePaths?.length || 0,
      indices: indices || 'all',
    });

    // ----------------------------------------
    // 2. Rate Limiting
    // ----------------------------------------
    const clientIP = getClientIP(request);
    const { allowed } = await checkRateLimit(clientIP, 'generatePanelImages', 10, 60000);
    if (!allowed) {
      throw new HttpsError(
        'resource-exhausted',
        '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
      );
    }

    // ----------------------------------------
    // 3. Episode 로드 및 검증
    // ----------------------------------------
    const episodeRef = db.collection('episodes').doc(episodeId);
    const episodeDoc = await episodeRef.get();

    if (!episodeDoc.exists) {
      throw new HttpsError('not-found', '에피소드를 찾을 수 없습니다.');
    }

    const episode = episodeDoc.data() as Episode;

    // 권한 확인
    if (episode.creatorUid !== uid) {
      throw new HttpsError('permission-denied', '본인의 에피소드만 수정할 수 있습니다.');
    }

    if (!episode.finalPrompt) {
      throw new HttpsError(
        'failed-precondition',
        '스토리보드가 없습니다. 먼저 generateStoryboard를 호출해주세요.'
      );
    }

    const { finalPrompt } = episode;
    const globalStyle = finalPrompt.global;

    // 생성할 패널 인덱스 결정
    const panelPrompts = finalPrompt.panels;
    const targetIndices = indices
      ? indices.filter((i) => i >= 0 && i < panelPrompts.length)
      : panelPrompts.map((p) => p.index);

    if (targetIndices.length === 0) {
      throw new HttpsError('invalid-argument', '생성할 패널이 없습니다.');
    }

    console.log('[generatePanelImages] Generating panels:', {
      episodeId,
      targetIndices,
      totalPanels: panelPrompts.length,
    });

    // ----------------------------------------
    // 4. 레퍼런스 이미지 로드
    // ----------------------------------------
    const refImageParts: Part[] = [];

    if (refImagePaths && refImagePaths.length > 0) {
      console.log('[generatePanelImages] Loading reference images...');

      for (const path of refImagePaths) {
        const imageData = await loadImageFromStorage(path);
        if (imageData) {
          refImageParts.push({
            inlineData: {
              data: imageData.base64,
              mimeType: imageData.mimeType,
            },
          });
        }
      }

      console.log('[generatePanelImages] Loaded reference images:', {
        requested: refImagePaths.length,
        loaded: refImageParts.length,
      });
    }

    // 레퍼런스 이미지가 있으면 컨텍스트 설명 추가
    if (refImageParts.length > 0) {
      refImageParts.unshift({
        text: 'These are character reference images. The generated image MUST depict the SAME character with identical appearance (hair style, hair color, face shape, eye shape, clothing style):',
      });
    }

    // ----------------------------------------
    // 5. Gemini 클라이언트 생성
    // ----------------------------------------
    const genai = createGeminiClient();

    // ----------------------------------------
    // 6. 패널 이미지 병렬 생성 (동시성 제한)
    // ----------------------------------------
    const tasks = targetIndices.map((panelIndex) => {
      const panelPrompt = panelPrompts.find((p) => p.index === panelIndex);
      if (!panelPrompt) {
        return async () => ({ index: panelIndex, error: '패널 프롬프트를 찾을 수 없습니다.' });
      }

      return async () => generateSinglePanelImage(
        genai,
        panelIndex,
        panelPrompt.prompt,
        globalStyle,
        aspectRatio,
        refImageParts
      );
    });

    const results = await limitConcurrency(tasks, CONCURRENCY_LIMIT);

    // ----------------------------------------
    // 7. 결과 처리 및 Storage 업로드
    // ----------------------------------------
    const bucket = storage.bucket();
    const successfulPanels: Panel[] = [];
    const failedIndices: number[] = [];

    for (const result of results) {
      if ('error' in result) {
        console.error(`[generatePanelImages] Panel ${result.index} failed:`, result.error);
        failedIndices.push(result.index);
        continue;
      }

      try {
        const filePath = `episodes/${episodeId}/panels/${result.index}.png`;
        const file = bucket.file(filePath);
        const imageBuffer = Buffer.from(result.base64, 'base64');

        await file.save(imageBuffer, {
          metadata: {
            contentType: result.mimeType,
          },
        });

        // 공개 URL 설정
        await file.makePublic();

        // 패널 정보 생성
        const panelPrompt = panelPrompts.find((p) => p.index === result.index);
        successfulPanels.push({
          index: result.index,
          imagePath: filePath,
          caption: panelPrompt?.captionDraft || '',
        });

        console.log(`[generatePanelImages] Panel ${result.index} saved:`, filePath);
      } catch (uploadError) {
        console.error(`[generatePanelImages] Panel ${result.index} upload failed:`, uploadError);
        failedIndices.push(result.index);
      }
    }

    // ----------------------------------------
    // 8. Firestore 업데이트
    // ----------------------------------------
    if (successfulPanels.length > 0) {
      // 기존 패널과 병합 (새로 생성된 패널로 덮어쓰기)
      const existingPanels = episode.panels || [];
      const updatedPanels = existingPanels.filter(
        (p: Panel) => !successfulPanels.some((sp) => sp.index === p.index)
      );
      updatedPanels.push(...successfulPanels);
      updatedPanels.sort((a: Panel, b: Panel) => a.index - b.index);

      // 썸네일 설정 (0번 패널 이미지 경로)
      const thumbPanel = updatedPanels.find((p: Panel) => p.index === 0);
      const thumbPath = thumbPanel?.imagePath;

      await episodeRef.update({
        panels: updatedPanels,
        ...(thumbPath && { thumbPath }),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log('[generatePanelImages] Firestore updated:', {
        episodeId,
        panelCount: updatedPanels.length,
        thumbPath,
      });
    }

    // ----------------------------------------
    // 9. 응답 반환
    // ----------------------------------------
    const ipHash = await hashText(clientIP);
    console.log('[generatePanelImages] Completed:', {
      episodeId,
      clientIpHash: ipHash,
      successful: successfulPanels.length,
      failed: failedIndices.length,
    });

    return {
      success: failedIndices.length === 0,
      episodeId,
      generated: successfulPanels.map((p) => ({
        index: p.index,
        imagePath: p.imagePath,
      })),
      failed: failedIndices,
      message: failedIndices.length > 0
        ? `${successfulPanels.length}개 성공, ${failedIndices.length}개 실패. 실패한 패널: [${failedIndices.join(', ')}]`
        : `${successfulPanels.length}개 패널 이미지 생성 완료`,
    };
  }
);
