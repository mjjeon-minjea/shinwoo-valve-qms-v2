import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC_DIR  = 'C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\안티그래비티';
const WIKI_BASE = 'C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\.obsidian\\wiki';

// 폴더별 위키 대상 매핑
const FOLDER_MAP = {
  'plan':        'history',
  'task':        'history',
  'walkthrough': 'history',
  'report':      'synthesis',
};

function sanitizeFilename(str) {
  return str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').substring(0, 100);
}

function typeFromFolder(folder) {
  const map = {
    'plan':        '구현 계획서 (Implementation Plan)',
    'task':        '할 일 (Task)',
    'walkthrough': '작업 과정 (Walkthrough)',
    'report':      '보고서 (Report)',
  };
  return map[folder] || folder;
}

function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '2026-05-28';
}

function extractTitleFromContent(content) {
  // 첫 번째 # 헤딩 추출
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

let success = 0;

for (const [srcFolder, wikiFolder] of Object.entries(FOLDER_MAP)) {
  const srcPath = path.join(SRC_DIR, srcFolder);
  const destPath = path.join(WIKI_BASE, wikiFolder);

  if (!fs.existsSync(srcPath)) continue;
  if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });

  const files = fs.readdirSync(srcPath).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const fullSrc = path.join(srcPath, file);
    const content = fs.readFileSync(fullSrc, 'utf8').trim();

    const dateStr  = extractDateFromFilename(file);
    const titleFromH1 = extractTitleFromContent(content);
    const titleFromFile = file.replace(/\.md$/, '').replace(/_/g, ' ');
    const title = titleFromH1 || titleFromFile;
    const revMatch = file.match(/_R(\d+)\.md$/);
    const revision = revMatch ? `R${revMatch[1]}` : 'R0';

    const safeTitle = sanitizeFilename(file.replace(/\.md$/, ''));
    const destFilename = `AG_${srcFolder}_${safeTitle}.md`;
    const destFile = path.join(destPath, destFilename);

    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, "'")}"`,
      `type: "${typeFromFolder(srcFolder)}"`,
      `source_folder: "안티그래비티/${srcFolder}"`,
      `source_file: "${file}"`,
      `date: "${dateStr}"`,
      `revision: "${revision}"`,
      `author: "AI (Antigravity)"`,
      `wiki_status: done`,
      `tags: antigravity, ${srcFolder}, history, qms`,
      '---',
    ].join('\n');

    const wikiContent = `${frontmatter}\n\n${content}\n`;
    fs.writeFileSync(destFile, wikiContent, 'utf8');
    console.log(`✅ [${srcFolder}→${wikiFolder}] ${file}`);
    success++;
  }
}

console.log(`\n🎉 완료: ${success}개 파일 wiki화`);
console.log(`  wiki/history/ : plan, task, walkthrough`);
console.log(`  wiki/synthesis/ : report`);
