# 다른 PC에서 동일 환경 설정 순서

### 1. 사전 설치 (없으면 설치)
- **Node.js** — https://nodejs.org (LTS 버전)
- **Git** — https://git-scm.com

---

### 2. 프로젝트 받기
```bash
git clone <저장소 URL> c:\git_repo\homepageDev
```
또는 기존 PC에서 폴더 복사 (단, `node_modules`, `.next` 폴더는 제외해도 됨)

---

### 3. 패키지 설치
```bash
cd c:\git_repo\homepageDev\my-platform
npm install
```

---

### 4. 환경변수 파일 생성
`.env.local` 파일은 Git에 없으므로 기존 PC에서 직접 복사해야 함
```
c:\git_repo\homepageDev\my-platform\.env.local
```

---

### 5. PM2 설치 및 자동시작 등록
```bash
# PM2 전역 설치
npm install -g pm2

# 서버 시작 및 저장
cd c:\git_repo\homepageDev\my-platform
pm2 start ecosystem.config.js
pm2 save
```

시작 프로그램 등록 (PowerShell에서 실행):
```powershell
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PM2-MyPlatform.lnk")
$sc.TargetPath = "c:\git_repo\homepageDev\my-platform\pm2-startup.bat"
$sc.WorkingDirectory = "c:\git_repo\homepageDev\my-platform"
$sc.WindowStyle = 7
$sc.Save()
```

---

### 6. 공유기 설정 (외부 접속 필요한 경우만)
- 새 PC의 내부 IP 확인: `ipconfig` → IPv4 주소
- 공유기 포트포워딩: `3000` → 새 PC의 IP:3000
- `next.config.mjs`의 `allowedDevOrigins`에 새 IP 추가
- `proxy.js`의 `isDevHost` 조건에 새 호스트명 추가 (필요 시)

---

### 체크리스트 요약
| 항목 | 비고 |
|------|------|
| Node.js 설치 | LTS 권장 |
| `npm install` | node_modules 생성 |
| `.env.local` 복사 | Supabase 키 등 포함 |
| `pm2 start` + `pm2 save` | 자동시작 목록 저장 |
| 시작 프로그램 바로가기 등록 | PowerShell 명령으로 |
| 포트포워딩 (외부접속 시) | 공유기 설정 |
