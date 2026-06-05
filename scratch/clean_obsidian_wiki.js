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
// 키워드는 각 파일의 파일명 본체(BaseName) 및 날짜/버전 제거명, 그리고 title
const keywordMap = [];

files.forEach(filePath => {
    const relativePath = path.relative(WIKI_DIR, filePath);
    const baseName = path.basename(filePath, '.md');
    
    // 상대 경로 상의 폴더 구조를 고려한 위키 링크 타겟 (예: history/파일명)
    const targetLinkName = relativePath.replace(/\\/g, '/').replace('.md', '');
    
    // Frontmatter 파싱하여 title 획득
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

    // 2-1. BaseName 등록
    if (baseName.length > 5) {
        keywordMap.push({ keyword: baseName, target: targetLinkName });
    }
    
    // 2-2. 날짜/버전 뗀 핵심 이름 추출 (예: 2026-01-26_v0_1_0_게이트웨이_PC_&_미들웨어_구축_계획 -> 게이트웨이_PC_&_미들웨어_구축_계획)
    const coreName = baseName.replace(/^\d{4}-\d{2}-\d{2}_(v\d+\.\d+\.\d+_)?(v\d+_\d+_\d+_)?(AG_(plan|task|walkthrough|report)_)?/, '');
    const cleanCoreName = coreName.replace(/_/g, ' ').trim();
    if (cleanCoreName.length > 3) {
        keywordMap.push({ keyword: cleanCoreName, target: targetLinkName });
        keywordMap.push({ keyword: coreName, target: targetLinkName });
    }

    // 2-3. title 등록
    if (title && title.length > 3) {
        keywordMap.push({ keyword: title, target: targetLinkName });
    }
});

// 키워드 길이 내림차순 정렬 (긴 키워드가 먼저 치환되도록)
keywordMap.sort((a, b) => b.keyword.length - a.keyword.length);

// 중복 키워드 제거
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
    // 예: tags: dev-notes, history, qms, plan -> tags: [dev-notes, history, qms, plan]
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
    
    // 치환 대상 텍스트 보호를 위해 기존 링크들을 임시 토큰으로 변경
    const linkTokens = [];
    let tokenIndex = 0;
    
    // 기존 wikilink [[...]] 보호
    body = body.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
        const token = `__WIKILINK_TOKEN_${tokenIndex++}__`;
        linkTokens.push({ token, original: match });
        return token;
    });

    // 기존 md link [...] (file://...) 보호
    body = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        const token = `__MDLINK_TOKEN_${tokenIndex++}__`;
        linkTokens.push({ token, original: match });
        return token;
    });

    // 키워드 치환 실행
    uniqueKeywords.forEach(item => {
        // 자기 자신으로 향하는 링크는 생략
        if (item.target.endsWith(selfBaseName)) return;
        
        // 정규식 이스케이프
        const escapedKeyword = item.keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        
        // 한글/영문 키워드 앞뒤로 토큰이나 다른 괄호, 단어 문자가 오지 않는 조건
        const regex = new RegExp(`(?<![a-zA-Z0-9가-힣_\\-\\[\\]])(${escapedKeyword})(?![a-zA-Z0-9가-힣_\\-\\[\\]])`, 'g');
        
        body = body.replace(regex, (match, p1) => {
            return `[[${item.target}|${p1}]]`;
        });
    });

    // 보호했던 링크 복원
    for (let i = linkTokens.length - 1; i >= 0; i--) {
        body = body.replace(linkTokens[i].token, linkTokens[i].original);
    }
    
    // 최종 결합
    const finalContent = frontmatter ? `${frontmatter}${body}` : body;
    
    if (finalContent !== origContent) {
        fs.writeFileSync(filePath, finalContent, 'utf8');
        console.log(`갱신 완료: ${path.basename(filePath)}`);
    }
});

console.log('위키 일괄 정제 및 크로스링크 구축 완료!');
