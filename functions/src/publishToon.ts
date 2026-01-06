import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import type { Episode } from './utils/types';

const db = admin.firestore();

interface PublishEpisodeRequest {
  episodeId: string;
}

/**
 * 에피소드를 공개 상태로 게시
 */
export const publishToon = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: true,
  },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;

    const { episodeId } = request.data as PublishEpisodeRequest;

    if (!episodeId) {
      throw new HttpsError('invalid-argument', '에피소드 ID가 필요합니다.');
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const { allowed } = await checkRateLimit(clientIP, 'publishToon', 3, 60000);
    if (!allowed) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    // 에피소드 로드
    const episodeRef = db.collection('episodes').doc(episodeId);
    const episodeDoc = await episodeRef.get();
    if (!episodeDoc.exists) {
      throw new HttpsError('not-found', '에피소드를 찾을 수 없습니다.');
    }
    const episode = episodeDoc.data() as Episode;

    // 권한 확인
    if (episode.creatorUid !== uid) {
      throw new HttpsError('permission-denied', '본인의 에피소드만 게시할 수 있습니다.');
    }

    // 이미 게시된 경우
    if (episode.status === 'published') {
      return {
        success: true,
        message: '이미 게시된 에피소드입니다.',
      };
    }

    // 검증
    if (!episode.finalPrompt) {
      throw new HttpsError('failed-precondition', '스토리보드가 없습니다.');
    }

    if (!episode.panels || episode.panels.length === 0) {
      throw new HttpsError('failed-precondition', '생성된 이미지가 없습니다.');
    }

    // 모든 패널이 생성되었는지 확인
    const expectedPanels = episode.finalPrompt.panels.length;
    if (episode.panels.length < expectedPanels) {
      throw new HttpsError(
        'failed-precondition',
        `모든 패널 이미지가 생성되지 않았습니다. (${episode.panels.length}/${expectedPanels})`
      );
    }

    const now = admin.firestore.Timestamp.now();

    // 상태 업데이트
    await episodeRef.update({
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    });

    console.log('[publishToon] Episode published:', { episodeId });

    return {
      success: true,
      episodeId,
    };
  }
);
