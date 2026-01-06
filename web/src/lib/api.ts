import { httpsCallable, Functions } from 'firebase/functions';
import { initializeFirebase } from './firebase';
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

// Functions 인스턴스를 lazy하게 가져오기
function getFunctions(): Functions {
  return initializeFirebase().functions;
}

/**
 * Cloud Functions 호출 래퍼
 */

// 스토리보드 생성 (일기 → JSON 스토리보드)
export async function generateStoryboard(
  request: GenerateStoryboardRequest
): Promise<GenerateStoryboardResponse> {
  const fn = httpsCallable<GenerateStoryboardRequest, GenerateStoryboardResponse>(
    getFunctions(),
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
    getFunctions(),
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
    getFunctions(),
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
    getFunctions(),
    'addComment'
  );
  const result = await fn(request);
  return result.data;
}
