---
name: wiki-lint
description: "신우밸브 QMS 위키 전체 린트 스킬. 깨진 wikilink, index 불일치, 고립 페이지, 미인제스트 raw 소스 등 8가지 항목을 검사하고 수정 제안만 출력한다 (자동 수정 없음). /lint 또는 '위키 린트해줘' 명령어로 트리거."
---

# Wiki Lint 스킬 (`/lint`)

차장님이 `/lint` 또는 `"위키 린트해줘"` 라고 요청하면 이 스킬을 실행한다.  
**수정은 절대 자동으로 실행하지 않는다.** 발견사항 보고 → 차장님 승인 → 수정 대행 순서.

---

## 경로 상수

```
WIKI_BASE  = C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.obsidian\wiki
RAW_BASE   = C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\.obsidian\raw
INDEX_FILE = {WIKI_BASE}\index.md
```

---

## 실행 순서

```
1. wiki/ 전체 파일 목록 수집
2. index.md 파싱
3. raw/ 전체 파일 목록 수집
4. 8가지 체크 순차 실행
5. 심각도별 보고서 출력
6. 수정 제안 목록 제시
7. 차장님 승인 대기
```

---

## 체크 1 — 🔴 Error: 깨진 [[wikilink]]

**감지 방법:**
```powershell
# wiki/ 전체에서 [[wikilink]] 패턴 추출
$allLinks = Get-ChildItem "{WIKI_BASE}" -Recurse -Filter "*.md" | ForEach-Object {
  $file = $_.FullName
  Get-Content $file -Encoding UTF8 | 
    Select-String -Pattern '\[\[([^\]]+)\]\]' -AllMatches |
    ForEach-Object { $_.Matches } |
    ForEach-Object { [PSCustomObject]@{ Source=$file; Target=$_.Groups[1].Value } }
}

# 실제 존재 여부 확인
$allWikiFiles = Get-ChildItem "{WIKI_BASE}" -Recurse -Filter "*.md" | Select-Object -ExpandProperty BaseName
$allLinks | Where-Object { $allWikiFiles -notcontains ($_.Target -split '\|')[0] -split '/')[-1] }
```

**보고 형식:**
```
🔴 [Error] 깨진 wikilink 발견
  파일: wiki/concepts/하네스_엔지니어링.md
  링크: [[LLM_Wiki_패턴]]
  이유: wiki/concepts/LLM_Wiki_패턴.md 파일 없음
  제안: 해당 파일 생성 또는 링크 제거
```

---

## 체크 2 — 🔴 Error: index.md와 실제 파일 불일치

**감지 방법:**
- index.md에 등록됐지만 실제 파일 없는 항목 → **유령 링크**
- 실제 파일은 있지만 index.md에 없는 항목 → **미등록 파일**

```powershell
# index.md에서 [[링크]] 추출
$indexLinks = Get-Content "{INDEX_FILE}" -Encoding UTF8 | 
  Select-String -Pattern '\[\[([^\|\]]+)' -AllMatches |
  ForEach-Object { $_.Matches.Groups[1].Value }

# 실제 wiki 파일 목록
$actualFiles = Get-ChildItem "{WIKI_BASE}" -Recurse -Filter "*.md" |
  Where-Object { $_.Name -ne "index.md" -and $_.Name -ne "log.md" }
```

**보고 형식:**
```
🔴 [Error] index.md 유령 링크
  링크: [[concepts/컨텍스트_엔지니어링]]
  이유: 파일 없음
  제안: 파일 생성 또는 index.md 항목 제거

🔴 [Error] index.md 미등록 파일
  파일: wiki/concepts/브레인_트리니티.md
  이유: index.md에 항목 없음
  제안: index.md에 해당 섹션 추가
```

---

## 체크 3 — 🟡 Warning: 모순된 내용 페이지 쌍

**감지 방법:**
- 같은 개념을 다루는 2개 이상의 페이지에서 상충되는 주장을 키워드 기반으로 탐지
- 예: A 페이지 "클로드가 검증에 강함" vs B 페이지 "코덱스가 검증에 강함"

**보고 형식:**
```
🟡 [Warning] 잠재적 모순 내용
  페이지 A: wiki/concepts/하네스_엔지니어링.md (L45)
    주장: "코덱스가 검증·오케스트레이션에 강함"
  페이지 B: wiki/history/2026-05-27_....md (L12)
    주장: "클로드가 전체 검증을 담당함"
  제안: 두 페이지의 맥락 확인 후 일관된 표현으로 통일
```

---

## 체크 4 — 🟡 Warning: 인바운드 링크 없는 고립 페이지 (Orphan)

**감지 방법:**
```powershell
# 모든 wiki 파일에서 [[링크]] 목록 수집
$allInbound = @{}
Get-ChildItem "{WIKI_BASE}" -Recurse -Filter "*.md" | ForEach-Object {
  Get-Content $_.FullName -Encoding UTF8 | 
    Select-String '\[\[([^\|\]]+)' -AllMatches |
    ForEach-Object { $_.Matches.Groups[1].Value } |
    ForEach-Object { $allInbound[$_] = $true }
}

# 아무도 링크하지 않는 파일
Get-ChildItem "{WIKI_BASE}" -Recurse -Filter "*.md" |
  Where-Object { -not $allInbound.ContainsKey($_.BaseName) }
```

**보고 형식:**
```
🟡 [Warning] 고립 페이지 (orphan)
  파일: wiki/entities/공급사_ABC.md
  인바운드 링크: 없음
  제안: index.md 또는 관련 페이지에서 [[entities/공급사_ABC]] 링크 추가
```

---

## 체크 5 — 🟡 Warning: 언급만 되고 페이지 없는 개념 (Stub 후보)

**감지 방법:**
```powershell
# [[링크]]는 있지만 실제 파일이 없는 것들 중 Error(체크1,2)가 아닌 것
# = 여러 파일에서 반복 언급되는 미생성 개념
```

**보고 형식:**
```
🟡 [Warning] Stub 후보 (3개 페이지에서 언급됨)
  미생성 개념: [[컨텍스트_엔지니어링]]
  언급 위치:
    - wiki/concepts/하네스_엔지니어링.md
    - wiki/history/2026-05-28_...md
  제안: wiki/concepts/컨텍스트_엔지니어링.md 스텁 페이지 생성
```

---

## 체크 6 — 🟡 Warning: 오래된/업데이트 필요 정보 (Stale)

**감지 방법:**
- frontmatter `updated` 날짜가 90일 이상 경과
- 또는 페이지 내용에 "향후 계획", "예정", "미정" 등 시제가 맞지 않는 표현 탐지

**보고 형식:**
```
🟡 [Warning] 오래된 정보 가능성
  파일: wiki/concepts/브레인_트리니티.md
  마지막 업데이트: 2026-05-28 (최근이나 🌱 Seedling 상태)
  제안: 구체적인 진행 상황으로 업데이트 필요 시 /ingest 재실행
```

---

## 체크 7 — 🔵 Info: 빠진 크로스레퍼런스

**감지 방법:**
- 두 페이지가 같은 핵심 키워드를 포함하지만 서로 링크하지 않는 경우
- 예: A가 "멀티에이전트"를 언급하고 B가 "멀티에이전트"를 주제로 하지만 A→B 링크 없음

**보고 형식:**
```
🔵 [Info] 미연결 관련 페이지
  wiki/concepts/하네스_엔지니어링.md
    → wiki/history/2026-05-27_QMS_v2_점진적_하네스_이식_기획안.md 미연결
  제안: 하네스_엔지니어링.md 하단에 [[history/...]] 링크 추가
```

---

## 체크 8 — 🔵 Info: 미인제스트 raw 소스

**감지 방법:**
```powershell
# wiki_status: pending 파일 목록
Get-ChildItem "{RAW_BASE}" -Recurse -Filter "*.md" | ForEach-Object {
  $content = Get-Content $_.FullName -Encoding UTF8 -Raw
  if ($content -match 'wiki_status:\s*"?pending"?') {
    $_.FullName.Replace("{RAW_BASE}\", "raw/")
  }
}
```

**보고 형식:**
```
🔵 [Info] 미인제스트 raw 소스
  raw/articles/2026-05-28_ISO_9001_개정사항.md
  제안: /ingest 실행하여 wiki/concepts/ 또는 wiki/synthesis/에 등록
```

---

## 최종 보고서 형식

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Wiki Lint 보고서 — {날짜}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
검사 범위:
  wiki/ 총 {n}개 파일 | raw/ 총 {n}개 파일

─────────────────────────────────────
🔴 Error (즉시 수정 필요): {n}건
─────────────────────────────────────
  [E1] 깨진 wikilink: {n}건
  [E2] index.md 불일치: {n}건

─────────────────────────────────────
🟡 Warning (수정 권장): {n}건
─────────────────────────────────────
  [W3] 모순 내용: {n}건
  [W4] 고립 페이지: {n}건
  [W5] Stub 후보: {n}건
  [W6] 오래된 정보: {n}건

─────────────────────────────────────
🔵 Info (있으면 좋음): {n}건
─────────────────────────────────────
  [I7] 미연결 관련 페이지: {n}건
  [I8] 미인제스트 raw: {n}건

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  수정을 바로 실행하지 않습니다.
"전부 수정해줘" 또는 "Error만 수정해줘" 라고 승인해주세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 승인 후 수정 실행 규칙

차장님이 승인하면:
- **Error 수정:** 즉시 실행 (깨진 링크 제거, index 동기화)
- **Warning 수정:** 항목별로 확인 후 실행
- **Info 수정:** 선택적 실행
- 수정 완료 후 **log.md에 lint 결과 기록**

```
| {날짜 시간} | lint | wiki/ {n}파일 검사 | E:{n}건, W:{n}건, I:{n}건 수정 |
```
