import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// 1. .env.local 환경변수 로드
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const SCHEMA_CACHE_PATH = path.join('.agent', 'logs', 'supabase_schema.json');
const LOG_PATH = path.join('.agent', 'logs', 'integration-check.tsv');

// 디렉토리 확보
const logsDir = path.join('.agent', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 공식 로거
const log = (msg) => console.log(`[시너지 센서] ${msg}`);
const logError = (msg) => console.error(`[시너지 에러] ❌ ${msg}`);

async function run() {
  log('원격 Supabase 통합 검증 및 경로 정합성 스캔을 가동합니다.');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logError('.env.local 파일에서 VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY를 찾을 수 없습니다.');
    process.exit(1);
  }

  // 2. 원격 Supabase 메타데이터 동적 수집 (PostgREST OpenAPI Spec 활용)
  let schemaData;
  let remoteTables = [];

  try {
    log('원격 Supabase API 메타데이터를 수집하는 중...');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
    }

    schemaData = await response.json();
    
    // 캐시 저장
    fs.writeFileSync(SCHEMA_CACHE_PATH, JSON.stringify(schemaData, null, 2), 'utf-8');
    log(`원격 스키마 메타데이터 캐시 완료 -> ${SCHEMA_CACHE_PATH}`);

    // OpenAPI Spec의 paths 키 값에서 테이블 이름 추출
    if (schemaData.paths) {
      remoteTables = Object.keys(schemaData.paths)
        .map(p => p.split('/')[1]) // 첫 번째 세그먼트 추출 (예: "/users" -> "users")
        .filter(p => p && p !== '');
      
      // 중복 및 특수 경로 제거
      remoteTables = [...new Set(remoteTables)];
    }
    
    log(`원격 Supabase 실물 테이블 감지 성공: [${remoteTables.join(', ')}]`);
  } catch (error) {
    logError(`원격 Supabase 연동에 실패하였습니다. 오프라인 캐시를 탐색합니다. 원인: ${error.message}`);
    
    // 오프라인 캐시 백업 활용
    if (fs.existsSync(SCHEMA_CACHE_PATH)) {
      log('기존에 캐시된 스키마 JSON 파일을 읽어 검증을 지속합니다.');
      const cached = JSON.parse(fs.readFileSync(SCHEMA_CACHE_PATH, 'utf-8'));
      if (cached.paths) {
        remoteTables = Object.keys(cached.paths)
          .map(p => p.split('/')[1])
          .filter(p => p && p !== '');
        remoteTables = [...new Set(remoteTables)];
      }
      log(`캐시에서 테이블 감지: [${remoteTables.join(', ')}]`);
    } else {
      logError('스키마 캐시 파일이 존재하지 않아 검증을 중단합니다.');
      process.exit(1);
    }
  }

  // 3. 프론트엔드 UI 컴포넌트(src/components/) 내의 api.fetch 호출부 스캔 (정밀 greedy 매칭)
  const componentsDir = path.join('src', 'components');
  if (!fs.existsSync(componentsDir)) {
    logError(`컴포넌트 디렉토리가 존재하지 않습니다: ${componentsDir}`);
    process.exit(1);
  }

  log('src/components/ 내 UI 소스 코드 스캔 중...');
  const files = getFilesRecursively(componentsDir);
  
  // 정밀 greedy 정규식: api.fetch('...') 혹은 api.fetch("...") 등에서 첫 번째 세그먼트만 추출
  // 예: api.fetch('/weekly_reports') -> 'weekly_reports'
  // 예: api.fetch('/inspections/batch') -> 'inspections'
  const regex = /api\.fetch\(\s*['"]\/([^/'"]+)/g;
  const scannedEndpoints = [];
  let mismatchCount = 0;

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf-8');
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const tableName = match[1];
      
      // 라인 수 계산
      const index = match.index;
      const lines = content.substring(0, index).split('\n');
      const lineNum = lines.length;

      scannedEndpoints.push({
        file: relativePath,
        line: lineNum,
        code: fullMatch,
        table: tableName
      });
    }
  }

  log(`총 ${scannedEndpoints.length}개의 api.fetch 호출 엔드포인트를 감지하였습니다.`);

  // 4. 테이블 정합성 교차 비교 검증
  const mismatches = [];

  for (const endpoint of scannedEndpoints) {
    // 예외 처리: 데이터베이스 테이블이 아닌 순수 API 엔드포인트가 있다면 기재
    // QMS v2의 경우, '/auth/' 나 '/api/' 등으로 시작하는 순수 라우팅 제외 처리 가능
    const reservedKeywords = ['auth', 'api', 'send-report', 'send-email'];
    if (reservedKeywords.includes(endpoint.table)) {
      continue;
    }

    if (!remoteTables.includes(endpoint.table)) {
      mismatches.push(endpoint);
      mismatchCount++;
      logError(`정합성 드리프트 감지! [${endpoint.file}:${endpoint.line}라인]`);
      console.error(`   - 감지된 코드: ${endpoint.code}`)
      console.error(`   - 파싱된 테이블: "${endpoint.table}" (원격 Supabase 상에 존재하지 않음)`);
    }
  }

  // 5. 검사 이력 append-only 로깅 (.agent/logs/integration-check.tsv)
  const timestamp = new Date().toISOString();
  const resultStatus = mismatchCount === 0 ? 'SUCCESS' : 'FAILURE';
  const logMsg = `${timestamp}\t${resultStatus}\tScanned: ${scannedEndpoints.length}\tMismatches: ${mismatchCount}\n`;
  
  fs.appendFileSync(LOG_PATH, logMsg, 'utf-8');

  // 6. 결과 처리 및 빌드 제어
  if (mismatchCount > 0) {
    logError(`통합 검증 실패! 총 ${mismatchCount}개의 테이블명 불일치 드리프트가 발견되었습니다.`);
    logError('실서버 DB 스키마가 로컬 프론트 코드와 일치하지 않습니다. 즉시 확인을 청구합니다.');
    
    // 기술적 한계 경고 표시
    console.warn('\n⚠️  [기술적 한계 명시]');
    console.warn('   src/lib/api.js는 동적 변수로 데이터베이스 테이블을 읽고 항상 select("*") 조회를');
    console.warn('   수행하므로, 개별 필드명 수준의 불일치(camelCase ↔ snake_case)는 정적 검증이 불가능합니다.');
    console.warn('   이 검증기는 실제 원격 테이블명의 존재 유무와 경로 오탈자 위주로 빌드를 통제합니다.\n');
    
    process.exit(1);
  } else {
    log('✅ 축하합니다! 모든 컴포넌트의 api.fetch 테이블 경로가 원격 Supabase 스키마와 100% 완벽히 일치합니다.');
    process.exit(0);
  }
}

// 재귀 파일 탐색 헬퍼
function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

run();
