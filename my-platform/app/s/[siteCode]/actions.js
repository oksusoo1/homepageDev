'use server'

import { createPublicPostAction as runCreatePublicPost } from '@/app/s/[siteCode]/board/write-actions'

/** 방문자 게시판 쓰기 (FormData 또는 기존 인자) */
export async function createPublicPostAction(a, b, c) {
  return runCreatePublicPost(a, b, c)
}
