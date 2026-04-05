import fs from 'fs';
import path from 'path';

const folder = "C:\\Users\\mjjeon\\Desktop\\QMS 프로젝트\\shinwoo-valve-qms\\MES DATA\\shinwoo-valve-qms_SQL Editor";
const files = fs.readdirSync(folder).filter(f => f.endsWith('.txt') || f.endsWith('.sql'));

let out = "-- ==================================================================\n";
out += "-- [안티그래비티] 상용 DB SQL 27개 스니펫 초거대 마스터 병합본\n";
out += "-- 이 파일 하나를 복사해서 Staging SQL Editor에 넣고 RUN 하시면 27개 소스가 모두 폭격됩니다.\n";
out += "-- ==================================================================\n\n";

for(const file of files) {
  out += `-- ========== 파일명: ${file.replace('.txt', '')} ==========\n`;
  out += fs.readFileSync(path.join(folder, file), 'utf8') + "\n\n";
}

fs.writeFileSync('scripts/MERGED_27_QUERIES.sql', out, 'utf8');
console.log("통합 성공!");
