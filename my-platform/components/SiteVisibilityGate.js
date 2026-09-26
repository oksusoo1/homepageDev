import SiteGateScreen from '@/components/SiteGateScreen'

/** 호환용. 판단은 서버 getVisitorAccess. 본문 children을 감싸지 않는다. */
export default function SiteVisibilityGate({ visibility, siteCode, cancelled }) {
  return <SiteGateScreen visibility={visibility} siteCode={siteCode} cancelled={cancelled} />
}
