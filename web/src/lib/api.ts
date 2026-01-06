import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type {
  GenerateStoryboardRequest,
  GenerateStoryboardResponse,
  GeneratePanelRequest,
  GeneratePanelResponse,
  PublishToonRequest,
  PublishToonResponse,
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

// 패널 이미지 생성
export async function generatePanel(
  request: GeneratePanelRequest
): Promise<GeneratePanelResponse> {
  const fn = httpsCallable<GeneratePanelRequest, GeneratePanelResponse>(
    functions,
    'generatePanelImage'
  );
  const result = await fn(request);
  return result.data;
}

// 모든 패널 이미지 일괄 생성
export async function generateAllPanels(
  draftId: string,
  panelCount: number
): Promise<GeneratePanelResponse[]> {
  const results: GeneratePanelResponse[] = [];

  // 순차적으로 생성 (API 부하 분산)
  for (let i = 0; i < panelCount; i++) {
    const result = await generatePanel({
      draftId,
      panelIndex: i,
    });
    results.push(result);
  }

  return results;
}

// 툰 게시
export async function publishToon(
  request: PublishToonRequest
): Promise<PublishToonResponse> {
  const fn = httpsCallable<PublishToonRequest, PublishToonResponse>(
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
