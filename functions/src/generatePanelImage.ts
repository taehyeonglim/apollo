import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createGeminiClient, geminiApiKey } from './utils/gemini';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { Episode, Panel } from './utils/types';

const db = admin.firestore();
const storage = admin.storage();

interface GeneratePanelImageRequest {
  episodeId: string;
  panelIndex: number;
  regenerate?: boolean;
}

/**
 * 패널 이미지 생성
 * Gemini 2.5 Flash Image 모델 사용 (캐릭터 레퍼런스 이미지 포함)
 */
export const generatePanelImage = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '1GiB',
    enforceAppCheck: false, // 개발 중 비활성화
  },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;

    const { episodeId, panelIndex, regenerate = false } = request.data as GeneratePanelImageRequest;

    // 입력 검증
    if (!episodeId) {
      throw new HttpsError('invalid-argument', '에피소드 ID가 필요합니다.');
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const { allowed } = await checkRateLimit(clientIP, 'generatePanelImage', 20, 60000);
    if (!allowed) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    // 에피소드 로드
    const episodeDoc = await db.collection('episodes').doc(episodeId).get();
    if (!episodeDoc.exists) {
      throw new HttpsError('not-found', '에피소드를 찾을 수 없습니다.');
    }
    const episode = episodeDoc.data() as Episode;

    // 권한 확인
    if (episode.creatorUid !== uid) {
      throw new HttpsError('permission-denied', '본인의 에피소드만 수정할 수 있습니다.');
    }

    if (!episode.finalPrompt) {
      throw new HttpsError('failed-precondition', '스토리보드가 없습니다. 먼저 스토리보드를 생성해주세요.');
    }

    const panelPrompt = episode.finalPrompt.panels.find((p) => p.index === panelIndex);
    if (!panelPrompt) {
      throw new HttpsError('invalid-argument', `패널 인덱스 ${panelIndex}를 찾을 수 없습니다.`);
    }

    // 이미 생성된 패널이 있고 regenerate가 아니면 기존 패널 반환
    const existingPanel = episode.panels.find((p: Panel) => p.index === panelIndex);
    if (existingPanel && !regenerate) {
      return {
        success: true,
        panel: existingPanel,
      };
    }

    // Gemini 클라이언트 생성
    const genai = createGeminiClient();

    // 이미지 생성 프롬프트 구성 (캐릭터 묘사가 이미 포함되어 있음)
    const imagePrompt = buildImagePrompt(
      panelPrompt.prompt,
      episode.finalPrompt.global
    );

    try {
      console.log('[generatePanelImage] Generating image for panel:', { episodeId, panelIndex });

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: imagePrompt,
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
        throw new Error('이미지 생성에 실패했습니다.');
      }

      // Storage에 업로드
      const bucket = storage.bucket();
      const filePath = `episodes/${episodeId}/panels/${panelIndex}.png`;
      const file = bucket.file(filePath);

      const imageBuffer = Buffer.from(imageBase64, 'base64');
      await file.save(imageBuffer, {
        metadata: {
          contentType: imageMimeType,
        },
      });

      // 공개 URL 생성
      await file.makePublic();

      // 패널 객체 생성
      const panel: Panel = {
        index: panelIndex,
        imagePath: filePath,
        caption: panelPrompt.captionDraft,
      };

      // 에피소드 업데이트
      const updatedPanels = episode.panels.filter((p: Panel) => p.index !== panelIndex);
      updatedPanels.push(panel);
      updatedPanels.sort((a: Panel, b: Panel) => a.index - b.index);

      await episodeDoc.ref.update({
        panels: updatedPanels,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log('[generatePanelImage] Panel generated successfully:', { episodeId, panelIndex });

      return {
        success: true,
        panel,
      };
    } catch (error) {
      console.error('[generatePanelImage] Error:', error);
      throw new HttpsError('internal', '이미지 생성 중 오류가 발생했습니다.');
    }
  }
);

/**
 * 이미지 생성 프롬프트 구성
 */
function buildImagePrompt(
  panelPrompt: string,
  globalStyle: { artStyle: string; colorPalette: string; negatives: string }
): string {
  return `Generate a single panel image for an Instagram webtoon (인스타툰).

STYLE: ${globalStyle.artStyle}
COLOR PALETTE: ${globalStyle.colorPalette}

SCENE DESCRIPTION:
${panelPrompt}

REQUIREMENTS:
1. Clean, professional webtoon illustration style
2. No text or speech bubbles in the image
3. Square aspect ratio (1:1)
4. High quality, vibrant colors
5. Expressive character emotions
6. Simple, clean background

AVOID: ${globalStyle.negatives}`;
}
