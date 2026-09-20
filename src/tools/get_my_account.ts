import { z } from 'zod';
import { RedmineClient } from '../client/redmine.js';

export const getMyAccountSchema = z.object({
  include_memberships: z
    .boolean()
    .default(false)
    .describe('사용자가 속한 프로젝트 멤버십 목록 포함 여부 (기본값: false)'),
  include_groups: z
    .boolean()
    .default(false)
    .describe('사용자가 속한 그룹 목록 포함 여부 (기본값: false)'),
});

export type GetMyAccountArgs = z.infer<typeof getMyAccountSchema>;

export async function getMyAccountHandler(args: GetMyAccountArgs, client: RedmineClient) {
  try {
    const result = await client.getMyAccount({
      include_memberships: args.include_memberships,
      include_groups: args.include_groups,
    });
    return result;
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      return { error: '인증에 실패했습니다. 유효한 API Key를 확인하세요.' };
    }
    if (error.response && error.response.status === 404) {
      return { error: '내 계정 정보를 찾을 수 없습니다.' };
    }
    throw error;
  }
}
