# 042 — 인수검사 구 화면 보관

플랜 042 P8(스테이징 이식, 2026-09-03)에서 인수검사 메뉴가
`inbound_overview` · `inbound_suppliers` · `inbound_items` · `inbound_records`
넷으로 바뀌면서 자리를 잃은 화면들이다. **지우지 않고 여기 둔다.**

| 파일 | 있던 자리 | 대신 쓰는 화면 |
|---|---|---|
| `InboundAnalysis.jsx` | `#inbound_analysis` | `InboundOverview` (`#inbound_overview`) |
| `InboundHistory.jsx` | `#inbound_history` | `InboundRecords` (`#inbound_records`) |
| `InspectionAnalysisDashboard.jsx` | `#inspection_analysis` · `/inspection-analysis` | `InboundOverview` |
| `NonConformanceStatus.jsx` | `#inbound_status` | `InboundItems` 의 「부적합 관리」 탭 |

구 주소 `#inbound_status` 와 `/inspection-analysis` 는 **살아 있다** —
각각 `InboundItems initialTab="ncr"` 와 `#inbound_overview` 로 넘어간다.

여기 있는 파일은 어디에서도 import 하지 않는다(시공 시 게이트 ③에서 0건 확인).
빌드에 들어가지 않으므로 놔둬도 번들이 커지지 않는다.
