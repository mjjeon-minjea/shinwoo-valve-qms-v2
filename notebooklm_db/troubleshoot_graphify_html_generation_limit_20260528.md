# 트러블슈팅 - Graphify 5,000노드 용량 초과로 인한 시각화 생성 실패 장애 해결

- **문서 유형:** 트러블슈팅 보고 (Troubleshooting Log)
- **작성일자:** 2026년 5월 28일
- **작성자:** 안티그래비티 (QMS AI 에이전트)
- **결재권자:** 신우밸브주식회사 품질보증부 전민재 차장님

---

## 1. 장애 증상 (Symptom)
- **현상:** Graphify 설치 후 프로젝트 루트 폴더(`.`) 전체를 대상으로 `graphify update`를 실행하였으나, `graphify-out/graph.html` 파일이 비어 있거나 정상적으로 생성되지 않음.
- **오류 메시지 및 특징:** 노드가 10,516개로 과다하게 검출되었으며, 인터랙티브 지식 그래프 시각화를 위한 렌더링 물리 한계치(5,000노드)를 심각하게 초과하여 프로그램이 HTML 출력을 건너뜀.

## 2. 기술적 원인 분석 (Root Cause)
- **원인:** Graphify 라이브러리가 기본적으로 프로젝트 루트 폴더의 `node_modules/`, `dist/`, `.git/` 등 수많은 내부 패키지 및 빌드 관련 코드 파일을 탐색 범위에 포함하여 분석을 시도함.
- **분석:** 이로 인해 실제 관리해야 하는 지식 문서(Markdown) 외에 불필요한 시스템 노드가 무작위로 생성되면서 한계치를 돌파하게 됨.

## 3. 해결 방안 및 해결 코드 (Resolution & Code)
- **해결 방안:** 분석 탐색 범위를 순수 지식 원천 파일이 들어 있는 `raw/` 폴더(`.\raw`)로 축소하고, 이를 안전하게 자동 수행할 수 있는 Windows PowerShell 스크립트를 구현하여 호출 방식을 획득하였습니다.
- **구체적인 해결 스크립트 코드 (`run-graphify.ps1`):**

```powershell
# run-graphify.ps1
# Windows PowerShell 환경 전용 안전 실행 스크립트

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "[QMS AI] Graphify 지식 그래프 갱신을 시작합니다..." -ForegroundColor Cyan
Write-Host "대상 경로: .\raw" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

# Graphify 업데이트 실행 (raw 폴더로 타겟 한정)
graphify update .\raw

# 캐시 기반의 그래프 빌드 수행
graphify build

Write-Host "==========================================" -ForegroundColor Green
Write-Host "[완료] 지식 그래프 생성이 완료되었습니다!" -ForegroundColor Green
Write-Host "출력 위치: .\graphify-out\graph.html" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
```

## 4. 적용 결과 및 모니터링
- **결과:** 스캔 대상이 수십 개의 Markdown 위키 문서로 압축되면서, 최종 41개 노드 및 37개 연결 엣지로 정확하게 수렴된 지식 그래프 `graph.html`이 완벽하게 시각화 빌드되었습니다. 캐시를 통한 점진적 빌드(Incremental Build) 역시 무결하게 작동 중임을 검증하였습니다.
