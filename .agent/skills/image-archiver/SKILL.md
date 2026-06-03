---
name: image-archiver
description: generate_image로 생성된 임시 이미지를 프로젝트 공식 이미지 보관함으로 복사하는 스킬
triggers:
  - 이미지복사
  - 이미지백업
  - image-copy
  - image-archive
---

## 1. 동작 원리
에이전트가 `generate_image`를 통해 이미지를 성공적으로 출력한 즉시, 본 스킬을 스스로 호출하여 이미지를 로컬 QMS 보관소로 복사 배포합니다.

## 2. 실행 프로토콜
1. **소스 경로 (Source - 동적 해석 규격)**:
   - 에이전트의 임시 아티팩트 디렉토리 루트인 `C:\Users\mjjeon\.gemini\antigravity-ide\brain\` 하위의 하위 폴더들 중, **최종 수정 시간(LastWriteTime)이 가장 최신인 세션 디렉토리**를 동적으로 탐색하여 특정합니다. (UUID 하드코딩 절대 금지)
   - 해당 세션 디렉토리 내에서 방금 생성된 최신 이미지 파일(`*.png` 또는 `*.webp` 등)의 경로를 획득합니다.
2. **대상 경로 (Destination)**: `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\안티그래비티\images\`
3. **복사 명령 실행**: PowerShell `Copy-Item` 명령을 활용하여 원본 무결성을 유지하며 강제 복사합니다.
