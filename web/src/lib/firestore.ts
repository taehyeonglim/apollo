import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Toon, Draft, Comment, Character, ToonStatus } from '@/types';

// Firestore 컬렉션 참조
const toonsRef = collection(db, 'toons');
const draftsRef = collection(db, 'drafts');
const charactersRef = collection(db, 'characters');

/**
 * Firestore Timestamp을 Date로 변환
 */
function toDate(timestamp: Timestamp | Date | undefined): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
}

/**
 * 툰 관련 함수
 */
export async function getToon(id: string): Promise<Toon | null> {
  const docRef = doc(toonsRef, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
  } as Toon;
}

export async function getPublishedToons(
  pageSize: number = 12,
  lastDoc?: DocumentSnapshot
): Promise<{ toons: Toon[]; lastDoc: DocumentSnapshot | null }> {
  let q = query(
    toonsRef,
    where('status', '==', 'published' as ToonStatus),
    orderBy('publishedAt', 'desc'),
    limit(pageSize)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const toons = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
    } as Toon;
  });

  const last = snapshot.docs[snapshot.docs.length - 1] || null;
  return { toons, lastDoc: last };
}

/**
 * 드래프트 관련 함수
 */
export async function getDraft(id: string): Promise<Draft | null> {
  const docRef = doc(draftsRef, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as Draft;
}

// 드래프트 실시간 구독
export function subscribeToDraft(
  id: string,
  callback: (draft: Draft | null) => void
): () => void {
  const docRef = doc(draftsRef, id);

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
    } as Draft);
  });
}

/**
 * 댓글 관련 함수
 */
export async function getComments(
  toonId: string,
  pageSize: number = 50
): Promise<Comment[]> {
  const commentsRef = collection(db, 'toons', toonId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(pageSize));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      toonId,
      ...data,
      createdAt: toDate(data.createdAt),
    } as Comment;
  });
}

// 댓글 실시간 구독
export function subscribeToComments(
  toonId: string,
  callback: (comments: Comment[]) => void
): () => void {
  const commentsRef = collection(db, 'toons', toonId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        toonId,
        ...data,
        createdAt: toDate(data.createdAt),
      } as Comment;
    });
    callback(comments);
  });
}

/**
 * 캐릭터 관련 함수
 */
export async function getCharacter(id: string): Promise<Character | null> {
  const docRef = doc(charactersRef, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Character;
}

export async function getAllCharacters(): Promise<Character[]> {
  const snapshot = await getDocs(charactersRef);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Character));
}
