import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  DocumentSnapshot,
  Timestamp,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { initializeFirebase } from './firebase';
import type { Episode, EpisodeStatus, Comment, PanelPrompt, LibraryImage } from '@/types';
import { deleteLibraryImage } from './storage';

// Firestore 인스턴스를 lazy하게 가져오기
function getDb(): Firestore {
  return initializeFirebase().db;
}

// Firestore 컬렉션 참조 (lazy)
function getEpisodesRef() {
  return collection(getDb(), 'episodes');
}

/**
 * Firestore Timestamp을 Date로 변환
 */
function toDate(timestamp: Timestamp | Date | undefined): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
}

// ==========================================
// Episode 관련 함수
// ==========================================

/**
 * 에피소드 가져오기
 */
export async function getEpisode(id: string): Promise<Episode | null> {
  const docRef = doc(getEpisodesRef(), id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
    finalPrompt: data.finalPrompt
      ? {
          ...data.finalPrompt,
          generatedAt: toDate(data.finalPrompt.generatedAt),
        }
      : undefined,
  } as Episode;
}

/**
 * 공개된 에피소드 목록 (페이지네이션)
 */
export async function getPublishedEpisodes(
  pageSize: number = 12,
  lastDoc?: DocumentSnapshot
): Promise<{ episodes: Episode[]; lastDoc: DocumentSnapshot | null }> {
  let q = query(
    getEpisodesRef(),
    where('status', '==', 'published' as EpisodeStatus),
    orderBy('publishedAt', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const episodes = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
    } as Episode;
  });

  const last = snapshot.docs[snapshot.docs.length - 1] || null;
  return { episodes, lastDoc: last };
}

/**
 * 사용자의 에피소드 목록
 */
export async function getUserEpisodes(userId: string): Promise<Episode[]> {
  const q = query(
    getEpisodesRef(),
    where('creatorUid', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
    } as Episode;
  });
}

/**
 * 에피소드 실시간 구독
 */
export function subscribeToEpisode(
  id: string,
  callback: (episode: Episode | null) => void
): () => void {
  const docRef = doc(getEpisodesRef(), id);

  return onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }

    const data = docSnap.data();
    callback({
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
      finalPrompt: data.finalPrompt
        ? {
            ...data.finalPrompt,
            generatedAt: toDate(data.finalPrompt.generatedAt),
          }
        : undefined,
    } as Episode);
  });
}

/**
 * 새 에피소드 생성 (클라이언트에서 ID 생성)
 */
export async function createEpisode(
  episodeId: string,
  userId: string,
  initialData?: Partial<Episode>
): Promise<string> {
  const docRef = doc(getEpisodesRef(), episodeId);

  await setDoc(docRef, {
    status: 'draft' as EpisodeStatus,
    title: '',
    diaryText: '',
    panelCount: 4,
    panels: [],
    creatorUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...initialData,
  });

  return episodeId;
}

/**
 * 에피소드 캡션 업데이트 (로컬 수정)
 */
export async function updateEpisodeCaptions(
  episodeId: string,
  panelCaptions: { index: number; caption: string }[]
): Promise<void> {
  const docRef = doc(getEpisodesRef(), episodeId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('에피소드를 찾을 수 없습니다.');
  }

  const data = docSnap.data();
  const finalPrompt = data.finalPrompt;

  if (!finalPrompt) {
    throw new Error('스토리보드가 없습니다.');
  }

  // finalPrompt.panels의 captionDraft 업데이트
  const updatedPanels = finalPrompt.panels.map((panel: PanelPrompt) => {
    const caption = panelCaptions.find((c) => c.index === panel.index);
    return caption
      ? { ...panel, captionDraft: caption.caption }
      : panel;
  });

  // panels 배열의 caption 업데이트 (이미지 생성된 패널)
  const updatedGeneratedPanels = (data.panels || []).map((panel: { index: number; caption: string; imagePath: string }) => {
    const caption = panelCaptions.find((c) => c.index === panel.index);
    return caption
      ? { ...panel, caption: caption.caption }
      : panel;
  });

  await updateDoc(docRef, {
    'finalPrompt.panels': updatedPanels,
    panels: updatedGeneratedPanels,
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// Comment 관련 함수
// ==========================================

/**
 * 댓글 목록 가져오기
 */
export async function getComments(
  episodeId: string,
  pageSize: number = 50
): Promise<Comment[]> {
  const commentsRef = collection(getDb(), 'episodes', episodeId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(pageSize));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Comment;
  });
}

/**
 * 댓글 실시간 구독
 */
export function subscribeToComments(
  episodeId: string,
  callback: (comments: Comment[]) => void
): () => void {
  const commentsRef = collection(getDb(), 'episodes', episodeId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: toDate(data.createdAt),
      } as Comment;
    });
    callback(comments);
  });
}

// ==========================================
// Library 관련 함수
// ==========================================

/**
 * 라이브러리 컬렉션 참조 생성
 */
function getLibraryRef(userId: string) {
  return collection(getDb(), 'users', userId, 'library');
}

/**
 * 라이브러리 이미지 추가
 */
export async function addLibraryImage(
  userId: string,
  storagePath: string,
  name: string
): Promise<string> {
  console.log('[Firestore] addLibraryImage started', { userId, storagePath, name });

  try {
    const libraryRef = getLibraryRef(userId);
    const newDocRef = doc(libraryRef);

    await setDoc(newDocRef, {
      name,
      storagePath,
      createdAt: serverTimestamp(),
    });

    console.log('[Firestore] addLibraryImage complete, id:', newDocRef.id);
    return newDocRef.id;
  } catch (error) {
    console.error('[Firestore] addLibraryImage error:', error);
    throw error;
  }
}

/**
 * 라이브러리 이미지 목록 가져오기
 */
export async function getLibraryImages(userId: string): Promise<LibraryImage[]> {
  const libraryRef = getLibraryRef(userId);
  const q = query(libraryRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
    } as LibraryImage;
  });
}

/**
 * 라이브러리 이미지 실시간 구독
 */
export function subscribeToLibraryImages(
  userId: string,
  callback: (images: LibraryImage[]) => void
): () => void {
  const libraryRef = getLibraryRef(userId);
  const q = query(libraryRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const images = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: toDate(data.createdAt),
        updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
      } as LibraryImage;
    });
    callback(images);
  });
}

/**
 * 라이브러리 이미지 이름 수정
 */
export async function updateLibraryImageName(
  userId: string,
  imageId: string,
  newName: string
): Promise<void> {
  const docRef = doc(getDb(), 'users', userId, 'library', imageId);
  await updateDoc(docRef, {
    name: newName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 라이브러리 이미지 삭제 (Storage + Firestore)
 */
export async function removeLibraryImage(
  userId: string,
  imageId: string,
  storagePath: string
): Promise<void> {
  // Storage에서 이미지 삭제
  await deleteLibraryImage(storagePath);

  // Firestore에서 문서 삭제
  const docRef = doc(getDb(), 'users', userId, 'library', imageId);
  await deleteDoc(docRef);
}
