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
│   │   ├── generatePanelImage.ts # 스토리보드 → 이미지
│   │   ├── publishToon.ts        # 툰 게시
│   │   ├── addComment.ts         # 댓글 추가
│   │   └── utils/                # 유틸리티
│   └── package.json
├── firebase.json
├── firestore.rules
├── storage.rules
└── README.md
```

## 로컬 개발 환경 설정

### 1. 사전 요구사항

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase 프로젝트 (Blaze 요금제 - Functions 사용 시 필요)

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

**Web (.env.local)**
```bash
cd web
cp .env.local.example .env.local
# .env.local 파일 편집 - Firebase 콘솔에서 설정값 복사
```

**Functions (Secret Manager)**
```bash
# Gemini API 키를 Secret Manager에 등록
firebase functions:secrets:set GEMINI_API_KEY
# 프롬프트에서 API 키 입력
```

### 4. 의존성 설치

```bash
# 루트에서 전체 설치
npm install --prefix web
npm install --prefix functions
```

### 5. 에뮬레이터 실행

```bash
# Functions 빌드
npm run build --prefix functions

# 에뮬레이터 시작 (Firestore, Functions, Storage, Hosting)
firebase emulators:start
```

에뮬레이터 UI: http://localhost:4000

### 6. 프론트엔드 개발 서버

```bash
cd web
npm run dev
```

개발 서버: http://localhost:3000

## 캐릭터 설정

MVP에서는 기본 캐릭터를 사용합니다. Firestore에 캐릭터 문서를 추가해야 합니다.

**Firestore Console 또는 에뮬레이터에서 추가:**

컬렉션: `characters`
문서 ID: `default`

```json
{
  "name": "뽀미",
  "description": "20대 여성 캐릭터. 귀엽고 친근한 인상. 큰 눈과 동그란 얼굴이 특징. 일상의 소소한 감정을 풍부하게 표현.",
  "referenceImageUrls": [],
  "defaultStyle": "cute cartoon webtoon style, soft colors, expressive emotions",
  "traits": {
    "age": "early 20s",
    "gender": "female",
    "hairStyle": "shoulder-length bob with slight wave",
    "hairColor": "dark brown",
    "eyeColor": "dark brown, big round eyes",
    "skinTone": "fair, warm undertone",
    "height": "average",
    "bodyType": "slim",
    "clothing": "casual comfortable clothes, often hoodie or t-shirt",
    "accessories": ["round glasses (sometimes)"],
    "distinctiveFeatures": ["big expressive eyes", "small nose", "round face", "cute expressions"]
  }
}
```

## 배포

### 1. Functions 배포

```bash
# Secret Manager에 API 키 등록 (아직 안 했다면)
firebase functions:secrets:set GEMINI_API_KEY

# Functions 배포
firebase deploy --only functions
```

### 2. Firestore/Storage Rules 배포

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 3. 전체 배포 (Hosting 포함)

```bash
# Web 빌드
npm run build --prefix web

# 전체 배포
firebase deploy
```

## API 엔드포인트 (Cloud Functions)

모든 함수는 `httpsCallable`로 호출합니다.

| 함수명 | 설명 | 입력 |
|--------|------|------|
| `generateStoryboard` | 일기 → 스토리보드 | `{ diary, characterId, panelCount? }` |
| `generatePanelImage` | 패널 이미지 생성 | `{ draftId, panelIndex, regenerate? }` |
| `publishToon` | 드래프트를 갤러리에 게시 | `{ draftId }` |
| `addComment` | 댓글 추가 | `{ toonId, emoji, text }` |

## 보안 및 제한

- **Rate Limiting**: IP 기반 요청 제한 (분당 5-20회)
- **욕설 필터**: 금지어 목록 기반 필터링
- **댓글 제한**: 이모지 필수, 80자 이내 코멘트
- **API 키 보호**: Secret Manager 사용, Functions에서만 접근
- **App Check**: 프로덕션에서 활성화 권장

## 2단계 확장 계획

MVP 이후 추가 예정:

- [ ] 사용자 인증 (Google/카카오 로그인)
- [ ] 캐릭터 커스터마이징
- [ ] 패널 순서 변경 (드래그 앤 드롭)
- [ ] 캡션 직접 편집
- [ ] 이미지 프롬프트 미세 조정
- [ ] 공유 기능 (SNS, 링크)
- [ ] 좋아요 기능
- [ ] 관리자 대시보드

## 라이선스

MIT License
