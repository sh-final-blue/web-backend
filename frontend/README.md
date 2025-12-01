# Frontend

서버리스 함수 관리 플랫폼 프론트엔드

## 기술 스택

### 핵심 프레임워크 및 라이브러리
- **React**: 18.3.1
- **TypeScript**: 5.8.3
- **Vite**: 5.4.21 (빌드 툴)
- **Node.js**: 22.14.0 (권장)
- **npm**: 11.6.2 (권장)

### UI 라이브러리
- **Shadcn/ui**: Radix UI 기반 컴포넌트 라이브러리
- **Tailwind CSS**: 3.4.17 (스타일링)
- **Lucide React**: 0.462.0 (아이콘)
- **Recharts**: 2.15.4 (차트)

### 주요 라이브러리
- **React Router DOM**: 6.30.1 (라우팅)
- **TanStack React Query**: 5.83.0 (서버 상태 관리)
- **Monaco Editor**: 4.7.0 (코드 에디터)
- **i18next**: 25.6.3 (다국어 지원)
- **React Hook Form**: 7.61.1 (폼 관리)
- **Zod**: 3.25.76 (스키마 검증)
- **date-fns**: 3.6.0 (날짜 처리)
- **Sonner**: 1.7.4 (토스트 알림)

### 개발 도구
- **@vitejs/plugin-react-swc**: 3.11.0 (SWC 기반 Fast Refresh)
- **ESLint**: 9.32.0
- **TypeScript ESLint**: 8.38.0
- **Autoprefixer**: 10.4.21
- **PostCSS**: 8.5.6

## 설치 및 실행

### 요구사항
- Node.js 22.x 이상
- npm 11.x 이상

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```
서버 주소: http://localhost:3000

### 빌드
```bash
# Production 빌드
npm run build

# Development 빌드
npm run build:dev
```

### Lint
```bash
npm run lint
```

### 미리보기
```bash
npm run preview
```

## 프로젝트 구조

```
frontend/
├── src/
│   ├── components/       # 재사용 가능한 컴포넌트
│   │   ├── ui/          # Shadcn UI 컴포넌트
│   │   ├── AppLayout.tsx
│   │   ├── CodeEditor.tsx
│   │   ├── MetricsCard.tsx
│   │   └── WorkspaceSidebar.tsx
│   ├── contexts/        # React Context (상태 관리)
│   │   └── AppContext.tsx
│   ├── hooks/           # Custom Hooks
│   ├── lib/             # 유틸리티 함수
│   │   ├── i18n.ts
│   │   └── utils.ts
│   ├── pages/           # 페이지 컴포넌트
│   │   ├── Landing.tsx
│   │   ├── WorkspaceDashboard.tsx
│   │   ├── FunctionsList.tsx
│   │   ├── NewFunction.tsx
│   │   ├── FunctionDetail.tsx
│   │   └── WorkspaceSettings.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## 주요 기능

- ✅ 워크스페이스 관리 (생성, 조회, 삭제)
- ✅ 서버리스 함수 관리 (CRUD)
- ✅ Monaco 기반 코드 에디터 (Python 3.12 지원)
- ✅ 함수 테스트 인터페이스
- ✅ 실행 로그 조회
- ✅ 메트릭 대시보드
- ✅ 다국어 지원 준비 (i18next)
- ⏳ 백엔드 API 연동 (예정)
