// ==========================================
// A.P.O.L.L.O. Functions 타입 정의
// ==========================================

import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Episode 상태
 */
export type EpisodeStatus = 'draft' | 'published';

/**
 * 패널 정보 (Firestore 저장용)
 */
export interface Panel {
  index: number;
  imagePath: string; // Storage 경로
  caption: string;
}

/**
 * 패널별 프롬프트 (finalPrompt 내부)
 */
export interface PanelPrompt {
  index: number;
  scene: string;
  imagePrompt: string;
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
  characterDescription: string;
}

/**
 * 최종 프롬프트
 */
export interface FinalPrompt {
  title: string;
  summary: string;
  globalStyle: GlobalStyle;
  panels: PanelPrompt[];
  generatedAt: Timestamp;
}

/**
 * Episode 문서 (Firestore)
 */
export interface Episode {
  status: EpisodeStatus;
  title: string;
  diaryText: string;
  finalPrompt: FinalPrompt;
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
  diaryText: string;
  characterId?: string;
  panelCount?: number;
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
