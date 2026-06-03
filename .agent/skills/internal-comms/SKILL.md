---
name: internal-comms
description: A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).
license: Complete terms in LICENSE.txt
---

> [!IMPORTANT]
> **QMS v2 프로젝트 오버라이드 제약 사항**:
> 1. **저장경로**: `examples/` 및 default 저장경로 대신 `C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\안티그래비티\walkthrough\` 폴더에 `YYYY-MM-DD_[주제명]_R[N].md` 리비전 파일로 아카이빙한다.
> 2. **양식 및 언어**: 반드시 한글(한국어)로 작성하며, 완료보고 4대 표준 서식(① 반영 내역 요약, ② 반영 결과 요약, ③ 검증 계획 요약, ④ 검증 결과 요약)을 강력하게 준수한다.

## When to use this skill
To write internal communications, use this skill for:
- 3P updates (Progress, Plans, Problems)
- Company newsletters
- FAQ responses
- Status reports
- Leadership updates
- Project updates
- Incident reports

## How to use this skill

To write any internal communication:

1. **Identify the communication type** from the request
2. **Load the appropriate guideline file** from the `examples/` directory:
    - `examples/3p-updates.md` - For Progress/Plans/Problems team updates
    - `examples/company-newsletter.md` - For company-wide newsletters
    - `examples/faq-answers.md` - For answering frequently asked questions
    - `examples/general-comms.md` - For anything else that doesn't explicitly match one of the above
3. **Follow the specific instructions** in that file for formatting, tone, and content gathering

If the communication type doesn't match any existing guideline, ask for clarification or more context about the desired format.

## Keywords
3P updates, company newsletter, company comms, weekly update, faqs, common questions, updates, internal comms
