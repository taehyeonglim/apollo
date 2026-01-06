import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { Draft, Toon } from './utils/types';

const db = admin.firestore();

interface PublishToonRequest {
  draftId: string;
}

/**
 * 드래프트를 공개 툰으로 게시
 */
export const publishToon = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    const { draftId } = request.data as PublishToonRequest;

    if (!draftId) {
      throw new HttpsError('invalid-argument', '드래프트 ID가 필요합니다.');
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const { allowed } = await checkRateLimit(clientIP, 'publishToon', 3, 60000);
    if (!allowed) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    // 드래프트 로드
    const draftDoc = await db.collection('drafts').doc(draftId).get();
    if (!draftDoc.exists) {
      throw new HttpsError('not-found', '드래프트를 찾을 수 없습니다.');
    }
    const draft = { id: draftDoc.id, ...draftDoc.data() } as Draft;

    // 검증
    if (!draft.storyboard) {
      throw new HttpsError('failed-precondition', '스토리보드가 없습니다.');
    }

    if (!draft.panels || draft.panels.length === 0) {
      throw new HttpsError('failed-precondition', '생성된 이미지가 없습니다.');
    }

    // 모든 패널이 생성되었는지 확인
    const expectedPanels = draft.storyboard.panels.length;
    if (draft.panels.length < expectedPanels) {
      throw new HttpsError(
        'failed-precondition',
        `모든 패널 이미지가 생성되지 않았습니다. (${draft.panels.length}/${expectedPanels})`
      );
    }

    const now = admin.firestore.Timestamp.now();

    // 툰 문서 생성
    const toonRef = db.collection('toons').doc();
    const toon: Omit<Toon, 'id'> = {
      title: draft.storyboard.title,
      originalDiary: draft.originalDiary,
      storyboard: draft.storyboard, // 최종 스토리보드만 저장
      panels: draft.panels,
      status: 'published',
      characterId: draft.characterId,
      createdAt: draft.createdAt,
      updatedAt: now,
      publishedAt: now,
      viewCount: 0,
      commentCount: 0,
    };

    // 트랜잭션으로 툰 생성 + 드래프트 삭제
    await db.runTransaction(async (transaction) => {
      transaction.set(toonRef, toon);
      transaction.delete(draftDoc.ref);
    });

    return {
      success: true,
      toonId: toonRef.id,
    };
  }
);
