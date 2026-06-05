const fs = require('fs');
const path = require('path');

const WIKI_DIR = 'C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\.obsidian\\wiki';

// 1. 모든 위키 마크다운 파일 탐색 (재귀)
function getMarkdownFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getMarkdownFiles(fullPath));
        } else if (file.endsWith('.md') && file !== 'index.md' && file !== 'log.md') {
            results.push(fullPath);
        }
    });
    return results;
}

const files = getMarkdownFiles(WIKI_DIR);
console.log(`총 ${files.length}개의 마크다운 파일을 스캔합니다.`);

// 2. 키워드 사전 만들기
const keywordMap = [];

// [수동 Alias 지정 - 위키링크의 촘촘함을 극대화]
const manualAliases = [
    { keyword: '게이트웨이 PC 및 미들웨어', target: 'history/2026-01-26_v0_1_0_게이트웨이_PC_&_미들웨어_구축_계획' },
    { keyword: '미들웨어 구축', target: 'history/2026-01-26_v0_1_0_게이트웨이_PC_&_미들웨어_구축_계획' },
    { keyword: 'InboundAnalysis', target: 'history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리' },
    { keyword: 'InboundHistory', target: 'history/2026-04-12_v0_24_0_[개발_노트]_v0.24.0_(P13)_-_Dashboard.jsx_컴포넌트_분리' },
    { keyword: 'V_QMS_INBOUND', target: 'history/2026-01-26_v0_1_0_게이트웨이_PC_&_미들웨어_구축_계획' },
    { keyword: 'V_QMS_PROCESS', target: 'history/2026-01-26_v0_1_0_게이트웨이_PC_&_미들웨어_구축_계획' },
    { keyword: 'V_ITEM_MASTER', target: 'history/2026-01-26_v0_1_0_게이트웨이_PC_&_미들웨어_구축_계획' },
    { keyword: '주간업무보고', target: 'history/2026-02-02_v0_6_0_주간_업무_보고_및_캘린더_기능_테스트_가이드' },
    { keyword: '인증 시스템', target: 'history/2026-03-19_v0_15_0_수파베이스_인증(Auth)_시스템_영구_폐기_및_구버전_롤백_플랜' },
    { keyword: 'Supabase 인증', target: 'history/2026-03-19_v0_15_0_수파베이스_인증(Auth)_시스템_영구_폐기_및_구버전_롤백_플랜' },
    { keyword: 'JWT', target: 'history/2026-04-03_v0_19_0_[인증_고도화_&_배포_파이프라인_구축]_JWT_기반_Supabase_Auth_전면_전환_및_역방향_승인_시스템_완성' },
    { keyword: '하네스', target: 'history/AG_plan_2026-05-27_QMS_v2_점진적_하네스_이식_기획안_R0' },
    { keyword: '하네스 엔지니어링', target: 'history/AG_plan_2026-05-27_QMS_v2_점진적_하네스_이식_기획안_R0' },
    { keyword: 'DNAS', target: 'history/2026-04-10_v0_23_0_[P12]_DNAS(개발자_노트_자동화_및_승인_시스템)_이식' },
    { keyword: '개발자 노트', target: 'history/2026-04-10_v0_23_0_[P12]_DNAS(개발자_노트_자동화_및_승인_시스템)_이식' },
    { keyword: '대시보드 UI', target: 'history/2026-01-30_v0_6_0_대시보드_UI_개선_계획' }
];

manualAliases.forEach(item => keywordMap.push(item));

files.forEach(filePath => {
    const relativePath = path.relative(WIKI_DIR, filePath);
    const baseName = path.basename(filePath, '.md');
    const targetLinkName = relativePath.replace(/\\/g, '/').replace('.md', '');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatterMatch = content.match(/^---([\s\S]+?)---/);
    let title = '';
    if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        const titleMatch = fm.match(/title:\s*"([^"]+)"/) || fm.match(/title:\s*([^\r\n]+)/);
        if (titleMatch) {
            title = titleMatch[1].trim();
        }
    }

    if (baseName.length > 5) {
        keywordMap.push({ keyword: baseName, target: targetLinkName });
    }
    
    const coreName = baseName.replace(/^\d{4}-\d{2}-\d{2}_(v\d+\.\d+\.\d+_)?(v\d+_\d+_\d+_)?(AG_(plan|task|walkthrough|report)_)?/, '');
    const cleanCoreName = coreName.replace(/_/g, ' ').trim();
    if (cleanCoreName.length > 3) {
        keywordMap.push({ keyword: cleanCoreName, target: targetLinkName });
        keywordMap.push({ keyword: coreName, target: targetLinkName });
    }

    if (title && title.length > 3) {
        keywordMap.push({ keyword: title, target: targetLinkName });
    }
});

keywordMap.sort((a, b) => b.keyword.length - a.keyword.length);

const uniqueKeywords = [];
const seen = new Set();
keywordMap.forEach(item => {
    const key = item.keyword.toLowerCase();
    if (!seen.has(key)) {
        seen.add(key);
        uniqueKeywords.push(item);
    }
});

console.log(`수집된 고유 키워드 개수: ${uniqueKeywords.length}개`);

// 3. 각 파일별 수정
files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    const origContent = content;
    
    // 3-1. YAML Frontmatter 태그 정규화
    content = content.replace(/tags:\s*([a-zA-Z0-9\-_]+(,\s*[a-zA-Z0-9\-_]+)*)\s*$/m, (match, tagStr) => {
        if (tagStr.startsWith('[') && tagStr.endsWith(']')) return match;
        const tags = tagStr.split(',').map(t => t.trim()).filter(Boolean);
        return `tags: [${tags.join(', ')}]`;
    });
    
    // 3-2. 본문 영역과 Frontmatter 분리
    let frontmatter = '';
    let body = content;
    const fmMatch = content.match(/^---([\s\S]+?)---([\s\S]*)$/);
    if (fmMatch) {
        frontmatter = `---${fmMatch[1]}---`;
        body = fmMatch[2];
    }
    
    // 3-3. 본문 내 위키링크 매핑
    const selfBaseName = path.basename(filePath, '.md');
    const linkTokens = [];
    let tokenIndex = 0;
    
    body = body.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
        const token = `__WIKILINK_TOKEN_${tokenIndex++}__`;
        linkTokens.push({ token, original: match });
        return token;
    });

    body = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        const token = `__MDLINK_TOKEN_${tokenIndex++}__`;
        linkTokens.push({ token, original: match });
        return token;
    });

    uniqueKeywords.forEach(item => {
        if (item.target.endsWith(selfBaseName)) return;
        
        const escapedKeyword = item.keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(?<![a-zA-Z0-9가-힣_\\-\\[\\]])(${escapedKeyword})(?![a-zA-Z0-9가-힣_\\-\\[\\]])`, 'g');
        
        body = body.replace(regex, (match, p1) => {
            return `[[${item.target}|${p1}]]`;
        });
    });

    for (let i = linkTokens.length - 1; i >= 0; i--) {
        body = body.replace(linkTokens[i].token, linkTokens[i].original);
    }
    
    const finalContent = frontmatter ? `${frontmatter}${body}` : body;
    
    if (finalContent !== origContent) {
        fs.writeFileSync(filePath, finalContent, 'utf8');
        console.log(`갱신 완료: ${path.basename(filePath)}`);
    }
});

console.log('위키 일괄 정제 및 크로스링크 구축 완료!');
