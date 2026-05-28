---
name: wiki-query
description: "신우밸브 QMS 위키 기반 질의응답 스킬. wiki/ 내 문서를 출처로 삼아 질문에 답변하고, 답변이 충분히 완성되면 새 wiki 페이지로 저장하여 지식을 누적시킨다(Knowledge Flywheel). /query 또는 '위키에서 찾아줘' 명령어로 트리거."
---

# Wiki Query 스킬 (`/query`)

차장님이 `/query {질문}` 또는 `"위키에서 찾아줘: {질문}"` 라고 요청하면 이 스킬을 실행한다.  
**벡터 DB 없이 wiki 마크다운 문서를 직접 읽어 답변**한다.  
질문이 wiki를 풍요롭게 한다 — **Knowledge Flywheel**.

---

## 경로 상수

```
WIKI_BASE  = C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.obsidian\wiki
RAW_BASE   = C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.obsidian\raw
INDEX_FILE = {WIKI_BASE}\index.md
LOG_FILE   = {WIKI_BASE}\log.md
```

---

## Step 1 — index.md 읽기 & 관련 페이지 파악

```
1. wiki/index.md를 읽는다
2. 질문 키워드와 관련된 섹션·페이지를 식별한다
3. 관련성 높은 페이지 목록을 작성한다 (최대 10개)
```

**출력 (내부용):**
```
관련 페이지 후보:
- wiki/concepts/하네스_엔지니어링.md  (관련도: 높음)
- wiki/history/2026-05-27_...md        (관련도: 중간)
```

---

## Step 2 — 관련 wiki 페이지 읽기 & 답변 구성

1. 후보 페이지를 **관련도 순서대로** 읽는다
2. 핵심 정보를 추출하여 답변을 구성한다
3. **모든 주장에 출처 표기** — `[[wikilink]]` 형식으로 인용

### 답변 형식

```markdown
## 📖 답변

{질문에 대한 핵심 답변}

**출처:**
- [[concepts/하네스_엔지니어링]] — {인용 내용}
- [[history/2026-05-27_...]] — {인용 내용}

---

**wiki 커버리지:** {질문의 몇 %가 wiki로 커버됐는지 평가}
```

---

## Step 3 — wiki 정보 부족 시 raw/ 추가 검색

wiki에서 충분한 답변이 나오지 않으면:

```powershell
# 질문 키워드로 raw/ 전체 그렙 검색
Get-ChildItem -Path "{RAW_BASE}" -Recurse -Filter "*.md" | 
  Select-String -Pattern "{키워드}" -Encoding UTF8 |
  Select-Object Path, LineNumber, Line -First 20
```

raw/에서 찾은 내용을 보충 답변으로 추가:
```
※ 아래 내용은 wiki/에 미인제스트된 raw 소스에서 발견됨:
출처: raw/youtube/2026-05-28_...md (아직 wiki 미등록)
```

---

## Step 4 — Knowledge Flywheel: 새 wiki 페이지 저장

**저장 조건 (모두 충족 시):**
- [ ] 답변이 500자 이상으로 충분히 완성됨
- [ ] wiki에 아직 없는 새로운 개념을 종합함
- [ ] 차장님이 추가 코멘트를 제공함

**저장 시 파일명:** `wiki/synthesis/{YYYY-MM-DD}_Q_{질문요약}.md`

```markdown
---
title: "{질문 기반 제목}"
type: "질의응답 (Q&A)"
query: "{원본 질문}"
created: {날짜}
wiki_status: done
tags: [query, synthesis, {관련 태그}]
---

# {제목}

> **질문:** {원본 질문}

## 📖 답변
{답변 전문}

## 📚 사용된 출처
- [[출처1]]
- [[출처2]]

## 💬 차장님 추가 코멘트
{있을 경우}
```

---

## Step 5 — index.md & log.md 업데이트

### index.md
- 새 synthesis 페이지 생성 시 해당 섹션에 추가

### log.md
```
| {YYYY-MM-DD HH:MM} | query | "{질문 요약}" | {생성된 페이지 또는 "wiki만으로 답변 완료"} |
```

---

## Knowledge Flywheel 작동 원리

```
차장님 질문
    ↓
wiki 검색 → 답변
    ↓
답변이 충분함? → 새 synthesis 페이지 생성
    ↓
다음 질문이 더 풍부한 wiki를 만남
    ↓
반복 → wiki가 점점 깊어짐
```

---

## 답변 품질 기준

| 수준 | 조건 | 처리 |
|---|---|---|
| ✅ 완전 | wiki로 80%+ 커버 | 답변 후 Flywheel 저장 제안 |
| ⚠️ 부분 | wiki로 40~80% 커버 | 답변 + raw 보충 + 인제스트 권장 |
| ❌ 부족 | wiki로 40% 미만 커버 | raw 검색 + `/ingest` 먼저 권장 |
