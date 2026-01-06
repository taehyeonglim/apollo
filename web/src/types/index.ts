// ==========================================
// A.P.O.L.L.O. 타입 정의
// ==========================================

/**
 * 패널 이미지 정보
 */
export interface Panel {
  id: string;
  order: number;
  imageUrl: string;
  caption: string;
  prompt: string; // 이미지 생성에 사용된 최종 프롬프트
  generatedAt: Date;
}

/**
 * 스토리보드 (텍스트모델 결과)
 */
export interface Storyboard {
  title: string;
  summary: string;
  panels: PanelSpec[];
  style: StyleSpec;
}

export interface PanelSpec {
  order: number;
  scene: string;
  caption: string;
  imagePrompt: string;
  emotion: string;
  composition: string;
}

export interface StyleSpec {
  artStyle: string;
  colorPalette: string;
  mood: string;
}

/**
 * 툰 상태
 */
export type ToonStatus = 'draft' | 'generating' | 'ready' | 'published';

/**
 * 툰 문서 (Firestore)
 */
export interface Toon {
  id: string;
  title: string;
  originalDiary: string; // 원본 일기 텍스트
  storyboard: Storyboard; // 최종 스토리보드
  panels: Panel[];
  status: ToonStatus;
  characterId: string; // 사용된 캐릭터 ID
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  viewCount: number;
  commentCount: number;
}

/**
 * 드래프트 (편집중인 툰)
 */
export interface Draft {
  id: string;
  originalDiary: string;
  storyboard?: Storyboard;
  panels: Panel[];
  characterId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 캐릭터 시트
 */
export interface Character {
  id: string;
  name: string;
  description: string; // 디테일한 텍스트 설명
  referenceImageUrls: string[]; // 레퍼런스 이미지들
  defaultStyle: string; // 기본 그림체
  traits: CharacterTraits;
}

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
 * 댓글 (이모지 + 짧은 코멘트)
 */
export interface Comment {
  id: string;
  toonId: string;
  emoji: string; // 단일 이모지
  text: string; // 최대 80자
  createdAt: Date;
  ipHash?: string; // rate limit용 (저장하지 않음)
}

/**
 * API 요청/응답 타입
 */
export interface GenerateStoryboardRequest {
  diary: string;
  characterId: string;
  panelCount?: number; // 기본 4
}

export interface GenerateStoryboardResponse {
  success: boolean;
  draftId: string;
  storyboard: Storyboard;
  error?: string;
}

export interface GeneratePanelRequest {
  draftId: string;
  panelIndex: number;
  regenerate?: boolean;
}

export interface GeneratePanelResponse {
  success: boolean;
  panel: Panel;
  error?: string;
}

export interface PublishToonRequest {
  draftId: string;
}

export interface PublishToonResponse {
  success: boolean;
  toonId: string;
  error?: string;
}

export interface AddCommentRequest {
  toonId: string;
  emoji: string;
  text: string;
}

export interface AddCommentResponse {
  success: boolean;
  commentId?: string;
  error?: string;
}

/**
 * 허용된 이모지 목록
 */
export const ALLOWED_EMOJIS = [
  '😀', '😂', '🥹', '😍', '🥰',
  '😢', '😭', '😱', '🤯', '🤔',
  '👍', '👎', '❤️', '🔥', '✨',
  '👏', '🙌', '💯', '🎉', '😎',
] as const;

export type AllowedEmoji = typeof ALLOWED_EMOJIS[number];
