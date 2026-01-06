// ==========================================
// A.P.O.L.L.O. Firestore 스키마 타입 정의
// ==========================================

/**
 * Episode 상태
 */
export type EpisodeStatus = 'draft' | 'published';

/**
 * 패널 정보 (Firestore 저장용)
 */
export interface Panel {
  index: number;
  imagePath: string; // Storage 경로: episodes/{episodeId}/panels/{index}.png
  caption: string;
}

/**
 * 패널별 프롬프트 (finalPrompt 내부)
 */
export interface PanelPrompt {
  index: number;
  scene: string;
  imagePrompt: string; // 이미지 생성에 사용된 최종 프롬프트 (영문)
  caption: string;
  emotion: string;
  composition: string;
}

/**
 * 전역 스타일 정보 (finalPrompt 내부)
 */
export interface GlobalStyle {
  artStyle: string;
  colorPalette: string;
  mood: string;
  characterDescription: string; // 캐릭터 텍스트 시트
}

/**
 * 최종 프롬프트 (중간 프롬프트는 저장 안 함)
 */
export interface FinalPrompt {
  title: string;
  summary: string;
  globalStyle: GlobalStyle;
  panels: PanelPrompt[];
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
  finalPrompt: FinalPrompt; // 최종 버전만 저장
  panelCount: number;
  panels: Panel[];
  thumbPath?: string; // Storage 경로: episodes/{episodeId}/thumb.png
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  creatorUid: string; // Firebase Auth UID
}

/**
 * Episode 생성 시 입력 (클라이언트 → Functions)
 */
export interface CreateEpisodeInput {
  diaryText: string;
  panelCount?: number; // 기본 4
  characterId?: string; // 캐릭터 선택 (기본 'default')
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
 * Comment 생성 시 입력 (클라이언트 → Functions)
 */
export interface CreateCommentInput {
  episodeId: string;
  emoji: string;
  text: string;
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
  diaryText: string;
  characterId?: string;
  panelCount?: number;
}

export interface GenerateStoryboardResponse {
  success: boolean;
  episodeId?: string;
  finalPrompt?: FinalPrompt;
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
}

export interface AddCommentResponse {
  success: boolean;
  commentId?: string;
  error?: string;
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
