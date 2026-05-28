# 📚 신우밸브 QMS 위키 인덱스 (index.md)

> AI가 쿼리 응답 전 반드시 먼저 읽는 카탈로그입니다.  
> 각 항목은 한 줄, 120자 이내로 유지합니다.  
> 페이지 생성/삭제 시 즉시 갱신합니다.

---

## 🗂️ 구조 원칙

| 폴더 | 역할 | 누가 만드나 |
|---|---|---|
| `raw/` (10개) | 소스 유형별 원본 보관 (웹 클리퍼 수집) | 클리퍼 자동 / AI 대행 |
| `wiki/` (4개) | 주제별 정제된 지식 베이스 | **항상 AI** |

**raw → wiki 흐름:** 10가지 소스 유형 → AI Ingest → 4가지 주제 폴더로 통합

---

## 📥 raw/ 수집 폴더 (클리퍼 템플릿 10개)

| 폴더 | 소스 유형 | 클리퍼 템플릿 |
|---|---|---|
| `raw/articles/` | 📄 아티클 | `clipper-01-article` |
| `raw/youtube/` | 🎬 유튜브 | `clipper-02-youtube` |
| `raw/podcasts/` | 🎙️ 팟캐스트 | `clipper-03-podcast` |
| `raw/books/` | 📚 책 | `clipper-04-book` |
| `raw/research/` | 🔬 연구 자료 | `clipper-05-research` |
| `raw/quality-standards/` | 📋 품질 규격/법령 | `clipper-06-quality-standard` |
| `raw/meetings/` | 📝 회의록 | `clipper-07-meeting` |
| `raw/news/` | 📰 뉴스/업계동향 | `clipper-08-industry-news` |
| `raw/tools/` | 🛠️ 기술 도구 | `clipper-09-tool` |
| `raw/courses/` | 🎓 강의/코스 | `clipper-10-course` |

---

## 🧠 wiki/ 지식 베이스 (주제별 4개)

### 💡 concepts/ — 개념·이론·규격·방법론
*품질 기준, ISO/KS 규격, 검사 방법론, AI 패턴 등 추상적 개념 페이지*

| 페이지 | 요약 |
|---|---|
| *(아직 등록된 페이지 없음)* | |

---

### 🏭 entities/ — 공급사·품목·인물·조직
*구체적인 실체. 공급사 프로필, 품목 스펙, 담당자 정보 등*

| 페이지 | 요약 |
|---|---|
| *(아직 등록된 페이지 없음)* | |

---

### 🗂️ history/ — QMS 개발 히스토리
*dev_notes 컴파일. QMS 시스템 개발 의사결정·버전별 변경 이력*

| 버전 | 페이지 | 유형 |
|---|---|---|
| v0.0.0 | [[history/2026-01-26_v0_0_0_QMS_프로젝트_태스크]] | 할 일 |
| v0.25.0 | [[history/2026-04-12_v0_25_0_보안_무결성_아키텍처]] | 아키텍처 |
| *(총 68개 — 자동 생성됨)* | | |

---

### 🔮 synthesis/ — 종합 분석
*여러 소스를 교차 참조하여 AI가 종합한 인사이트 페이지. 경영진 보고용.*

| 페이지 | 요약 |
|---|---|
| *(아직 등록된 페이지 없음)* | |

---

*마지막 갱신: 2026-05-28 | wiki 총 페이지: 92개 (history: 88, concepts: 2, synthesis: 2)*
