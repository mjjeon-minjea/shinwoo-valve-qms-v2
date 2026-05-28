---
name: wiki-ingest
description: "신우밸브 QMS 옵시디언 위키의 인제스트 스킬. raw/ 폴더에서 wiki_status가 pending인 파일을 자동 감지해 wiki/에 정제된 지식 페이지를 생성하고, index.md와 log.md를 업데이트한다. /ingest 명령어로 트리거."
---

# Wiki Ingest 스킬 (`/ingest`)

차장님이 `/ingest` 또는 `"인제스트해줘"` 라고 요청하면 이 스킬을 실행한다.  
**raw/ 폴더는 절대 수정하지 않는다.** 오직 읽기만 허용.

---

## 경로 상수

```
OBSIDIAN_ROOT = C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.obsidian
RAW_BASE      = {OBSIDIAN_ROOT}\raw
WIKI_BASE     = {OBSIDIAN_ROOT}\wiki
INDEX_FILE    = {WIKI_BASE}\index.md
LOG_FILE      = {WIKI_BASE}\log.md
```

---

## Phase 1 — 신규 파일 감지

```powershell
# raw/ 전체를 스캔하여 wiki_status: pending 파일 목록 수집
Get-ChildItem -Path "{RAW_BASE}" -Recurse -Filter "*.md" | ForEach-Object {
  $content = Get-Content $_.FullName -Encoding UTF8 -Raw
  if ($content -match 'wiki_status:\s*"?pending"?') {
    Write-Output $_.FullName
  }
}
```

**파일이 없으면:** "raw/에 새로 인제스트할 파일이 없습니다." 보고 후 종료.  
**파일이 있으면:** 목록을 차장님께 보여주고 인제스트 진행 확인.

---

## Phase 2 — 소스 읽기 & 요약

각 파일에 대해:

1. **파일 전체를 읽는다** (raw/ 수정 없이 읽기만)
2. **소스 요약 생성:**
   - 핵심 주장 (Key Claims) — 최대 8개 bullet
   - 언급된 엔티티 — 사람, 도구, 조직, 제품
   - 다루는 개념 (Concepts) — 위키 페이지 후보가 될 키워드

3. **위키 배치 판단:**

| 소스 유형 | 기본 wiki 배치 |
|---|---|
| 개념·이론·방법론 중심 | `wiki/concepts/` |
| 실험·종합 분석·보고서 | `wiki/synthesis/` |
| 공급사·제품·인물 정보 | `wiki/entities/` |
| QMS 개발 히스토리 | `wiki/history/` |

---

## Phase 3 — 차장님 코멘트 수집

소스 요약을 차장님께 제시하고 아래 4가지 질문:

> 1. 이 파일을 왜 수집하셨나요? 어떤 점이 눈에 띄었나요?
> 2. 지금 하고 있는 일이나 관심사와 어떻게 연결되나요?
> 3. 이 내용에서 나의 생각이나 경험과 다른 점은?
> 4. 이걸로 뭘 해보고 싶으신가요?

---

## Phase 4 — Wiki 페이지 생성

### 4-1. 소스 요약 페이지 (항상 생성)

저장 위치: 배치 판단 결과 폴더  
파일명: `{YYYY-MM-DD}_{소스종류}_{핵심키워드}.md`

```markdown
---
title: "{제목}"
tags: [개념 태그들]
sources:
  - "raw/{폴더}/{파일명}.md"
created: {날짜}
updated: {날짜}
wiki_status: done
related: "[[연관페이지1]], [[연관페이지2]]"
---

# {제목}

> 한 줄 정의

---

## 🎯 핵심 주장 (Key Claims)
...

## 🏷️ 언급된 엔티티
...

## 💡 다루는 개념
...

## 💬 차장님 코멘트
> {차장님 답변 반영}

---

## 🔗 연관 개념
- [[개념1]] — 설명
- [[개념2]] — 설명
```

### 4-2. 엔티티·개념 페이지 (필요 시 생성/업데이트)

- **기존 페이지가 있으면:** 새 소스 정보를 머지 + `[[wikilink]]` 추가
- **없으면:** `wiki/concepts/` 또는 `wiki/entities/`에 새 스텁 페이지 생성

---

## Phase 5 — raw 파일 상태 업데이트

```
raw 파일의 frontmatter에서:
  wiki_status: "pending"
→ 변경 금지! raw/는 절대 수정하지 않는다.
```

대신 **wiki/log.md에 인제스트 완료 기록** 후 종료.

---

## Phase 6 — 백링크 감사

기존 wiki 페이지 전체를 스캔:
- 이번 소스와 **주제가 겹치지만 아직 링크가 없는** 페이지 발견 시
- 해당 페이지 하단 `## 🔗 연관 개념`에 `[[wikilink]]` 추가

---

## Phase 7 — index.md & log.md 업데이트

### index.md
- 새 페이지가 추가된 섹션에 항목 추가
- 총 페이지 카운트 업데이트

### log.md
```
| {YYYY-MM-DD HH:MM} | ingest | {소스명} | {생성/업데이트 페이지 목록} |
```

---

## 완료 보고 형식

```
✅ 인제스트 완료
───────────────────────────────
📥 처리한 소스: {n}개
📄 생성된 wiki 페이지: {n}개
🔄 업데이트된 wiki 페이지: {n}개
🔗 추가된 백링크: {n}개
───────────────────────────────
생성: wiki/concepts/{파일명}.md
갱신: wiki/index.md, wiki/log.md
```
