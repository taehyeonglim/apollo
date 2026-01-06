import * as admin from 'firebase-admin';

const db = admin.firestore();

interface RateLimitDoc {
  count: number;
  windowStart: FirebaseFirestore.Timestamp;
}

/**
 * IP 기반 Rate Limiting
 * @param ip 클라이언트 IP
 * @param action 액션 종류
 * @param maxRequests 윈도우당 최대 요청 수
 * @param windowMs 윈도우 크기 (밀리초)
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000 // 1분
): Promise<{ allowed: boolean; remaining: number }> {
  // IP 해시 생성 (개인정보 보호)
  const crypto = await import('crypto');
  const ipHash = crypto.createHash('sha256').update(ip + action).digest('hex').substring(0, 16);

  const docRef = db.collection('rateLimits').doc(ipHash);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const now = admin.firestore.Timestamp.now();

    if (!doc.exists) {
      // 첫 요청
      transaction.set(docRef, {
        count: 1,
        windowStart: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    const data = doc.data() as RateLimitDoc;
    const windowStartMs = data.windowStart.toMillis();
    const nowMs = now.toMillis();

    if (nowMs - windowStartMs > windowMs) {
      // 윈도우 만료, 리셋
      transaction.set(docRef, {
        count: 1,
        windowStart: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (data.count >= maxRequests) {
      // 한도 초과
      return { allowed: false, remaining: 0 };
    }

    // 카운트 증가
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

  // Firebase Hosting / Cloud Run은 x-forwarded-for 사용
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // 직접 연결 (로컬 개발)
  return headers['x-real-ip'] as string || '127.0.0.1';
}
