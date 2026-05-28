# 🗺️ 컴포넌트 — 에이전트 소유권 지도 (모든 에이전트 공통)

> 어떤 파일을 누가 소유하는지 명확히 정의합니다.
> 타 에이전트 소유 파일 수정 시 반드시 해당 에이전트 컨텍스트로 전환.

---

## 📋 게시판 에이전트
| 파일 | 설명 |
|------|------|
| `src/components/NoticeBoard.jsx` | 공지사항 목록/상세/작성 |
| `src/components/ResourceRoom.jsx` | 자료실 |
| `src/components/DevNotes.jsx` | 개발자 노트 |
| `src/components/PostApproval.jsx` | 게시글 승인 (관리자) |
| `src/components/Suggestions.jsx` | 건의사항 |

---

## 📦 인수검사 에이전트
| 파일 | 설명 |
|------|------|
| `src/components/InspectionAnalysisDashboard.jsx` | 종합 분석 현황 |
| `src/components/NonConformanceStatus.jsx` | 부적합 현황 조회 |
| `src/components/InboundAnalysis.jsx` | 대시보드 ⚠️ Dashboard.jsx에서 추출 필요 |
| `src/components/InboundHistory.jsx` | 이력 조회/등록 ⚠️ Dashboard.jsx에서 추출 필요 |

---

## ⚙️ 공정검사 에이전트
| 파일 | 설명 |
|------|------|
| `src/components/ProcessInspectionDashboard.jsx` | 공정검사 대시보드 |
| `src/components/ProcessHistory.jsx` | 공정검사 이력 조회 |
| `src/components/ProcessAnalysis.jsx` | 공정별 분석 |
| `src/components/WorkplaceAnalysis.jsx` | 작업장별 분석 |
| `src/components/EquipmentAnalysis.jsx` | 설비별 분석 |
| `src/components/ModelCategoryAnalysis.jsx` | 모델/품종별 분석 |

---

## 🔍 최종검사 에이전트
| 파일 | 설명 |
|------|------|
| (미구현) | 신규 설계 필요 |

---

## 📅 업무관리 에이전트
| 파일 | 설명 |
|------|------|
| `src/components/WeeklyReport.jsx` | 주간 업무 보고서 작성 |
| `src/components/WeeklyStatus.jsx` | 주간 현황 조회 |
| `src/components/CalendarView.jsx` | 일정 관리 |
| `src/components/Chatbot.jsx` | AI 챗봇 문의 |

---

## 🛡️ 관리자 에이전트
| 파일 | 설명 |
|------|------|
| `src/components/UserManagement.jsx` | 회원 관리 |
| `src/components/PasswordChangeModal.jsx` | 비밀번호 변경 |
| `src/components/Header.jsx` | 공통 헤더 (로그인/로그아웃) |
| `src/components/Hero.jsx` | 로그인/회원가입 화면 |
| `src/contexts/UserContext.jsx` | 인증 컨텍스트 (공유) |
| `api/admin-update-member.js` | 관리자 전용 API |

---

## 🔗 공유 모듈 (소유 에이전트 없음 — 수정 시 차장님 승인 필수)
| 파일 | 설명 |
|------|------|
| `src/lib/api.js` | Supabase 클라이언트 래퍼 |
| `src/App.jsx` | 최상위 라우터 |
| `src/main.jsx` | 앱 진입점 |
| `src/components/Dashboard.jsx` | 메인 컨테이너 (분리 진행 중) |
| `src/components/ProgressModal.jsx` | 공통 로딩 모달 |

---

## ⚠️ Dashboard.jsx 주의사항
현재 `Dashboard.jsx`(1,914줄)에는 여러 에이전트 코드가 혼재되어 있습니다.
- `InboundAnalysis` 컴포넌트 → 인수검사 에이전트로 추출 예정
- `InboundHistory` 컴포넌트 → 인수검사 에이전트로 추출 예정
- `HomepageSettings` 컴포넌트 → 관리자 에이전트로 추출 예정
- 추출 완료 전까지 Dashboard.jsx 수정 시 **반드시 차장님께 보고**
