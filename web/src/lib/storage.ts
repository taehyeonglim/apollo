import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  FirebaseStorage,
} from 'firebase/storage';
import { initializeFirebase } from './firebase';
import { StoragePaths } from '@/types';

// Storage 인스턴스를 lazy하게 가져오기
function getStorageInstance(): FirebaseStorage {
  return initializeFirebase().storage;
}

// 타임아웃 유틸리티
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * 레퍼런스 이미지를 temp 경로에 업로드
 * Storage Rules: temp/{userId}/ 경로만 클라이언트 업로드 허용
 */
export async function uploadReferenceImage(
  userId: string,
  episodeId: string,
  file: File,
  index: number
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const filename = `${episodeId}_ref_${index}.${ext}`;
  const path = StoragePaths.tempUpload(userId, filename);
  const storageRef = ref(getStorageInstance(), path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  return path;
}

/**
 * 여러 레퍼런스 이미지 업로드
 */
export async function uploadReferenceImages(
  userId: string,
  episodeId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const path = await uploadReferenceImage(userId, episodeId, files[i], i);
    paths.push(path);
  }

  return paths;
}

/**
 * Storage 경로에서 공개 URL 가져오기
 */
export async function getPublicUrl(path: string): Promise<string> {
  const storageRef = ref(getStorageInstance(), path);
  return getDownloadURL(storageRef);
}

/**
 * Storage 경로에서 파일 삭제
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(getStorageInstance(), path);
  await deleteObject(storageRef);
}

/**
 * 패널 이미지 URL 가져오기
 */
export async function getPanelImageUrl(
  episodeId: string,
  panelIndex: number
): Promise<string> {
  const path = StoragePaths.episodePanel(episodeId, panelIndex);
  return getPublicUrl(path);
}

/**
 * 썸네일 URL 가져오기
 */
export async function getThumbnailUrl(episodeId: string): Promise<string> {
  const path = StoragePaths.episodeThumb(episodeId);
  return getPublicUrl(path);
}

// ==========================================
// 라이브러리 관련 함수
// ==========================================

/**
 * 라이브러리에 이미지 업로드
 */
export async function uploadLibraryImage(
  userId: string,
  file: File
): Promise<string> {
  console.log('[Storage] uploadLibraryImage started', { userId, fileName: file.name });

  try {
    const { storage, auth } = initializeFirebase();
    console.log('[Storage] Got storage instance');
    console.log('[Storage] Current auth user:', auth.currentUser?.email || 'null');

    if (!auth.currentUser) {
      throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
    }

    // Auth 토큰 갱신 (강제)
    try {
      const token = await auth.currentUser.getIdToken(true);
      console.log('[Storage] Auth token refreshed, length:', token.length);
    } catch (tokenError) {
      console.error('[Storage] Token refresh error:', tokenError);
    }

    const ext = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}_${randomStr}.${ext}`;
    const path = StoragePaths.libraryImage(userId, filename);

    console.log('[Storage] Uploading to path:', path);
    console.log('[Storage] Storage bucket:', storage.app.options.storageBucket);
    const storageRef = ref(storage, path);

    // uploadBytesResumable 사용하여 상세 오류 확인
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('[Storage] Upload progress:', progress.toFixed(1) + '%');
        },
        (error) => {
          console.error('[Storage] Upload error code:', error.code);
          console.error('[Storage] Upload error message:', error.message);
          console.error('[Storage] Upload error serverResponse:', error.serverResponse);
          reject(error);
        },
        () => {
          console.log('[Storage] Upload complete');
          resolve();
        }
      );

      // 30초 타임아웃
      setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('업로드 시간 초과 (30초). 네트워크 상태를 확인해주세요.'));
      }, 30000);
    });

    console.log('[Storage] Upload complete:', path);
    return path;
  } catch (error) {
    console.error('[Storage] Upload error:', error);
    throw error;
  }
}

/**
 * 라이브러리 이미지 URL 가져오기
 */
export async function getLibraryImageUrl(storagePath: string): Promise<string> {
  return getPublicUrl(storagePath);
}

/**
 * 라이브러리 이미지 삭제
 */
export async function deleteLibraryImage(storagePath: string): Promise<void> {
  await deleteFile(storagePath);
}
