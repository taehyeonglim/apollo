import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createGeminiClient, geminiApiKey } from './utils/gemini';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { Character, Draft, Panel } from './utils/types';

const db = admin.firestore();
const storage = admin.storage();

interface GeneratePanelRequest {
  draftId: string;
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
    enforceAppCheck: false,
  },
  async (request) => {
    const { draftId, panelIndex, regenerate = false } = request.data as GeneratePanelRequest;

    // 입력 검증
    if (!draftId) {
      throw new HttpsError('invalid-argument', '드래프트 ID가 필요합니다.');
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const { allowed } = await checkRateLimit(clientIP, 'generatePanelImage', 20, 60000);
    if (!allowed) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    // 드래프트 로드
    const draftDoc = await db.collection('drafts').doc(draftId).get();
    if (!draftDoc.exists) {
      throw new HttpsError('not-found', '드래프트를 찾을 수 없습니다.');
    }
    const draft = { id: draftDoc.id, ...draftDoc.data() } as Draft;

    if (!draft.storyboard) {
      throw new HttpsError('failed-precondition', '스토리보드가 없습니다. 먼저 스토리보드를 생성해주세요.');
    }

    const panelSpec = draft.storyboard.panels[panelIndex];
    if (!panelSpec) {
      throw new HttpsError('invalid-argument', `패널 인덱스 ${panelIndex}를 찾을 수 없습니다.`);
    }

    // 이미 생성된 패널이 있고 regenerate가 아니면 기존 패널 반환
    const existingPanel = draft.panels.find((p) => p.order === panelIndex);
    if (existingPanel && !regenerate) {
      return {
        success: true,
        panel: existingPanel,
      };
    }

    // 캐릭터 정보 로드
    const characterDoc = await db.collection('characters').doc(draft.characterId).get();
    if (!characterDoc.exists) {
      throw new HttpsError('not-found', '캐릭터를 찾을 수 없습니다.');
    }
    const character = { id: characterDoc.id, ...characterDoc.data() } as Character;

    // Gemini 클라이언트 생성
    const genai = createGeminiClient();

    // 캐릭터 레퍼런스 이미지 로드
    const referenceImages = await loadReferenceImages(character.referenceImageUrls);

    // 이미지 생성 프롬프트 구성
    const imagePrompt = buildImagePrompt(character, panelSpec, draft.storyboard.style);

    try {
      // 멀티모달 요청 구성 (레퍼런스 이미지 + 텍스트 프롬프트)
      const contents: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

      // 레퍼런스 이미지들 추가
      for (const img of referenceImages) {
        contents.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64,
          },
        });
      }

      // 텍스트 프롬프트 추가
      contents.push({
        text: imagePrompt,
      });

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
        throw new Error('이미지 생성에 실패했습니다.');
      }

      // Storage에 업로드
      const panelId = `panel_${panelIndex}_${Date.now()}`;
      const bucket = storage.bucket();
      const filePath = `panels/${draftId}/${panelId}.png`;
      const file = bucket.file(filePath);

      const imageBuffer = Buffer.from(imageBase64, 'base64');
      await file.save(imageBuffer, {
        metadata: {
          contentType: imageMimeType,
        },
      });

      // 공개 URL 생성
      await file.makePublic();
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      // 패널 객체 생성
      const panel: Panel = {
        id: panelId,
        order: panelIndex,
        imageUrl,
        caption: panelSpec.caption,
        prompt: imagePrompt, // 최종 프롬프트 저장
        generatedAt: admin.firestore.Timestamp.now(),
      };

      // 드래프트 업데이트
      const updatedPanels = draft.panels.filter((p) => p.order !== panelIndex);
      updatedPanels.push(panel);
      updatedPanels.sort((a, b) => a.order - b.order);

      await draftDoc.ref.update({
        panels: updatedPanels,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      return {
        success: true,
        panel,
      };
    } catch (error) {
      console.error('Panel image generation error:', error);
      throw new HttpsError('internal', '이미지 생성 중 오류가 발생했습니다.');
    }
  }
);

/**
 * Storage에서 레퍼런스 이미지들 로드
 */
async function loadReferenceImages(
  urls: string[]
): Promise<Array<{ base64: string; mimeType: string }>> {
  const images: Array<{ base64: string; mimeType: string }> = [];

  for (const url of urls.slice(0, 3)) {
    // 최대 3개 이미지
    try {
      // Firebase Storage URL에서 파일 경로 추출
      const bucket = storage.bucket();

      // URL 파싱하여 파일 경로 추출
      let filePath: string;
      if (url.includes('storage.googleapis.com')) {
        const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
        filePath = match ? decodeURIComponent(match[1]) : '';
      } else if (url.includes('firebasestorage.googleapis.com')) {
        const match = url.match(/o\/(.+?)\?/);
        filePath = match ? decodeURIComponent(match[1]) : '';
      } else {
        continue;
      }

      if (!filePath) continue;

      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();

      images.push({
        base64: buffer.toString('base64'),
        mimeType: metadata.contentType || 'image/png',
      });
    } catch (error) {
      console.warn(`레퍼런스 이미지 로드 실패: ${url}`, error);
    }
  }

  return images;
}

/**
 * 이미지 생성 프롬프트 구성
 */
function buildImagePrompt(
  character: Character,
  panelSpec: {
    scene: string;
    imagePrompt: string;
    emotion: string;
    composition: string;
  },
  style: { artStyle: string; colorPalette: string; mood: string }
): string {
  const { traits } = character;

  return `Generate a single panel image for an instagram webtoon.

STYLE: ${style.artStyle}
COLOR PALETTE: ${style.colorPalette}
MOOD: ${style.mood}

CHARACTER (MUST MATCH EXACTLY - refer to the reference images above):
- Name: ${character.name}
- ${traits.gender}, ${traits.age}
- Hair: ${traits.hairStyle}, ${traits.hairColor}
- Eyes: ${traits.eyeColor}
- Skin: ${traits.skinTone}
- Clothing: ${traits.clothing}
- Distinctive features: ${traits.distinctiveFeatures.join(', ')}

SCENE: ${panelSpec.scene}
EMOTION: ${panelSpec.emotion}
COMPOSITION: ${panelSpec.composition}

DETAILED PROMPT: ${panelSpec.imagePrompt}

REQUIREMENTS:
1. The character MUST look identical to the reference images provided
2. Clean, professional webtoon illustration style
3. No text or speech bubbles in the image
4. Square aspect ratio (1:1)
5. High quality, vibrant colors
6. Expressive character emotions`;
}
