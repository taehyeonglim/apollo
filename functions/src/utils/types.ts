// Functions에서 사용하는 타입 정의

export interface Panel {
  id: string;
  order: number;
  imageUrl: string;
  caption: string;
  prompt: string;
  generatedAt: FirebaseFirestore.Timestamp;
}

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

export interface Character {
  id: string;
  name: string;
  description: string;
  referenceImageUrls: string[];
  defaultStyle: string;
  traits: CharacterTraits;
}

export interface Draft {
  id: string;
  originalDiary: string;
  storyboard?: Storyboard;
  panels: Panel[];
  characterId: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface Toon {
  id: string;
  title: string;
  originalDiary: string;
  storyboard: Storyboard;
  panels: Panel[];
  status: 'draft' | 'generating' | 'ready' | 'published';
  characterId: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  publishedAt?: FirebaseFirestore.Timestamp;
  viewCount: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  emoji: string;
  text: string;
  createdAt: FirebaseFirestore.Timestamp;
}

// 허용된 이모지
export const ALLOWED_EMOJIS = [
  '😀', '😂', '🥹', '😍', '🥰',
  '😢', '😭', '😱', '🤯', '🤔',
  '👍', '👎', '❤️', '🔥', '✨',
  '👏', '🙌', '💯', '🎉', '😎',
];
