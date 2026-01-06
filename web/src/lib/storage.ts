import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';
import { StoragePaths } from '@/types';

/**
 * 레퍼런스 이미지 업로드
 */
export async function uploadReferenceImage(
  episodeId: string,
  file: File,
  index: number
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const filename = `ref_${index}.${ext}`;
  const path = StoragePaths.episodeRef(episodeId, filename);
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
  episodeId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const path = await uploadReferenceImage(episodeId, files[i], i);
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
