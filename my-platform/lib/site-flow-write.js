import 'server-only'
import { isSiteFlowStep } from '@/lib/site-flow'

export async function setSiteFlow(db, siteId, flowStep, extra = {}) {
  if (!isSiteFlowStep(flowStep)) {
    throw new Error(`잘못된 FLOW_STEP: ${flowStep}`)
  }
  const { error } = await db
    .from('sites')
    .update({
      status: flowStep,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq('site_id', siteId)
    .eq('use_flag', 1)
  if (error) throw new Error(error.message)
}
