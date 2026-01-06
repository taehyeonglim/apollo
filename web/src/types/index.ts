// ==========================================
// A.P.O.L.L.O. Firestore 스키마 타입 정의
// ==========================================

/**
 * Episode 상태
 */
export type EpisodeStatus = 'draft' | 'published';

/**
 * 패널 정보 (Firestore 저장용 - 이미지 생성 후)
 */
export interface Panel {
  index: number;
  imagePath: string; // Storage 경로: episodes/{episodeId}/panels/{index}.png
  caption: string;
}

// ==========================================
// FinalPrompt 구조 (새 스키마)
// ==========================================

/**
 * 전역 스타일 설정
 */
export interface GlobalStyle {
  artStyle: string;           // 그림체 (예: "cute chibi webtoon style")
  colorPalette: string;       // 색상 팔레트 설명
  cameraRules: string;        // 카메라/구도 규칙
  typographyRules: string;    // 캡션 타이포그래피 규칙
  negatives: string;          // 네거티브 프롬프트 (피해야 할 것들)
}

/**
 * 패널별 프롬프트 (finalPrompt 내부)
 */
export interface PanelPrompt {
  index: number;
  scene: string;              // 장면 설명 (한국어)
  prompt: string;             // 이미지 생성 프롬프트 (영문, 캐릭터 묘사 포함)
  captionDraft: string;       // 캡션 초안 (한국어, 30자 이내)
}

/**
 * 최종 프롬프트 (Firestore에 저장되는 구조)
 */
export interface FinalPrompt {
  title: string;
  summary: string;
  global: GlobalStyle;
  panels: PanelPrompt[];
  characterSheetDigest?: string;  // 캐릭터 시트 해시 (변경 추적용)
  generatedAt: Date;
}

/**
 * Episode 문서 (Firestore: episodes/{episodeId})
 */
export interface Episode {
  id: string;
  status: EpisodeStatus;
  title: string;
  diaryText: string; // 원본 일기 텍스트
  finalPrompt?: FinalPrompt; // optional until generated
  panelCount: number;
  panels: Panel[];
  thumbPath?: string; // Storage 경로: episodes/{episodeId}/thumb.png
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  creatorUid: string; // Firebase Auth UID
}

/**
 * Comment Moderation 정보
 */
export interface CommentModeration {
  flagged: boolean;
  reason?: string;
}

/**
 * Comment 문서 (Firestore: episodes/{episodeId}/comments/{commentId})
 */
export interface Comment {
  id: string;
  emoji: string; // 이모지 1개
  text: string; // 최대 80자
  createdAt: Date;
  anonIdHash: string; // 익명 식별자 해시 (rate limit용)
  moderation: CommentModeration;
}

/**
 * 캐릭터 특성
 */
export interface CharacterTraits {
  age: string;
  gender: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  skinTone: string;
  height: string;
  bodyType: string;
  clothing: string;
  accessories: string[];
  distinctiveFeatures: string[];
}

/**
 * Character 문서 (Firestore: characters/{characterId})
 */
export interface Character {
  id: string;
  name: string;
  description: string; // 디테일한 텍스트 설명
  referenceImagePaths: string[]; // Storage 경로들
  defaultStyle: string;
  traits: CharacterTraits;
}

// ==========================================
// API 요청/응답 타입
// ==========================================

export interface GenerateStoryboardRequest {
  episodeId: string;
  diaryText: string;
  panelCount?: number;         // 기본 4, 2~10 범위
  characterSheetText: string;  // 캐릭터 시트 상세 텍스트
  refImagePaths?: string[];    // Storage 경로 배열 (레퍼런스 이미지)
}

export interface GenerateStoryboardResponse {
  success: boolean;
  episodeId?: string;
  finalPrompt?: Omit<FinalPrompt, 'generatedAt' | 'characterSheetDigest'>;
  remaining?: number;          // 남은 요청 횟수
  error?: string;
}

export interface GeneratePanelImageRequest {
  episodeId: string;
  panelIndex: number;
  regenerate?: boolean;
}

export interface GeneratePanelImageResponse {
  success: boolean;
  panel?: Panel;
  error?: string;
}

export type AspectRatio = '4:5' | '9:16' | '1:1';

export interface GeneratePanelImagesRequest {
  episodeId: string;
  aspectRatio?: AspectRatio;    // 기본 '4:5'
  refImagePaths?: string[];     // Storage 경로 배열 (캐릭터 레퍼런스)
  indices?: number[];           // 특정 패널만 생성/재생성할 때
}

export interface GeneratePanelImagesResponse {
  success: boolean;
  episodeId: string;
  generated: { index: number; imagePath: string }[];
  failed: number[];
  message: string;
}

export interface PublishEpisodeRequest {
  episodeId: string;
}

export interface PublishEpisodeResponse {
  success: boolean;
  error?: string;
}

export interface AddCommentRequest {
  episodeId: string;
  emoji: string;
  text: string;
  anonId: string;  // localStorage UUID
}

export interface AddCommentResponse {
  success: boolean;
  commentId?: string;
  flagged?: boolean;
  remainingMinute?: number;
  remainingDay?: number;
  error?: string;
}

// ==========================================
// 라이브러리 이미지 타입
// ==========================================

/**
 * LibraryImage 문서 (Firestore: users/{userId}/library/{imageId})
 */
export interface LibraryImage {
  id: string;
  name: string;              // 사용자가 지정한 이름 (예: "내 캐릭터")
  storagePath: string;       // Storage 경로
  thumbnailUrl?: string;     // 캐시된 썸네일 URL
  createdAt: Date;
  updatedAt?: Date;
}

// ==========================================
// Storage 경로 헬퍼
// ==========================================

export const StoragePaths = {
  /** 캐릭터 레퍼런스 이미지 */
  episodeRef: (episodeId: string, filename: string) =>
    `episodes/${episodeId}/refs/${filename}`,

  /** 패널 이미지 */
  episodePanel: (episodeId: string, index: number) =>
    `episodes/${episodeId}/panels/${index}.png`,

  /** 썸네일 */
  episodeThumb: (episodeId: string) =>
    `episodes/${episodeId}/thumb.png`,

  /** 임시 업로드 */
  tempUpload: (userId: string, filename: string) =>
    `temp/${userId}/${filename}`,

  /** 라이브러리 이미지 */
  libraryImage: (userId: string, filename: string) =>
    `library/${userId}/${filename}`,
} as const;

// ==========================================
// 허용된 이모지 목록
// ==========================================

export const ALLOWED_EMOJIS = [
  '😀', '😂', '🥹', '😍', '🥰',
  '😢', '😭', '😱', '🤯', '🤔',
  '👍', '👎', '❤️', '🔥', '✨',
  '👏', '🙌', '💯', '🎉', '😎',
] as const;

export type AllowedEmoji = typeof ALLOWED_EMOJIS[number];

// ==========================================
// 유틸리티 타입
// ==========================================

/** Firestore Timestamp을 Date로 변환한 타입 */
export type WithDates<T> = Omit<T, 'createdAt' | 'updatedAt' | 'publishedAt' | 'generatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  generatedAt?: Date;
};

/** 페이지네이션 응답 */
export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  lastId?: string;
}
