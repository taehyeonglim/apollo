import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';
import { StoragePaths } from '@/types';

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
  const storageRef = ref(storage, path);

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
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

/**
 * Storage 경로에서 파일 삭제
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
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
  const ext = file.name.split('.').pop() || 'png';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `${timestamp}_${randomStr}.${ext}`;
  const path = StoragePaths.libraryImage(userId, filename);
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  return path;
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
