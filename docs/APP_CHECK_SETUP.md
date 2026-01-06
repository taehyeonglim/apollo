# Firebase App Check Setup Guide

App Check는 앱의 요청이 실제 앱에서 온 것인지 확인하여 abuse를 방지합니다.

## 1. Firebase Console에서 App Check 활성화

### 1.1 reCAPTCHA v3 Provider 설정

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택 → **App Check** 메뉴
3. **Web app** 선택
4. **reCAPTCHA** 탭 클릭
5. [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)에서 새 사이트 등록:
   - **Label**: A.P.O.L.L.O. (임의 이름)
   - **reCAPTCHA type**: **reCAPTCHA v3**
   - **Domains**:
     - `localhost` (개발용)
     - `your-project-id.web.app`
     - `your-project-id.firebaseapp.com`
     - 커스텀 도메인 (있는 경우)
6. **Site Key**와 **Secret Key** 복사
7. Firebase Console App Check 화면에서:
   - **reCAPTCHA secret key** 입력
   - **Save** 클릭

### 1.2 App Check Enforcement 설정

1. Firebase Console → **App Check** → **APIs**
2. 각 서비스에 대해 **Enforce** 활성화:
   - **Cloud Functions** - 반드시 활성화
   - **Cloud Firestore** - 권장
   - **Cloud Storage** - 권장

> **주의**: Enforcement 활성화 전에 클라이언트 앱이 App Check를 올바르게 구현했는지 확인하세요.

## 2. 환경 변수 설정

### 2.1 Web App (.env.local)

```bash
# Firebase 설정 (기존)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# App Check (reCAPTCHA v3 Site Key)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

## 3. 코드 구현

### 3.1 Firebase 초기화 (이미 구현됨)

`web/src/lib/firebase.ts`에서 App Check가 자동으로 초기화됩니다:

```typescript
// App Check 초기화 (프로덕션 환경)
if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !_appCheck) {
  try {
    if (process.env.NODE_ENV === 'development') {
      // 개발 환경에서는 Debug Token 사용
      // @ts-expect-error - Firebase App Check debug token
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    _appCheck = initializeAppCheck(_app, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn('App Check 초기화 실패:', error);
  }
}
```

### 3.2 Cloud Functions에서 App Check 강제

`functions/src/addComment.ts`:

```typescript
export const addComment = onCall(
  {
    region: 'asia-northeast3',
    enforceAppCheck: true,  // App Check 강제
  },
  async (request) => {
    // App Check 토큰이 없거나 유효하지 않으면 자동으로 거부됨
    // ...
  }
);
```

## 4. 개발 환경 설정 (Debug Token)

로컬 개발 시 App Check를 우회하려면 Debug Token을 사용합니다.

### 4.1 Debug Token 등록

1. 브라우저 개발자 도구 콘솔에서 Debug Token 확인:
   ```
   App Check debug token: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
2. Firebase Console → **App Check** → **Apps** → 앱 선택 → **Debug tokens**
3. **Add debug token** 클릭
4. 콘솔에서 복사한 토큰 입력

### 4.2 에뮬레이터 사용 시

에뮬레이터에서는 App Check가 자동으로 비활성화됩니다. 별도 설정 불필요.

## 5. 프로덕션 체크리스트

- [ ] reCAPTCHA v3 Site Key 환경 변수 설정
- [ ] Firebase Console에서 App Check 활성화
- [ ] Cloud Functions에서 `enforceAppCheck: true` 설정
- [ ] 프로덕션 도메인이 reCAPTCHA에 등록됨
- [ ] App Check Enforcement 활성화 (점진적 롤아웃 권장)

## 6. 트러블슈팅

### "App Check token missing" 에러

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` 환경 변수 확인
- reCAPTCHA 도메인 설정 확인
- 브라우저 캐시/쿠키 삭제 후 재시도

### "App Check token invalid" 에러

- reCAPTCHA Secret Key가 Firebase Console에 올바르게 입력되었는지 확인
- 도메인이 reCAPTCHA에 등록되었는지 확인

### 개발 환경에서 작동 안 함

1. `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` 설정 확인
2. Debug Token을 Firebase Console에 등록했는지 확인
3. 개발 서버 재시작

## 7. Rate Limit과 함께 사용

App Check는 봇 공격을 방지하지만, 정상 사용자의 abuse까지 막지는 못합니다.
따라서 `addComment` 함수에는 App Check + anonId 기반 rate limiting이 함께 적용됩니다:

- **1분당 3회** 제한
- **1일당 30회** 제한

Rate limit 초과 시 에러 메시지:
- "댓글 작성이 너무 빠릅니다. N초 후에 다시 시도해주세요."
- "오늘 댓글 작성 한도를 초과했습니다. 내일 다시 시도해주세요."
