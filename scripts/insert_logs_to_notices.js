import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NOTICES_TO_INSERT = [
  {
    title: "[업데이트] 신우밸브 QMS 시스템 최초 오픈 및 초기 세팅",
    type: "공지",
    author: "관리자",
    content: "신우밸브 QMS(품질관리 시스템) 기본 뼈대 구축 및 메인 포털 구조 세팅, 클라우드 기본 라우팅 구성 완료.",
    date: "2026-01-22"
  },
  {
    title: "[신규 기능] 주간업무보고 구현 및 인수검사 관리 기능 개설",
    type: "공지",
    author: "관리자",
    content: "부서원이 작성할 수 있는 주간업무보고 페이지 오픈. 더불어 외부 납품 자재의 인수검사 내역 관리 및 엑셀 연동 기반 구축.",
    date: "2026-02-04"
  },
  {
    title: "[시스템 패치] 1만 건 대용량 데이터 분할 삭제 처리(Batch) 시스템 적용",
    type: "공지",
    author: "관리자",
    content: "10,000건 이상의 대용량 검사 기록 삭제 시 발생하던 브라우저 멈춤 현상을 해결하기 위해 1,000건 단위 비동기 분할 삭제 최적화 코드를 적용했습니다.",
    date: "2026-02-09"
  },
  {
    title: "[업데이트] 공정검사 엑셀 업로드 고도화 및 세부 분석현황 오픈",
    type: "공지",
    author: "관리자",
    content: "MES 엑셀 출력본의 LOW DATA를 자동으로 필터링 및 '모델대분류' 등 정밀 매핑 적용. 조작 및 가시성을 위한 공정/설비/단위별 세부 분석 현황 신설.",
    date: "2026-03-12"
  },
  {
    title: "[업데이트] 공정검사 대시보드 리디자인 (100 PPM 반원 게이지 적용)",
    type: "공지",
    author: "관리자",
    content: "제공해주신 시안에 맞춰 KPI 카드 4종 신규 생성 및 100 PPM 목표치 기반 반원 도넛 게이지 차트로 전면 UI/UX 리디자인을 완료했습니다. 각 항목별로 경계/경고 식별이 용이해집니다.",
    date: "2026-03-14"
  },
  {
    title: "[시스템 점검] 전사 데이터베이스 100% 클라우드(Supabase) 이관 완료",
    type: "공지",
    author: "관리자",
    content: "로컬 서버에 고립되어 있던 기존 주간보고 및 검사기록 1만여 건을 Supabase 클라우드 데이터베이스로 100% 완전 동기화 및 마이그레이션 성공. 이제 외부 및 모바일, 100% 실서버(Vercel) 접속으로 모든 데이터의 열람이 보장됩니다.",
    date: "2026-03-15"
  }
];

async function insertNotices() {
  console.log('Inserting update notices to Supabase cloud...');
  
  for (let i = 0; i < NOTICES_TO_INSERT.length; i++) {
    const notice = {
      id: String(Date.now() + i),
      ...NOTICES_TO_INSERT[i]
    };
    
    const { data, error } = await supabase.from('notices').insert([notice]);
    if (error) {
      console.error(`Failed to insert notice '${notice.title}':`, error.message);
    } else {
      console.log(`Successfully added notice: ${notice.title}`);
    }
  }
  
  console.log('--- All notices completely added! ---');
}

insertNotices();
