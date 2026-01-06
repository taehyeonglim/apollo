import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type {
  GenerateStoryboardRequest,
  GenerateStoryboardResponse,
  GeneratePanelImagesRequest,
  GeneratePanelImagesResponse,
  PublishEpisodeRequest,
  PublishEpisodeResponse,
  AddCommentRequest,
  AddCommentResponse,
} from '@/types';

/**
 * Cloud Functions 호출 래퍼
 */

// 스토리보드 생성 (일기 → JSON 스토리보드)
export async function generateStoryboard(
  request: GenerateStoryboardRequest
): Promise<GenerateStoryboardResponse> {
  const fn = httpsCallable<GenerateStoryboardRequest, GenerateStoryboardResponse>(
    functions,
    'generateStoryboard'
  );
  const result = await fn(request);
  return result.data;
}

// 패널 이미지 일괄 생성
export async function generatePanelImages(
  request: GeneratePanelImagesRequest
): Promise<GeneratePanelImagesResponse> {
  const fn = httpsCallable<GeneratePanelImagesRequest, GeneratePanelImagesResponse>(
    functions,
    'generatePanelImages'
  );
  const result = await fn(request);
  return result.data;
}

// 에피소드 게시
export async function publishEpisode(
  request: PublishEpisodeRequest
): Promise<PublishEpisodeResponse> {
  const fn = httpsCallable<PublishEpisodeRequest, PublishEpisodeResponse>(
    functions,
    'publishToon'
  );
  const result = await fn(request);
  return result.data;
}

// 댓글 추가
export async function addComment(
  request: AddCommentRequest
): Promise<AddCommentResponse> {
  const fn = httpsCallable<AddCommentRequest, AddCommentResponse>(
    functions,
    'addComment'
  );
  const result = await fn(request);
  return result.data;
}
