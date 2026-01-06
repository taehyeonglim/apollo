import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkRateLimit, getClientIP } from './utils/rateLimit';
import { containsBannedWords, hashText } from './utils/gemini';
import { ALLOWED_EMOJIS } from './utils/types';

const db = admin.firestore();

interface AddCommentRequest {
  episodeId: string;
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
    const { episodeId, emoji, text } = request.data as AddCommentRequest;

    // 입력 검증
    if (!episodeId) {
      throw new HttpsError('invalid-argument', '에피소드 ID가 필요합니다.');
    }

    if (!emoji) {
      throw new HttpsError('invalid-argument', '이모지를 선택해주세요.');
    }

    // 허용된 이모지 검증
    const allowedEmojiList: readonly string[] = ALLOWED_EMOJIS;
    if (!allowedEmojiList.includes(emoji)) {
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

    // 에피소드 존재 확인 + published 상태 확인
    const episodeRef = db.collection('episodes').doc(episodeId);
    const episodeDoc = await episodeRef.get();
    if (!episodeDoc.exists) {
      throw new HttpsError('not-found', '에피소드를 찾을 수 없습니다.');
    }

    const episodeData = episodeDoc.data();
    if (episodeData?.status !== 'published') {
      throw new HttpsError('permission-denied', '공개된 에피소드에만 댓글을 달 수 있습니다.');
    }

    // 익명 ID 해시 생성
    const anonIdHash = await hashText(clientIP + episodeId);

    // 댓글 생성
    const commentRef = episodeRef.collection('comments').doc();
    const now = admin.firestore.Timestamp.now();

    await commentRef.set({
      emoji,
      text: trimmedText,
      createdAt: now,
      anonIdHash,
      moderation: {
        flagged: false,
      },
    });

    console.log('[addComment] Comment added:', {
      episodeId,
      commentId: commentRef.id,
      emoji,
      textLength: trimmedText.length,
    });

    return {
      success: true,
      commentId: commentRef.id,
      remaining, // 남은 댓글 가능 횟수
    };
  }
);
