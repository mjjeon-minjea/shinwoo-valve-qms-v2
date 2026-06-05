---
name: defuddle
description: Defuddle CLI를 사용하여 웹 페이지에서 광고 및 메뉴 구조를 제외한 깨끗한 마크다운 본문을 추출합니다. 사용자가 온라인 문서, 기술 블로그, 기사 등의 URL을 읽거나 분석해 달라고 요청할 때 사용합니다. (.md로 끝나는 URL은 이미 마크다운이므로 직접 조회하고, 일반 웹 페이지 분석 시 본 스킬을 사용합니다.)
---

# 🌐 웹 페이지 정제 추출 도구 규칙 (defuddle)

본 스킬은 Defuddle CLI를 사용하여 임의의 기술 블록이나 웹 문서에서 불필요한 레이아웃(헤더, 네비게이션바, 광고 등)을 걷어내고 본문 마크다운만 정밀하게 추출하여 토큰을 절약하기 위한 규칙입니다.

## 1. 설치 방법 (필요시)
로컬에 설치가 필요한 경우:
```powershell
npm install -g defuddle
```

## 2. 권장 사용 방법 (PowerShell 문법 준수)
출력을 마크다운 형식으로 고정하기 위해 항상 `--md` 플래그를 결합하여 실행합니다.

### A. 화면 출력으로 본문 확인하기
```powershell
defuddle parse <url> --md
```

### B. 추출된 본문을 파일로 직접 저장하기
```powershell
defuddle parse <url> --md -o content.md
```

### C. 특정 메타데이터 프로퍼티만 추출하기
```powershell
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## 3. 지원 출력 포맷 규격

| 플래그 | 설명 |
|---|---|
| `--md` | 마크다운 포맷으로 추출 (가장 권장) |
| `--json` | HTML과 마크다운이 모두 포함된 JSON 포맷 |
| (없음) | 원본 HTML 포맷 |
| `-p <이름>` | 타이틀, 설명 등 특정 메타데이터 속성만 추출 |
