'use client'

/**
 * 공통 모달 컴포넌트
 * 배포 완료, 확인 등에서 공통 사용
 */
export default function Modal({ open, onClose, children }) {
  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '40px 36px',
          maxWidth: 420,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
