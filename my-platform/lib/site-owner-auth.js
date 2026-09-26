/**
 * 글쓰기 권한 판단은 서버 write/page.js + createPublicPostAction.
 * 브라우저에서 staff/customers를 조회하지 않는다.
 */

export const WRITE_DENY_COPY = {
  login: {
    title: '로그인이 필요합니다',
    body: '게시글은 이 사이트의 소유 고객(운영자)만 작성할 수 있습니다.',
  },
  staff: {
    title: '고객만 작성할 수 있습니다',
    body: '본사(staff)는 사이트 열람만 가능합니다. 글쓰기는 사이트 소유 고객 계정으로 로그인해 주세요.',
  },
  other_customer: {
    title: '이 사이트의 운영자만 작성할 수 있습니다',
    body: '다른 고객 계정으로는 글을 쓸 수 없습니다.',
  },
}
