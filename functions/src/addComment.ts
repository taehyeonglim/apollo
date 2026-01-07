import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { checkAnonRateLimit } from './utils/rateLimit';
import { hashText } from './utils/gemini';
import { ALLOWED_EMOJIS, AddCommentRequest } from './utils/types';

const db = admin.firestore();

// ==========================================
// 모더레이션 설정
// ==========================================

const BANNED_WORDS = [
  // 한국어 욕설
  '시발', '씨발', '병신', '지랄', '개새끼', '좆', '닥쳐', '썅', '미친년', '미친놈',
  // 영어 욕설
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt',
];

// URL 패턴
const URL_PATTERN = /(https?:\/\/|www\.|\.com|\.net|\.org|\.kr|\.io)/i;

// 반복 문자 패턴 (같은 문자 5개 이상 연속)
const REPEATED_CHAR_PATTERN = /(.)\1{4,}/;

// 스팸성 패턴
const SPAM_PATTERNS = [
  /카톡|카카오톡|텔레그램/i,
  /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/,  // 전화번호 패턴
  /광고|홍보|할인|이벤트/,
];

interface ModerationResult {
  flagged: boolean;
  reason?: string;
}

/**
 * 댓글 내용 모더레이션
 */
function moderateContent(text: string): ModerationResult {
  if (!text) {
    return { flagged: false };
  }

  const lowerText = text.toLowerCase();

  // 금칙어 체크
  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return { flagged: true, reason: 'banned_word' };
    }
  }

  // URL 체크
  if (URL_PATTERN.test(text)) {
    return { flagged: true, reason: 'url_detected' };
  }

  // 반복 문자 체크
  if (REPEATED_CHAR_PATTERN.test(text)) {
    return { flagged: true, reason: 'repeated_chars' };
  }

  // 스팸 패턴 체크
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { flagged: true, reason: 'spam_pattern' };
    }
  }

  return { flagged: false };
}

/**
 * anonId 유효성 검증 (UUID v4 형식)
 */
function isValidAnonId(anonId: string): boolean {
  if (!anonId || typeof anonId !== 'string') return false;
  // UUID v4 형식: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(anonId);
}

/**
 * 익명 댓글 추가 (App Check 강제)
 * - 이모지 1개 + 80자 이내 코멘트
 * - anonId 기반 rate limiting (1분 3개, 1일 30개)
 * - 기본 모더레이션 (금칙어, URL, 반복문자)
 */
export const addComment = onCall(
  {
    region: 'asia-northeast3',
    timeoutSeconds: 10,
    memory: '128MiB',
    enforceAppCheck: false, // 개발 중 비활성화
  },
  async (request) => {
    const { episodeId, emoji, text, anonId } = request.data as AddCommentRequest;

    // 입력 검증
    if (!episodeId || typeof episodeId !== 'string') {
      throw new HttpsError('invalid-argument', '에피소드 ID가 필요합니다.');
    }

    if (!emoji || typeof emoji !== 'string') {
      throw new HttpsError('invalid-argument', '이모지를 선택해주세요.');
    }

    // anonId 검증
    if (!isValidAnonId(anonId)) {
      throw new HttpsError('invalid-argument', '유효하지 않은 익명 ID입니다.');
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

    // anonId 해시
    const anonIdHash = await hashText(anonId);

    // Rate limiting (anonId 기반, 분/일 이중 체크)
    const rateResult = await checkAnonRateLimit(anonIdHash, 'comment');
    if (!rateResult.allowed) {
      if (rateResult.errorType === 'minute') {
        throw new HttpsError(
          'resource-exhausted',
          `댓글 작성이 너무 빠릅니다. ${rateResult.retryAfterSeconds}초 후에 다시 시도해주세요.`
        );
      } else {
        throw new HttpsError(
          'resource-exhausted',
          '오늘 댓글 작성 한도를 초과했습니다. 내일 다시 시도해주세요.'
        );
      }
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

    // 모더레이션 체크
    const moderation = moderateContent(trimmedText);

    // 댓글 생성
    const commentRef = episodeRef.collection('comments').doc();
    const now = admin.firestore.Timestamp.now();

    await commentRef.set({
      emoji,
      text: trimmedText,
      createdAt: now,
      anonIdHash,
      moderation: {
        flagged: moderation.flagged,
        ...(moderation.reason && { reason: moderation.reason }),
      },
    });

    console.log('[addComment] Comment added:', {
      episodeId,
      commentId: commentRef.id,
      emoji,
      textLength: trimmedText.length,
      flagged: moderation.flagged,
      flagReason: moderation.reason,
      remainingMinute: rateResult.remainingMinute,
      remainingDay: rateResult.remainingDay,
    });

    return {
      success: true,
      commentId: commentRef.id,
      flagged: moderation.flagged,
      remainingMinute: rateResult.remainingMinute,
      remainingDay: rateResult.remainingDay,
    };
  }
);
