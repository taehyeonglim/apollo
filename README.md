# A.P.O.L.L.O.

**AI-Prompt-Orchestrated Life Log Overlays**

일기를 인스타툰으로 변환하는 AI 웹앱입니다.

## 주요 기능

- **일기 → 스토리보드**: Gemini 텍스트 모델이 일기를 분석하여 4컷(가변) 만화 스토리보드 생성
- **스토리보드 → 이미지**: Gemini 2.5 Flash Image가 캐릭터 레퍼런스를 참고해 패널 이미지 생성
- **에디터**: 캡션 수정, 패널 재생성 등 편집 기능
- **갤러리**: 게시된 인스타툰 공개 갤러리
- **익명 댓글**: 이모지 + 짧은 코멘트 (80자 제한)

## 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Firebase Cloud Functions v2 (TypeScript)
- **Database**: Firestore
- **Storage**: Firebase Storage
- **AI**: Gemini API (@google/genai SDK)
- **Hosting**: Firebase Hosting

## 프로젝트 구조

```
apollo/
├── web/                          # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/                  # App Router 페이지
│   │   ├── components/           # 재사용 컴포넌트
│   │   ├── lib/                  # Firebase, API 유틸리티
│   │   └── types/                # TypeScript 타입
│   └── package.json
├── functions/                    # Cloud Functions
│   ├── src/
│   │   ├── generateStoryboard.ts # 일기 → 스토리보드
│   │   ├── generatePanelImages.ts # 패널 이미지 일괄 생성
│   │   ├── publishToon.ts        # 툰 게시
│   │   ├── addComment.ts         # 댓글 추가
│   │   └── utils/                # 유틸리티
│   └── package.json
├── docs/                         # 문서
│   └── APP_CHECK_SETUP.md        # App Check 설정 가이드
├── firebase.json
├── firestore.rules
├── storage.rules
└── README.md
```

---

## 로컬 개발 환경 설정

### 1. 사전 요구사항

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase 프로젝트 (Blaze 요금제 - Functions 사용 시 필요)
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com/apikey)에서 발급)

### 2. 프로젝트 클론 및 설정

```bash
# 클론
git clone <repository-url>
cd apollo

# Firebase 프로젝트 연결
firebase login
firebase use --add  # 프로젝트 선택
```

### 3. 환경 변수 설정

#### Web 환경 변수 (.env.local)

```bash
cd web
cp .env.local.example .env.local
```

`.env.local` 파일을 편집하여 Firebase 콘솔에서 복사한 설정값 입력:

```bash
# Firebase 설정 (Firebase Console > 프로젝트 설정 > 일반 > 내 앱)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# App Check (선택, 프로덕션 권장)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key

# 에뮬레이터 사용 시
NEXT_PUBLIC_USE_EMULATOR=true
```

#### Gemini API 키 (Secret Manager)

**중요: API 키는 절대 git에 커밋하지 마세요!**

```bash
# Secret Manager에 API 키 등록
firebase functions:secrets:set GEMINI_API_KEY

# 프롬프트에서 API 키 입력 (입력 내용 숨김 처리됨)
? Enter a value for GEMINI_API_KEY [input is hidden]
```

Functions에서 시크릿 참조 방법 (`functions/src/utils/gemini.ts`):

```typescript
import { defineSecret } from 'firebase-functions/params';

// Secret Manager에서 API 키 로드
export const geminiApiKey = defineSecret('GEMINI_API_KEY');

// 함수 정의 시 secrets 옵션에 포함
export const generateStoryboard = onCall(
  {
    secrets: [geminiApiKey],  // 이 함수에서 시크릿 사용
    // ...
  },
  async (request) => {
    const apiKey = geminiApiKey.value();  // 런타임에 값 접근
    // ...
  }
);
```

### 4. 의존성 설치

```bash
# Web 의존성
npm install --prefix web

# Functions 의존성
npm install --prefix functions
```

### 5. 로컬 개발 실행

#### 터미널 1: Firebase 에뮬레이터

```bash
# Functions 빌드 (TypeScript → JavaScript)
npm run build --prefix functions

# 에뮬레이터 시작
firebase emulators:start
```

에뮬레이터 UI: http://localhost:4000

**에뮬레이터 포트:**
| 서비스 | 포트 |
|--------|------|
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Auth | 9099 |
| Hosting | 5002 |
| UI | 4000 |

#### 터미널 2: Next.js 개발 서버

```bash
cd web
npm run dev
```

개발 서버: http://localhost:3000

### 6. 개발 팁

```bash
# Functions 변경 시 재빌드
npm run build --prefix functions

# Functions 실시간 빌드 (watch 모드)
npm run build:watch --prefix functions

# 에뮬레이터 데이터 유지 (재시작 시 데이터 보존)
firebase emulators:start --import=./emulator-data --export-on-exit
```

---

## 배포

### 1단계: Secret Manager 설정 (최초 1회)

```bash
# Gemini API 키 등록
firebase functions:secrets:set GEMINI_API_KEY
```

### 2단계: 전체 배포

```bash
# Web 빌드
npm run build --prefix web

# 전체 배포 (Functions + Hosting + Rules)
firebase deploy --only functions,hosting,firestore:rules,storage:rules
```

### 개별 배포

```bash
# Functions만 배포
firebase deploy --only functions

# Hosting만 배포
firebase deploy --only hosting

# Rules만 배포
firebase deploy --only firestore:rules,storage:rules

# 특정 Function만 배포
firebase deploy --only functions:generateStoryboard,functions:addComment
```

### 배포 확인

```bash
# 배포된 Functions 목록
firebase functions:list

# Functions 로그 확인
firebase functions:log

# 실시간 로그 스트리밍
firebase functions:log --follow
```

---

## API 엔드포인트 (Cloud Functions)

모든 함수는 `httpsCallable`로 호출합니다.

| 함수명 | 설명 | 입력 |
|--------|------|------|
| `generateStoryboard` | 일기 → 스토리보드 | `{ episodeId, diaryText, panelCount?, characterSheetText, refImagePaths? }` |
| `generatePanelImages` | 패널 이미지 일괄 생성 | `{ episodeId, aspectRatio?, refImagePaths?, indices? }` |
| `publishToon` | 에피소드 게시 | `{ episodeId }` |
| `addComment` | 댓글 추가 | `{ episodeId, emoji, text, anonId }` |

---

## 보안

### 보안 체크리스트

배포 전 반드시 확인하세요:

- [ ] **API 키 보호**
  - [ ] `GEMINI_API_KEY`가 Secret Manager에만 저장됨
  - [ ] `.env.local`이 `.gitignore`에 포함됨
  - [ ] 클라이언트 코드에 API 키 노출 없음

- [ ] **App Check 설정** ([상세 가이드](./docs/APP_CHECK_SETUP.md))
  - [ ] reCAPTCHA v3 사이트 등록 완료
  - [ ] `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` 환경 변수 설정
  - [ ] Functions에서 `enforceAppCheck: true` 설정
  - [ ] Firebase Console에서 App Check Enforcement 활성화

- [ ] **Firestore Rules 검증**
  - [ ] 읽기/쓰기 권한이 적절히 제한됨
  - [ ] `firebase emulators:exec` 또는 Rules Playground로 테스트

- [ ] **Storage Rules 검증**
  - [ ] 업로드 파일 크기 제한 설정
  - [ ] 허용된 MIME 타입만 업로드 가능
  - [ ] 인증된 사용자만 업로드 가능

### 현재 적용된 보안 기능

| 기능 | 설명 | 적용 대상 |
|------|------|----------|
| **App Check** | reCAPTCHA v3 기반 봇 방지 | `addComment` |
| **Rate Limiting** | anonId 기반 요청 제한 (1분 3회, 1일 30회) | `addComment` |
| **모더레이션** | 금칙어, URL, 반복문자 탐지 → flagged 처리 | `addComment` |
| **Secret Manager** | API 키 암호화 저장, Functions에서만 접근 | Gemini API |
| **Auth 필수** | 로그인 사용자만 접근 가능 | `generateStoryboard`, `generatePanelImages`, `publishToon` |

### .gitignore 필수 항목

```gitignore
# 환경 변수 (절대 커밋 금지)
.env
.env.local
.env.*.local

# Firebase
.firebase/
*-debug.log
firebase-debug.log

# 에뮬레이터 데이터
emulator-data/

# Secret
*.pem
*.key
secrets/
```

---

## 캐릭터 설정

MVP에서는 사용자가 캐릭터 설명을 직접 입력합니다.

**입력 예시:**
```
20대 중반 여성, 어깨 길이의 갈색 웨이브 머리, 큰 갈색 눈, 밝은 피부
평소 캐주얼한 옷차림을 좋아하며, 오늘은 크림색 후드티와 청바지를 입고 있음
귀엽고 동글동글한 얼굴형, 표정이 풍부하고 감정 표현이 큼
```

---

## 트러블슈팅

### 에뮬레이터가 시작되지 않음

```bash
# 포트 충돌 확인
lsof -i :8080  # Firestore
lsof -i :5001  # Functions

# Java 설치 확인 (Firestore 에뮬레이터 필요)
java -version
```

### Functions 배포 실패 (Secret 관련)

```bash
# Secret 상태 확인
firebase functions:secrets:access GEMINI_API_KEY

# Secret 재설정
firebase functions:secrets:set GEMINI_API_KEY
```

### App Check 오류

- 브라우저 콘솔에서 Debug Token 확인
- Firebase Console > App Check > Debug tokens에 등록
- 상세 가이드: [docs/APP_CHECK_SETUP.md](./docs/APP_CHECK_SETUP.md)

---

## 2단계 확장 계획

MVP 이후 추가 예정:

- [ ] 캐릭터 커스터마이징 (저장/재사용)
- [ ] 패널 순서 변경 (드래그 앤 드롭)
- [ ] 이미지 프롬프트 미세 조정
- [ ] 공유 기능 (SNS, 링크)
- [ ] 좋아요 기능
- [ ] 관리자 대시보드
- [ ] 카카오 로그인 추가

---

## 라이선스

MIT License
