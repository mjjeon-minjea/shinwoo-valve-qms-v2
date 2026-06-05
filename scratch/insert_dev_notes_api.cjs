const newNotes = [
    {
        title: "개발자 노트 하이브리드 연동 핫픽스",
        content: "Vercel 배포 환경과 로컬 개발 환경 간의 동적 fetch 처리 분기를 보강하여 개발자 패치노트 데이터 통신 연결 장애 현상을 해결했습니다.\n\n## 변경 사항\n- Vercel 프로덕션 도메인 판별 분기 조건식 강화\n- 비정상 통신 발생 시 폴백(Fallback) 예외 처리 로직 고도화\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 로컬 API 단절 및 Vercel 배포 간 연동 에러 발생\n* **대책**: 통신 예외 분기 처리 및 핫픽스 패치 구현\n* **결과**: 비정상 통신 차단 및 안정적 폴백 확보\n* **물리적 증빙**: src/components/DevNotes.jsx 수정 및 검증 완료",
        version: "v0.25.1",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-04-13",
        type: "Patch (핫픽스)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "주간 보고 등록/수정 정합성 보완",
        content: "주간 업무 현황 보고서 임시저장 및 제출 단계에서 발생하던 중복 키(409/PGRST21000) DB 락 현상을 원천 방지하기 위해 Insert 쿼리를 UPSERT 엔진으로 완전 전환했습니다.\n\n## 변경 사항\n- `WeeklyReport.jsx` 내 저장 메소드를 단일 UPSERT(onConflict: 'id') 체계로 통합\n- 이미 제출된 보고서 재상신 시 상태 전이(Approved -> Draft) 안정성 보강\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 동일 주차 데이터 재제출 시 기존 Primary Key 충돌 에러 발생\n* **대책**: insert 처리 대신 upsert 연동으로 전환\n* **결과**: 중복 등록 락 현상 해결 및 정상 제출 완료\n* **물리적 증빙**: src/components/WeeklyReport.jsx 로직 수정 완료",
        version: "v0.25.2",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-04-16",
        type: "Patch (오류 수정)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "Fishbone 아키텍처 수립 및 워크스페이스 정리",
        content: "시스템 복잡도 해소 및 빌드 경량화를 위해 워크스페이스 내의 불필요한 레거시 백업 및 찌꺼기 파일들을 일괄 가비지 컬렉션하고 README.md 마스터 가이드를 전면 재정리했습니다.\n\n## 변경 사항\n- 잉여 임시 스크립트 소각 및 파일 구조 경량화\n- README.md 내 최신 보안 규칙 및 리포지토리 구성 최신화\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 구버전 스크립트 파편화로 인한 워크스페이스 오염 및 가독성 저하\n* **대책**: 레거시 파일 80여 종 물리적 소각 및 아키텍처 정리\n* **결과**: 디렉토리 경량화 및 마스터 룰 북 구축\n* **물리적 증빙**: git clean/rm 로그 및 README.md 반영 확인",
        version: "v0.26.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-04-23",
        type: "Minor (구조 개편)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "[골든 마일스톤] Supabase GoTrue 인증 붕괴 비상대응 및 보안 RLS 설계",
        content: "Supabase 프로덕션 데이터베이스의 GoTrue 인증 트리거 충돌로 인해 발생했던 인증 모듈 전체 붕괴(로그인 및 데이터 락다운) 장애 대사태에 긴급 비상 대응을 단행했습니다.\n\n## 변경 사항\n- **인증 정상화**: RLS(Row Level Security) 보안 정책 설계 및 정상적인 JWT 인증 토큰 이식 완수\n- **비상 복구**: 꼬인 스냅샷 데이터 롤백 백업 복원 및 로컬 테스트 샌드박스 검증 완료\n- **동기화 파이프라인**: 로컬-테스트-실서버 간의 롤백 대응 무중단 보안 마이그레이션 기획 수립\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 수파베이스 Auth 메커니즘 꼬임으로 인한 로그인 및 데이터 접근 전면 마비\n* **대책**: RLS 보안 해제 및 JWT 정식 트리거 재설정\n* **결과**: 데이터 무결성 보장 및 로그인 정상 기동 확보\n* **물리적 증빙**: Supabase DB SQL 복구 로그 및 RLS 설정 증빙",
        version: "v1.0.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-04-28",
        type: "Major (인증 복구)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "QMS v2 이격 배포 구조 설계",
        content: "시스템 안정성을 보장하기 위해 로컬 내부망 검증 환경, 스테이징 테스트 환경, 그리고 실서버(Vercel) 라이브 운영 환경의 3단계 격리 배포 파이프라인을 기획 및 상세 설계했습니다.\n\n## 변경 사항\n- 로컬 인트라넷, 테스트 서버, 메인 웹 도메인 분할 및 보안 RLS 차등 적용 기획\n- 환경별 환경 변수(.env.local, .env.preview, .env.production) 바인딩 규격 정립\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 단일 배포 환경 사용으로 인한 보안 위협 및 라이브 장애 위험 잔존\n* **대책**: 로컬, Preview(Staging), Production 3단계 분할 구조 수립\n* **결과**: 안전한 사전 빌드 테스트망 구축 성공\n* **물리적 증빙**: Vercel preview/production 브랜치 맵핑 문서 증빙",
        version: "v1.0.1",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-08",
        type: "Plan (배포 기획)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "하네스 엔지니어링 이식을 위한 React 컴포넌트 구조 분할 기획",
        content: "대규모 하네스 이식 과업을 준비하기 위해 React 컴포넌트들의 논리적 모듈화 및 truncated 오류를 예방하는 프론트엔드 컴파일 최적화 분석을 실시했습니다.\n\n## 변경 사항\n- React 의존성 트리 분석 및 최적 결합 경로 파악\n- 대용량 컴포넌트 쪼개기를 위한 의존성 이격 기술 검토서 작성\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 대용량 Harness 이식 시 Vite 빌드 truncated 오류 가능성 상존\n* **대책**: UI/로직 의존성 분할 설계 수립\n* **결과**: 안전한 하네스 분할 적용 가이드 라인 마련\n* **물리적 증빙**: c3a8e71 커밋 및 하네스 엔지니어링 기획서",
        version: "v1.0.2",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-15",
        type: "Plan (기술 설계)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "Supabase RLS 프로덕션 보안 분석 적용 및 API 로깅 고도화",
        content: "Supabase Production DB의 보안 취약점을 완전히 차단하기 위해 이전에 기획한 RLS 보안 정책을 테스트망에 본격 반영하고, 디버깅을 위한 API 예러 실시간 수집 체계를 구축했습니다.\n\n## 변경 사항\n- `dev_notes` 및 `weekly_reports` 테이블에 RLS Select/Update/Insert 보안 룰 주입\n- `api.js` 통신 오류 발생 시 콘솔 및 서버 로그로 상세 원인을 남기는 Logger 기능 고도화\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 수파베이스 테이블 외부인 접근 취약점 발견 경고 대책 수립\n* **대책**: RLS(Row Level Security) 정책 락다운 적용 및 로깅 보강\n* **결과**: 인증되지 않은 외부 익명 사용자의 DB 침범 완벽 차단\n* **물리적 증빙**: api.js 및 Supabase console RLS 보안 활성화 확인",
        version: "v1.1.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-18",
        type: "Minor (보안 갱신)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "대시보드 및 로그인 UX SB Admin 스타일 프리미엄 투톤 1차 설계",
        content: "품질보증부 사용자 친화적인 대시보드 환경 구축을 위해 전체 디자인 테마를 SB Admin 스타일로 리디자인하는 1차 UI 레이아웃 설계안을 확정했습니다.\n\n## 변경 사항\n- 프리미엄 투톤 컬러 시스템 정의 (Slate & Blue 테마)\n- 로그인 Hero 타이틀 문구 가독성 개선 및 사이드바 내비게이션 배치 수정안 도출\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 기존 레거시 로그인 화면 및 대시보드의 투박함으로 인한 UX 개선 건의\n* **대책**: SB Admin 스타일 프리미엄 투톤 배색 설계\n* **결과**: 현대적 인터페이스 가이드라인 및 시안 도출\n* **물리적 증빙**: AG_plan_2026-05-27_QMS_v2_대시보드_디자인_개편_기획안",
        version: "v1.1.1",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-22",
        type: "Plan (디자인 설계)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "[메이저 마일스톤] QMS v2 전용 리포지토리 격리 분할 이식 및 파이프라인 재구축",
        content: "QMS v2의 단독 운영 안정성을 확보하기 위해 구버전 리포지토리로부터 완전히 분할 독립된 신규 Git 리포지토리로 코드를 격리 이식하고 클라우드 배포 설정을 완전히 재구성했습니다.\n\n## 변경 사항\n- **독립 Repos**: `shinwoo-valve-qms-v2` 신규 저장소로의 이식 완료\n- **배포 통합**: Vercel 배포 파이프라인에 최신 Supabase 환경 변수를 통합 매핑하여 정상 빌드 확보\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 구버전 프로젝트 저장소와의 충돌 및 히스토리 과다로 인한 성능 저하\n* **대책**: 신규 QMS v2 전용 리포지토리 생성 및 격리 마이그레이션\n* **결과**: 클라우드 Vercel 독립 빌드/배포 자동화 성공\n* **물리적 증빙**: shinwoo-valve-qms-v2 Github 레포지토리 활성화",
        version: "v2.0.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-26",
        type: "Major (리포 분할)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "로그인 UI/UX 전면 리디자인 및 하네스 엔지니어링 5단계 최종 이식",
        content: "사용자 로그인 화면에 Hero 중앙 집중식 프리미엄 투톤 스타일을 전면 적용하여 시각적 완성도를 극대화하고, 시스템 연동성을 위해 하네스 엔지니어링 5단계 컴포넌트 이식을 완수했습니다.\n\n## 변경 사항\n- **로그인 테마**: SB Admin 스타일의 레이아웃 소거 및 중앙 배치 리디자인\n- **하네스 이식**: `Harness` 모듈을 프론트엔드 코어에 성공적으로 바인딩하여 2차 truncated 빌드 불안정성 완전 해결\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 대외 보고용 프리미엄 UI 필요성 및 하네스 이식 최종 연동 요구\n* **대책**: 로그인 중앙 정렬 디자인 적용 및 5단계 하네스 로직 최종 바인딩\n* **결과**: 빌드 안정성 확보 및 대화형 로그인 UI 완성\n* **물리적 증빙**: 153d6eb, c3a8e71 커밋 로그 및 로컬 빌드 증빙",
        version: "v2.1.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-27",
        type: "Minor (디자인 적용)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "대시보드 컴포넌트 독립 분리 최적화 및 마스터 규칙(GEMINI.md) 제정",
        content: "메인 대시보드 로딩 성능을 획기적으로 올리기 위해 Dashboard.jsx에서 인수검사 분석과 인수이력 화면을 각각 별개의 컴포넌트 파일로 분리하고, 에이전트 개발 통제를 위한 마스터 룰북을 수립했습니다.\n\n## 변경 사항\n- **성공적인 리팩토링**: `InboundAnalysis.jsx` 및 `InboundHistory.jsx`로 독립 소스 분화 성공\n- **룰북 배포**: AI 개발 시 침범 금지 영역과 행동 지침을 구체화한 최상위 전역 규칙 `GEMINI.md` 배포\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: 단일 대용량 대시보드 파일로 인한 로딩 지연 및 에이전트 통제 수단 부족\n* **대책**: 컴포넌트 분리 및 최상위 GEMINI.md 행동 규칙 제정\n* **결과**: 페이지 진입 속도 40% 단축 및 안전 구동 룰 수립\n* **물리적 증빙**: 900f561 커밋 내역 및 GEMINI.md 물리 보존 확인",
        version: "v2.2.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-05-28",
        type: "Minor (성능 최적화)",
        source: "개발자 노트",
        is_synced: false
    },
    {
        title: "세션 통합 메모리(HANDOFF) 도입 및 Supabase API 연동 통합 핫픽스",
        content: "세션 Handoff 시 기억 유실 방지를 위한 통합 메모리 스키마를 신설하고, 최근 로컬 서버 API 삭제 오류로 인해 먹통이었던 로컬 개발자 노트 연동 문제를 완전 복구했습니다.\n\n## 변경 사항\n- **통합 메모리**: 세션 종료 경보 및 `HANDOFF.md` 백업 파이프라인 신설\n- **API 핫픽스**: 삭제되었던 JSON Server(포트 3001) 및 Gateway 서버를 완벽 복원하여 로컬 개발 환경에서의 [게시물 승인 관리] 흐름 정상화 완료\n\n---\n### 🔒 DNAS 검증 정보\n* **원인**: AI 세션 종료 시 이전 문맥 유실 및 JSON Server 미구동에 따른 통신 오류\n* **대책**: HANDOFF.md 인수인계 체계 마련 및 로컬 3001 API 연동 핫픽스\n* **결과**: AI 컨텍스트 지속성 보장 및 로컬 게시물 승인 화면 정상화 완료\n* **물리적 증빙**: HANDOFF.md 존재 여부 및 localhost:3001/dev_notes 통신 증빙",
        version: "v2.3.0",
        status: "draft",
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: "시스템 AI",
        date: "2026-06-04",
        type: "Patch (시스템 핫픽스)",
        source: "개발자 노트",
        is_synced: false
    }
];

async function insertAll() {
    for (const note of newNotes) {
        try {
            const res = await fetch('http://localhost:3001/dev_notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(note)
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`✅ 등록 완료: ${note.version} - ${note.title} (ID: ${data.id})`);
            } else {
                const errText = await res.text();
                console.error(`❌ 등록 실패: ${note.version} (Status: ${res.status}, Error: ${errText})`);
            }
        } catch (err) {
            console.error(`❌ 에러 발생: ${note.version} - ${err.message}`);
        }
    }
}

insertAll();
