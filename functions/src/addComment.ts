import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import { containsBannedWords, BANNED_WORDS } from './utils/gemini';
import { ALLOWED_EMOJIS } from './utils/types';

const db = admin.firestore();

interface AddCommentRequest {
  toonId: string;
  emoji: string;
  text: string;
}

/**
 * 익명 댓글 추가
 * 이모지 1개 + 80자 이내 코멘트
 */
export const addComment = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 10,
    memory: '128MiB',
    enforceAppCheck: false, // MVP에서는 비활성화
  },
  async (request) => {
    const { toonId, emoji, text } = request.data as AddCommentRequest;

    // 입력 검증
    if (!toonId) {
      throw new HttpsError('invalid-argument', '툰 ID가 필요합니다.');
    }

    if (!emoji) {
      throw new HttpsError('invalid-argument', '이모지를 선택해주세요.');
    }

    // 허용된 이모지 검증
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      throw new HttpsError('invalid-argument', '허용되지 않은 이모지입니다.');
    }

    // 텍스트 검증
    const trimmedText = (text || '').trim();
    if (trimmedText.length > 80) {
      throw new HttpsError('invalid-argument', '댓글은 80자 이내로 작성해주세요.');
    }

    // 욕설/스팸 필터
    if (trimmedText && containsBannedWords(trimmedText)) {
      throw new HttpsError('invalid-argument', '부적절한 내용이 포함되어 있습니다.');
    }

    // Rate limiting (댓글은 더 엄격하게)
    const clientIP = getClientIP(request);
    const { allowed, remaining } = await checkRateLimit(clientIP, 'addComment', 5, 60000);
    if (!allowed) {
      throw new HttpsError(
        'resource-exhausted',
        '댓글 작성이 너무 많습니다. 잠시 후 다시 시도해주세요.'
      );
    }

    // 툰 존재 확인
    const toonRef = db.collection('toons').doc(toonId);
    const toonDoc = await toonRef.get();
    if (!toonDoc.exists) {
      throw new HttpsError('not-found', '툰을 찾을 수 없습니다.');
    }

    // 댓글 생성
    const commentRef = toonRef.collection('comments').doc();
    const now = admin.firestore.Timestamp.now();

    await db.runTransaction(async (transaction) => {
      // 댓글 추가
      transaction.set(commentRef, {
        emoji,
        text: trimmedText,
        createdAt: now,
      });

      // 댓글 수 증가
      transaction.update(toonRef, {
        commentCount: admin.firestore.FieldValue.increment(1),
      });
    });

    return {
      success: true,
      commentId: commentRef.id,
      remaining, // 남은 댓글 가능 횟수
    };
  }
);
