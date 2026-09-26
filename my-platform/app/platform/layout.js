import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/guard'

export default async function PlatformLayout({ children }) {
  const gate = await requireStaff()
  if (!gate.ok) redirect('/login')
  return children
}
