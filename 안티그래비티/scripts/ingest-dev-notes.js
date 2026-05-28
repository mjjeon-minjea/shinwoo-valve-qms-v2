import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC_JSON = 'C:\\Users\\mjjeon\\Downloads\\dev_notes_rows.json';
const WIKI_DIR = 'C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\.obsidian\\wiki\\history';

// 파일명으로 사용할 수 없는 문자 제거
function sanitizeFilename(str) {
  return str
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}

// 날짜 문자열 정규화 (YYYY-MM-DD)
function normalizeDate(dateStr) {
  if (!dateStr) return 'unknown';
  // "2026-04-12-00:46" → "2026-04-12"
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateStr.substring(0, 10);
}

// type을 카테고리 태그로 변환
function typeToTag(type) {
  const map = {
    '구현 계획서 (Implementation Plan)': 'plan',
    '작업 과정 (Walkthrough)': 'walkthrough',
    '할 일 (Task)': 'task',
    '시스템 아키텍처 (Architecture)': 'architecture',
    '데이터 정화 (Cleanup)': 'cleanup',
    '개발자 노트': 'dev-note',
    'Minor (UI/UX)': 'ui-ux',
    'Major': 'major',
    'Patch': 'patch',
  };
  for (const [key, val] of Object.entries(map)) {
    if (type && type.includes(key)) return val;
  }
  return type ? type.toLowerCase().replace(/\s+/g, '-') : 'note';
}

function main() {
  // wiki/history 디렉토리 생성
  if (!fs.existsSync(WIKI_DIR)) {
    fs.mkdirSync(WIKI_DIR, { recursive: true });
  }

  const raw = fs.readFileSync(SRC_JSON, 'utf8');
  const entries = JSON.parse(raw);

  console.log(`📦 총 ${entries.length}개 항목 인제스트 시작...\n`);

  let success = 0;
  let skipped = 0;

  for (const entry of entries) {
    const {
      id, title, content, version, status,
      author, date, type, source, created_at, updated_at
    } = entry;

    const normalDate = normalizeDate(date);
    const safeTitle = sanitizeFilename(title || 'untitled');
    const safeVersion = (version || 'v0.0.0').replace(/\./g, '_');
    const filename = `${normalDate}_${safeVersion}_${safeTitle}.md`;
    const filepath = path.join(WIKI_DIR, filename);

    // YAML frontmatter
    const frontmatter = [
      '---',
      `title: "${(title || '').replace(/"/g, "'")}"`,
      `type: "${type || ''}"`,
      `version: "${version || ''}"`,
      `date: "${normalDate}"`,
      `author: "${author || '시스템 AI'}"`,
      `status: "${status || 'published'}"`,
      `source: "${source || 'manual'}"`,
      `source_id: "${id}"`,
      `created_at: "${(created_at || '').substring(0, 10)}"`,
      `updated_at: "${(updated_at || '').substring(0, 10)}"`,
      `wiki_status: done`,
      `tags: dev-notes, history, qms, ${typeToTag(type)}`,
      '---',
    ].join('\n');

    const body = (content || '').trim();
    const fullContent = `${frontmatter}\n\n# ${title}\n\n${body}\n`;

    fs.writeFileSync(filepath, fullContent, 'utf8');
    success++;
    console.log(`✅ [${version}] ${title.substring(0, 50)}`);
  }

  console.log(`\n🎉 완료: ${success}개 생성 / ${skipped}개 건너뜀`);
  console.log(`📂 저장 위치: ${WIKI_DIR}`);
}

main();
