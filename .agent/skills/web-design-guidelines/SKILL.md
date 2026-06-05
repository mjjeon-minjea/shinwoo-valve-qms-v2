---
name: web-design-guidelines
description: 웹 인터페이스 가이드라인(Web Interface Guidelines) 준수 여부를 확인하기 위해 UI 코드를 검토합니다. 사용자가 "UI 검토해줘", "접근성 확인", "디자인 검수", "UX 체크" 또는 "모범 사례 검증"을 요청할 때 이 스킬을 호출합니다.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <검토할-파일-또는-패턴>
---

# 웹 인터페이스 가이드라인 검수 (Web Interface Guidelines)

지정된 파일들이 웹 인터페이스 가이드라인(Web Interface Guidelines)을 준수하는지 검토합니다.

## 작동 방식 (How It Works)

1. 아래의 소스 URL에서 최신 가이드라인 규칙을 다운로드합니다.
2. 검토할 소스 파일들을 조회합니다 (지정된 파일이 없다면 사용자에게 대상 파일/패턴 입력을 정중히 요청합니다).
3. 획득한 최신 가이드라인 규칙을 기반으로 코드를 정밀 검사합니다.
4. 발견된 문제점들을 `파일명:행번호` 형식의 간결한 포맷으로 출력합니다.

## 가이드라인 소스 URL (Guidelines Source)

검수를 시작하기 전에 항상 최신 규칙을 내려받아 적용합니다:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

`read_url_content` 등의 웹 브라우징 도구를 사용하여 최신 룰을 조회합니다. 이 URL 파일 내부에 세부 규칙 정보와 결과물 출력 형식 지침이 모두 담겨 있습니다.

## 사용 방법 (Usage)

사용자가 대상 파일 또는 패턴을 제공하는 경우:
1. 위의 소스 URL에서 최신 가이드라인을 다운로드합니다.
2. 지정된 소스 파일들의 코드를 읽습니다.
3. 다운로드한 가이드라인의 모든 규칙을 적용해 검증합니다.
4. 가이드라인에 명시된 규칙 위반 보고 형식에 맞춰 검수 결과를 출력합니다.

대상이 명시되지 않은 경우, 어느 파일들을 검토할지 사용자에게 정중히 질문하십시오.
