import 'server-only'
import { USE_FLAG_OFF, USE_FLAG_ON } from '@/lib/use-flag'

const WITH_UPDATED = [
  'customers', 'staff', 'sites', 'inquiries', 'subscriptions',
  'support_tickets', 'user_boards', 'user_posts', 'user_comments',
]

export async function softDelete(db, table, idColumn, id) {
  const patch = { use_flag: USE_FLAG_OFF }
  if (WITH_UPDATED.includes(table)) patch.updated_at = new Date().toISOString()
  const { error } = await db.from(table).update(patch).eq(idColumn, id)
  if (error) throw error
}

export async function softRestore(db, table, idColumn, id) {
  const patch = { use_flag: USE_FLAG_ON }
  if (WITH_UPDATED.includes(table)) patch.updated_at = new Date().toISOString()
  const { error } = await db.from(table).update(patch).eq(idColumn, id)
  if (error) throw error
}
