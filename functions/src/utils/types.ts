// ==========================================
// A.P.O.L.L.O. Functions 타입 정의
// ==========================================

import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Episode 상태
 */
export type EpisodeStatus = 'draft' | 'published';

/**
 * 패널 정보 (Firestore 저장용 - 이미지 생성 후)
 */
export interface Panel {
  index: number;
  imagePath: string; // Storage 경로
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
  characterSheetDigest: string;  // 캐릭터 시트 해시 (변경 추적용)
  generatedAt: Timestamp;
}

/**
 * Episode 문서 (Firestore)
 */
export interface Episode {
  status: EpisodeStatus;
  title: string;
  diaryText: string;
  finalPrompt?: FinalPrompt;  // optional until generated
  panelCount: number;
  panels: Panel[];
  thumbPath?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  creatorUid: string;
}

/**
 * Episode 문서 (ID 포함)
 */
export interface EpisodeWithId extends Episode {
  id: string;
}

/**
 * Comment Moderation 정보
 */
export interface CommentModeration {
  flagged: boolean;
  reason?: string;
}

/**
 * Comment 문서 (Firestore)
 */
export interface Comment {
  emoji: string;
  text: string;
  createdAt: Timestamp;
  anonIdHash: string;
  moderation: CommentModeration;
}

/**
 * Comment 문서 (ID 포함)
 */
export interface CommentWithId extends Comment {
  id: string;
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
 * Character 문서 (Firestore)
 */
export interface Character {
  id: string;
  name: string;
  description: string;
  referenceImagePaths: string[];
  defaultStyle: string;
  traits: CharacterTraits;
}

// ==========================================
// Storage 경로 헬퍼
// ==========================================

export const StoragePaths = {
  episodeRef: (episodeId: string, filename: string) =>
    `episodes/${episodeId}/refs/${filename}`,

  episodePanel: (episodeId: string, index: number) =>
    `episodes/${episodeId}/panels/${index}.png`,

  episodeThumb: (episodeId: string) =>
    `episodes/${episodeId}/thumb.png`,
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
// API 요청 타입
// ==========================================

export interface GenerateStoryboardRequest {
  episodeId: string;
  diaryText: string;
  panelCount?: number;         // 기본 4, 2~10 범위
  characterSheetText: string;  // 캐릭터 시트 상세 텍스트
  refImagePaths?: string[];    // Storage 경로 배열 (레퍼런스 이미지)
}

export interface GeneratePanelImageRequest {
  episodeId: string;
  panelIndex: number;
  regenerate?: boolean;
}

export interface PublishEpisodeRequest {
  episodeId: string;
}

export interface AddCommentRequest {
  episodeId: string;
  emoji: string;
  text: string;
}
