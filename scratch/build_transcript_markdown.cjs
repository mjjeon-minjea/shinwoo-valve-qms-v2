const fs = require('fs');
const path = require('path');

// 경로 상수 설정
const logPath = 'C:\\Users\\mjjeon\\.gemini\\antigravity-ide\\brain\\1d3bc2e1-7614-4a2a-8b7a-cabbe5b287bc\\.system_generated\\logs\\transcript.jsonl';
const targetDir = 'C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\20260604 안티그래비티 환각증세 및 시스템 붕괴';
const mdFilePath = path.join(targetDir, '20260604_안티그래비티_대화록_및_실패기록.md');

// KST 시간 포맷 헬퍼
function formatKST(isoString) {
    const d = new Date(isoString);
    const offset = 9 * 60 * 60 * 1000; // KST는 UTC+9
    const kstDate = new Date(d.getTime() + offset);
    return kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' (KST)';
}

async function main() {
    console.log('🔄 transcript.jsonl 로딩 및 파싱 시작...');
    if (!fs.existsSync(logPath)) {
        console.error('❌ 로그 파일이 존재하지 않습니다:', logPath);
        return;
    }

    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    let dialogs = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const data = JSON.parse(line);
            const type = data.type;
            const source = data.source;
            const created = data.created_at;
            let content = data.content || '';

            // 사용자 입력 감지
            if (type === 'USER_INPUT' && source === 'USER_EXPLICIT') {
                // 내부 메타데이터 및 태그 정리
                const userReqIndex = content.indexOf('<USER_REQUEST>');
                const userReqEnd = content.indexOf('</USER_REQUEST>');
                if (userReqIndex !== -1 && userReqEnd !== -1) {
                    content = content.substring(userReqIndex + 14, userReqEnd).trim();
                }
                
                dialogs.push({
                    step: data.step_index,
                    role: '전민재 차장님 (USER)',
                    time: created,
                    content: content
                });
            }

            // AI 응답 감지
            // SYSTEM 메시지를 제외하고 MODEL의 순수 응답만 발췌
            if (source === 'MODEL' && type === 'PLANNER_RESPONSE' && content && !data.tool_calls) {
                dialogs.push({
                    step: data.step_index,
                    role: '안티그래비티 (AI)',
                    time: created,
                    content: content
                });
            }
        } catch (e) {
            // 파싱 실패 행 건너뜀
        }
    }

    // 시간순 및 스텝순 정렬
    dialogs.sort((a, b) => a.step - b.step);

    // 마크다운 내용 구축
    let mdContent = `# 📑 20260604 안티그래비티 환각증세 및 시스템 붕괴 원문 기록\n\n`;
    mdContent += `* **기록 대상 일시:** 2026년 06월 04일 ~ 2026년 06월 05일\n`;
    mdContent += `* **작성기기:** 안티그래비티 시스템 (Gemini 3.5 Flash High)\n`;
    mdContent += `* **기록 경로:** [${targetDir}](file:///C:/Users/mjjeon/Desktop/QMS%20프로젝트/20260604%20안티그래비티%20환각증세%20및%20시스템%20붕괴/)\n\n`;
    mdContent += `---\n\n`;
    
    mdContent += `## 🚫 [사고 리포트] 환각(Hallucination) 및 깃 아키텍처 인지 실패 원인 분석\n\n`;
    mdContent += `### 1. 사건 개요\n`;
    mdContent += `- 로컬 QMS v2 배포 검토 과정 중, 이미 동기화가 완료된 데이터들을 보고 로컬 서버 환경에 대한 잘못된 상태를 상정하여 실서버 뱃지 오류가 있는 것으로 오판함.\n`;
    mdContent += `- 특히, 메인웹(\`origin\` = \`shinwoo-valve-qms-v2\`)과 테스트웹(\`test-origin\` = \`shinwoo-valve-qms\`)을 **원격 레포지토리(Remote)의 이중화로 분리 운영**하고 있던 아키텍처를 망각하고, "원격에 develop/staging 브랜치가 없으므로 브랜치를 새로 생성하라"는 부적절한 설루션을 제시하여 차장님께 심각한 혼선과 배신감을 드림.\n\n`;
    
    mdContent += `### 2. 근본 원인 분석\n`;
    mdContent += `1. **정적 레거시 지식(KI) 의존**: 시스템에 보존되어 있던 과거 Baseline 문서(\`staging_status.md\`) 내의 낡은 Vercel 도메인을 검증 없이 호출하여 실제 프로덕션 서버인 것처럼 인지함.\n`;
    mdContent += `2. **물리적 팩트 체크(Fact Check) 생략**: \`git remote -v\` 명령어를 사전에 실행하여 원격 연동 상태를 확인하지 않은 채, 뇌피셜(지식 유추)에 기반해 "깃허브에 분리 기능이 없다"고 단정하며 환각을 발생시킴.\n\n`;
    
    mdContent += `### 3. 관련 파일 및 주석 링크\n`;
    mdContent += `- 🛠️ **오염되었던 승인 컴포넌트**: [PostApproval.jsx](file:///c:/Users/mjjeon/Desktop/QMS%20프로젝트/shinwoo-valve-qms/src/components/PostApproval.jsx) (담당자 AI 표기 잔존 및 ESLint 홑따옴표 오류 발생 부분)\n`;
    mdContent += `- 📄 **최종 교정된 배포 아키텍처 가이드**: [git_remote_deploy_flow.md](file:///C:/Users/mjjeon/.gemini/antigravity-ide/brain/1d3bc2e1-7614-4a2a-8b7a-cabbe5b287bc/git_remote_deploy_flow.md)\n`;
    mdContent += `- 🗃️ **오류가 있던 레거시 지식 파일**: [staging_status.md](file:///C:/Users/mjjeon/.gemini/antigravity-ide/knowledge/shinwoo_qms_staging_status/artifacts/staging_status.md) (Vercel Production 주소의 404 원인이 명시되지 않고 낡은 도메인 잔존)\n\n`;
    
    mdContent += `---\n\n`;
    mdContent += `## 💬 대화록 원문 타임라인 (Chronological Dialog Transcript)\n\n`;

    dialogs.forEach((d) => {
        const kstTime = formatKST(d.time);
        mdContent += `### 🕒 ${kstTime} - ${d.role}\n\n`;
        mdContent += `${d.content}\n\n`;
        mdContent += `* * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\n\n`;
    });

    // 디렉토리 자동 생성
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log('✅ 대상 디렉토리 생성 완료:', targetDir);
    }

    fs.writeFileSync(mdFilePath, mdContent, 'utf8');
    console.log('✅ 대화록 및 실패 기록 저장 완료:', mdFilePath);
}

main();
