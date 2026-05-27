import fs from 'fs';
import path from 'path';

// 모니터링할 루트 감시 디렉토리 정의
const WATCH_ZONES = [
  { name: 'Source Code', dir: 'src' },
  { name: 'AI Skills', dir: path.join('.agent', 'skills') },
  { name: 'AI Rules', dir: path.join('.agent', 'rules') }
];

// 오염 파일 감지용 블랙리스트 패턴 (정규식)
const DIRT_PATTERNS = [
  /^temp_.+/i,         // temp_로 시작하는 임시 파일
  /.+_backup$/i,       // _backup으로 끝나는 폴더/파일
  /test_violation/i,   // 테스트 위반용 파일
  /temp_mismatch/i,    // 테스트 불일치용 파일
  /.*\.tmp$/i,         // .tmp 임시 파일 확장자
  /.*~$/i              // 스왑 파일
];

const log = (msg) => console.log(`[가비지 센서] ${msg}`);
const logWarning = (msg) => console.warn(`[⚠️ 오염 경고] ${msg}`);

function checkStructure() {
  log('프로젝트 구조 드리프트 및 오염 파일 정밀 조사를 개시합니다.');
  
  let totalDirtyCount = 0;
  const dirtyFiles = [];

  for (const zone of WATCH_ZONES) {
    if (!fs.existsSync(zone.dir)) {
      log(`감시 대상 경로가 존재하지 않아 건너뜁니다: ${zone.dir}`);
      continue;
    }

    log(`"${zone.name}" 구역 스캔 중... (${zone.dir})`);
    const files = getFilesRecursively(zone.dir);

    for (const file of files) {
      const filename = path.basename(file);
      const isDirty = DIRT_PATTERNS.some(pattern => pattern.test(filename));

      if (isDirty) {
        const relativePath = path.relative(process.cwd(), file);
        dirtyFiles.push(relativePath);
        totalDirtyCount++;
      }
    }
  }

  // 결과 출력 및 에스컬레이션 제어
  if (totalDirtyCount > 0) {
    logWarning(`프로젝트에서 총 ${totalDirtyCount}개의 오염 및 구조 드리프트 파일이 감지되었습니다!`);
    console.log('\n--------------------------------------------------');
    console.log('🚨 [정리 대기 오염 파일 목록]');
    dirtyFiles.forEach((file, index) => {
      console.log(`  [${index + 1}] ${file}`);
    });
    console.log('--------------------------------------------------\n');

    console.warn('⚠️  [하네스 오작동 제어 행동 강령]');
    console.warn('   1. 에이전트는 감지된 오염 파일을 독단적으로 자동 삭제할 수 없습니다 (자동 삭제 기능 폐지).');
    console.warn('   2. 이 목록을 전민재 차장님께 보고하고 "수동 삭제 승인 청구"를 진행하십시오.');
    console.warn('   3. 승인을 획득한 후에만 PowerShell 문법 "Remove-Item"을 대행 실행하여 정리할 수 있습니다.\n');
    
    // 드리프트 존재 시 경고를 위해 exit 1 처리
    process.exit(1);
  } else {
    log('✅ 무결점 완료! 오염 파일이나 드리프트가 발견되지 않은 깨끗한 아키텍처 구조를 유지하고 있습니다.');
    process.exit(0);
  }
}

// 재귀 폴더/파일 탐색 헬퍼 (모든 파일 및 폴더 감시)
function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      // 디렉토리명 자체도 오염 패턴에 매칭될 수 있으므로 탐색에 포함
      results.push(filePath);
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

checkStructure();
