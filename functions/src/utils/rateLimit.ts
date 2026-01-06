import * as admin from 'firebase-admin';
import { RATE_LIMIT_CONFIG } from './types';

const db = admin.firestore();

interface AnonRateLimitDoc {
  minuteCount: number;
  minuteWindowStart: FirebaseFirestore.Timestamp;
  dayCount: number;
  dayWindowStart: FirebaseFirestore.Timestamp;
}

interface RateLimitResult {
  allowed: boolean;
  remainingMinute: number;
  remainingDay: number;
  retryAfterSeconds?: number;
  errorType?: 'minute' | 'day';
}

/**
 * anonId 기반 Rate Limiting (분/일 이중 제한)
 * @param anonIdHash 해시된 익명 ID
 * @param action 액션 종류 (예: 'comment')
 */
export async function checkAnonRateLimit(
  anonIdHash: string,
  action: keyof typeof RATE_LIMIT_CONFIG
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIG[action];
  const docRef = db.collection('rateLimits').doc(`anon_${anonIdHash}_${action}`);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    if (!doc.exists) {
      // 첫 요청
      transaction.set(docRef, {
        minuteCount: 1,
        minuteWindowStart: now,
        dayCount: 1,
        dayWindowStart: now,
      });
      return {
        allowed: true,
        remainingMinute: config.perMinute - 1,
        remainingDay: config.perDay - 1,
      };
    }

    const data = doc.data() as AnonRateLimitDoc;
    const minuteWindowStartMs = data.minuteWindowStart.toMillis();
    const dayWindowStartMs = data.dayWindowStart.toMillis();

    let newMinuteCount = data.minuteCount;
    let newDayCount = data.dayCount;
    let newMinuteWindowStart = data.minuteWindowStart;
    let newDayWindowStart = data.dayWindowStart;

    // 분 윈도우 체크
    if (nowMs - minuteWindowStartMs > config.minuteWindowMs) {
      // 분 윈도우 리셋
      newMinuteCount = 0;
      newMinuteWindowStart = now;
    }

    // 일 윈도우 체크
    if (nowMs - dayWindowStartMs > config.dayWindowMs) {
      // 일 윈도우 리셋
      newDayCount = 0;
      newDayWindowStart = now;
    }

    // 분 한도 체크
    if (newMinuteCount >= config.perMinute) {
      const retryAfter = Math.ceil(
        (config.minuteWindowMs - (nowMs - newMinuteWindowStart.toMillis())) / 1000
      );
      return {
        allowed: false,
        remainingMinute: 0,
        remainingDay: config.perDay - newDayCount,
        retryAfterSeconds: retryAfter,
        errorType: 'minute',
      };
    }

    // 일 한도 체크
    if (newDayCount >= config.perDay) {
      const retryAfter = Math.ceil(
        (config.dayWindowMs - (nowMs - newDayWindowStart.toMillis())) / 1000
      );
      return {
        allowed: false,
        remainingMinute: config.perMinute - newMinuteCount,
        remainingDay: 0,
        retryAfterSeconds: retryAfter,
        errorType: 'day',
      };
    }

    // 카운트 증가
    transaction.set(docRef, {
      minuteCount: newMinuteCount + 1,
      minuteWindowStart: newMinuteWindowStart,
      dayCount: newDayCount + 1,
      dayWindowStart: newDayWindowStart,
    });

    return {
      allowed: true,
      remainingMinute: config.perMinute - newMinuteCount - 1,
      remainingDay: config.perDay - newDayCount - 1,
    };
  });
}

/**
 * IP 기반 Rate Limiting (다른 기능용)
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000
): Promise<{ allowed: boolean; remaining: number }> {
  const crypto = await import('crypto');
  const ipHash = crypto.createHash('sha256').update(ip + action).digest('hex').substring(0, 16);

  const docRef = db.collection('rateLimits').doc(ipHash);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const now = admin.firestore.Timestamp.now();

    if (!doc.exists) {
      transaction.set(docRef, {
        count: 1,
        windowStart: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    const data = doc.data() as { count: number; windowStart: FirebaseFirestore.Timestamp };
    const windowStartMs = data.windowStart.toMillis();
    const nowMs = now.toMillis();

    if (nowMs - windowStartMs > windowMs) {
      transaction.set(docRef, {
        count: 1,
        windowStart: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (data.count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    transaction.update(docRef, {
      count: admin.firestore.FieldValue.increment(1),
    });

    return { allowed: true, remaining: maxRequests - data.count - 1 };
  });
}

/**
 * 클라이언트 IP 추출
 */
export function getClientIP(request: { rawRequest: { headers: Record<string, string | string[] | undefined> } }): string {
  const headers = request.rawRequest.headers;

  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  return headers['x-real-ip'] as string || '127.0.0.1';
}
