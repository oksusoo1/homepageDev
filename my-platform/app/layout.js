export const metadata = {
  title: 'My Platform',
  description: '노코드 웹빌더 플랫폼',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
