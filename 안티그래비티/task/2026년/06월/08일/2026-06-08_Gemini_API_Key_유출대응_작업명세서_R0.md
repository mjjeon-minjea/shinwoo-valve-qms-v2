# 📋 Gemini API Key 유출 대응 작업명세서 (R0)

* **작성일자:** 2026년 06월 08일
* **보고대상:** 신우밸브주식회사 품질보증부 전민재 차장님
* **작성자:** QMS AI 전담 비서 안티그래비티

---

## 📝 작업 체크리스트

- [ ] **Phase 1: Backend 개편**
  - [ ] `server.js`에 `/api/sync-sheets` 라우트 구현 및 `api/sync-sheets.js` 모듈 연동
  - [ ] 로컬 API 서버 기동 테스트 및 엔드포인트 도달 여부 확인
- [ ] **Phase 2: Frontend 개편**
  - [ ] `InboundHistory.jsx`에서 `VITE_GEMINI_API_KEY` 및 구글 직접 API fetch 코드 제거
  - [ ] `InboundHistory.jsx` 내의 `handleGoogleSync`가 로컬 및 Vercel의 `/api/sync-sheets`를 경유하도록 fetch 요청 코드 수정
  - [ ] `InboundHistory.jsx` 내의 `classifyDefectTypeWithGemini` 함수 삭제
- [ ] **Phase 3: 로컬 기능 통합 검증**
  - [ ] 로컬 JSON Server 및 Vite 개발 서버 구동
  - [ ] 브라우저에서 동기화 기동 시 에러 없이 Supabase에 반영되는지 확인
  - [ ] Network 탭에서 Gemini API Key 노출이 차단되었는지 확인 (서버 호출로 캡슐화 완료)
- [ ] **Phase 4: Git 히스토리 영구 정화 및 배포**
  - [ ] 로컬 저장소 전체 히스토리에서 `git filter-branch`를 통해 `.env.local.bak` 완전 소거
  - [ ] `staging` 및 `main` 브랜치에 각각 강제 푸시 (`git push origin --force --all`)
  - [ ] 원격 저장소 커밋 이력에서 유출 흔적 삭제 최종 검증 (GitHub Link 404 확인)
