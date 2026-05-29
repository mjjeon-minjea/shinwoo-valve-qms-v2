import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Node.js 환경변수 로드
dotenv.config({ path: './.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

// Supabase 관리자 클라이언트 생성 (RLS 우회 및 무제한 CRUD 수행)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 로컬 검증 단계(STAGE 1)용 가상 Mock CSV 데이터 (구글 시트가 없을 때의 폴백)
const MOCK_CSV = `품목번호,제품명,입고일,업체명,입고,검사(함수),부적합,인수검사 보고서 번호,업태(함수),부적합 유형
ITEM-SW-V01,게이트밸브 100A,2026-05-29,강남금속,150,150,2,SR-20260529-001,외주가공,주물치수부적합
ITEM-SW-V02,글로브밸브 50A,2026-05-29,신우산업,80,80,0,SR-20260529-002,주물류,
ITEM-SW-V03,체크밸브 80A,2026-05-29,한성정밀,120,120,5,SR-20260529-003,외주가공,흠집 및 도장 불량
ITEM-SW-V04,스트레이너 65A,2026-05-29,삼영금속,200,200,3,SR-20260529-004,주물류,주물부적합
ITEM-SW-V05,감압밸브 40A,2026-05-29,신우정밀,50,50,1,SR-20260529-005,외주가공,나사산 가공 오류
ITEM-SW-V06,버터플라이밸브 150A,2026-05-29,동양금속,90,90,4,SR-20260529-006,외주가공,조립 뻑뻑함`;

// Vercel Serverless Function 핸들러
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('[Sync Engine] Starting Google Sheets Synchronization...');
  const logs = [];
  const log = (msg) => {
    console.log(`[Sync Engine] ${msg}`);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    let csvData = '';
    const sheetUrl = process.env.GOOGLE_SHEETS_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz-OGELs_8JhV7Vrf14kdF8rrdx-VdcJXLAAc-Tr2FvdC32E4Flol7QeMoJbCVnr32SOpCX5kDsZPo/pub?gid=2043099098&single=true&output=csv";

    if (sheetUrl) {
      log(`Fetching remote Google Sheet CSV from URL...`);
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet. Status: ${response.status}`);
      }
      csvData = await response.text();
      log(`Remote CSV load success. Byte size: ${csvData.length}`);
    } else {
      log(`[WARNING] GOOGLE_SHEETS_CSV_URL is empty! Falling back to Local Mock CSV for simulation.`);
      csvData = MOCK_CSV;
    }

    // 간단하고 강력한 CSV 파서 구현 (따옴표 내 쉼표 보존)
    const rows = parseCSV(csvData);
    log(`Parsed ${rows.length} rows from CSV.`);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, message: 'CSV에 데이터가 존재하지 않습니다.', logs });
    }

    // 1단계: 비정형 부적합 유형 분류를 위해 Gemini API용 대상 추출
    const uniqueDefectTypes = [...new Set(rows.map(r => r['부적합 유형'] || '').filter(val => val.trim() !== ''))];
    log(`Found ${uniqueDefectTypes.length} unique non-empty defect types to analyze.`);

    // Gemini 매핑 사전 구축
    const defectCategoryMap = {};
    
    // 빈 문자열이나 공란은 즉시 '합격' 처리 (Gemini API 호출 절약)
    defectCategoryMap[''] = '합격';

    if (uniqueDefectTypes.length > 0) {
      log(`Invoking Gemini 2.5 Flash content generation for standard category mapping...`);
      for (const originalType of uniqueDefectTypes) {
        const standardCategory = await classifyDefectTypeWithGemini(originalType, log);
        defectCategoryMap[originalType] = standardCategory;
        log(`Mapping resolved: "${originalType}" ➔ "${standardCategory}"`);
      }
    }

    // 2단계: 데이터 가공 및 Supabase Upsert 리스트 생성
    const inspectionsToUpsert = rows.map((row, index) => {
      const supplier = (row['업체명'] || '').trim();
      const itemName = (row['제품명'] || '').trim();
      const date = (row['입고일'] || '').trim();
      const totalQuantity = parseInt((row['입고'] || '0').replace(/,/g, ''), 10);
      const inspectionQuantity = parseInt((row['검사(함수)'] || '0').replace(/,/g, ''), 10);
      const defectQuantity = parseInt((row['부적합'] || '0').replace(/,/g, ''), 10);
      const inspectionReportNo = (row['인수검사 보고서 번호'] || '없음').trim();
      const itemType = (row['업태(함수)'] || '외주가공').trim();
      const originalDefectType = (row['부적합 유형'] || '').trim();
      const itemCode = (row['품목번호'] || '').trim();

      const rawId = `${supplier}_${itemName}_${date}_${totalQuantity}`;
      const hashPart = Buffer.from(rawId).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      const safeId = `${hashPart}_${index}`;

      // Gemini 분류 맵에서 카테고리 획득
      const defectCategory = defectCategoryMap[originalDefectType] || '합격';

      return {
        id: safeId,
        date: date || new Date().toISOString().split('T')[0],
        supplier: supplier || '미지정업체',
        itemName: itemName || '미지정제품',
        totalQuantity: isNaN(totalQuantity) ? 0 : totalQuantity,
        inspectionQuantity: isNaN(inspectionQuantity) ? 0 : inspectionQuantity,
        defectQuantity: isNaN(defectQuantity) ? 0 : defectQuantity,
        result: defectQuantity > 0 ? '불합격' : '합격',
        defectType: originalDefectType ? `[${defectCategory}] ${originalDefectType}` : '',
        inspectionReportNo: inspectionReportNo || '없음',
        itemType: itemType || '외주가공',
        item_code: itemCode // 추가된 신규 컬럼 (차장님 DDL 마이그레이션 필요)
      };
    });

    log(`Upserting ${inspectionsToUpsert.length} records into Supabase "inspections" table...`);

    // Supabase Upsert 쿼리 가동 (중복 키는 UPDATE 처리)
    const { data, error } = await supabase
      .from('inspections')
      .upsert(inspectionsToUpsert, { onConflict: 'id' });

    if (error) {
      // 만약 'item_code' 컬럼이 DB 스키마에 없어서 42703 에러가 날 경우, 
      // 예외 대응으로 item_code 컬럼을 뺀 안전본으로 2차 Upsert를 롤백 수행합니다. (피드백 루프 작동)
      if (error.code === '42703') {
        log(`[EMERGENCY ROLLBACK] Column "item_code" does not exist! Running secondary fallback sync...`);
        const fallbackInspections = inspectionsToUpsert.map(item => {
          const cleanItem = { ...item };
          // 임시방편: item_code가 없으므로 inspectionReportNo 필드 뒤에 품목번호를 병합 저장하여 데이터를 보존함
          if (cleanItem.item_code) {
            cleanItem.inspectionReportNo = `${cleanItem.inspectionReportNo} [품목:${cleanItem.item_code}]`;
          }
          delete cleanItem.item_code;
          return cleanItem;
        });

        const { error: fallbackError } = await supabase
          .from('inspections')
          .upsert(fallbackInspections, { onConflict: 'id' });

        if (fallbackError) {
          throw new Error(`Fallback sync failed: ${fallbackError.message}`);
        }
        log(`[SUCCESS] Emergency fallback sync completed without schema error.`);
      } else {
        throw error;
      }
    } else {
      log(`Supabase batch Upsert successfully completed.`);
    }

    return res.status(200).json({
      success: true,
      message: '구글 스프레드시트 동기화 완수 완료',
      processedCount: inspectionsToUpsert.length,
      logs
    });

  } catch (error) {
    console.error('[Sync Engine Error]', error);
    log(`[ERROR] Sync aborted: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: '구글 동기화 엔진 장애 발생',
      error: error.message,
      logs
    });
  }
}

// 쉼표와 큰따옴표가 꼬여있는 정규화 CSV 파서
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= 1) return [];

  // 헤더 추출 및 청소 (BOM 문자거르기)
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    if (row['제품명'] || row['업체명']) {
      results.push(row);
    }
  }

  return results;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Gemini 2.5 Flash API 활용 비정형 카테고리 태깅 엔진
async function classifyDefectTypeWithGemini(defectType, log) {
  if (!GEMINI_API_KEY) {
    log(`[WARNING] Gemini API key is missing. Assigning fallback: "기타"`);
    return '기타';
  }

  // 1회 크론 한계 및 Few-shot 6 주물부적합 완벽 보완 프롬프트
  const systemInstruction = `너는 신우밸브주식회사 품질보증부의 인수검사 데이터 정제 전문가이다.
제공되는 입고/검사 데이터의 [부적합 유형] 텍스트를 정밀 분석하여, 아래 정의된 JSON 스키마 규격에 맞춰 정확히 매핑된 데이터만을 반환해야 한다. 절대 설명이나 마크다운 태그를 붙이지 말고 순수 JSON만 반환하라.

[부적합 유형(defectCategory) 매핑 규칙]
- 외관 불량, 흠집, 도장 불량, 사출 들뜸, 외관부적합 ➔ "외관부적합"
- 나사산 가공 불량, 리머 가공 오류, 홀 누락, 조립부 가공 오차, 가공부적합 ➔ "가공부적합"
- 치수 미달, 공차 초과, 금형 변형, 주물치수부적합, 주물부적합, 주물 부적합 ➔ "주물치수부적합"
- 조립 뻑뻑함, 부품 누락, 유격 오류, 조립부적합 ➔ "조립부적합"
- 재질 상이, 성적서 불일치, 인장 강도 미달, 재질부적합 ➔ "재질부적합"
- 해당 없음, 합격, 빈 문자열 또는 공란 ➔ "합격"
- 그 외 어떤 매핑 규칙에도 속하지 않는 경우 ➔ "기타"`;

  const fewShots = [
    { input: '주물 치수 부적합', output: '주물치수부적합' },
    { input: '가공부적합', output: '가공부적합' },
    { input: '외관부적합', output: '외관부적합' },
    { input: '사출 들뜸', output: '외관부적합' },
    { input: '', output: '합격' },
    { input: '주물부적합', output: '주물치수부적합' } // Few-shot 6번 주물부적합 완벽 매핑 강제
  ];

  const fewShotPrompt = fewShots.map(f => `입력: "${f.input}" ➔ 출력 JSON: {"defectCategory": "${f.output}"}`).join('\n');
  const userPrompt = `아래 입력 텍스트를 분류하여 JSON으로만 대답해라.
---
입력: "${defectType}"`;

  const fullPrompt = `${systemInstruction}\n\n[입출력 예시 (Few-shot)]\n${fewShotPrompt}\n\n${userPrompt}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini status code error: ${response.status}`);
    }

    const resJson = await response.json();
    const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    const result = JSON.parse(cleanText);
    if (result && result.defectCategory) {
      return result.defectCategory;
    }
    return '기타';
  } catch (err) {
    log(`[ERROR] Gemini classification failed for "${defectType}": ${err.message}`);
    // 안전한 폴백: 텍스트에 포함된 단어를 기준으로 1차 자체 매핑 시도
    const text = defectType.toLowerCase();
    if (text.includes('외관') || text.includes('도장') || text.includes('흠집') || text.includes('사출')) return '외관부적합';
    if (text.includes('가공') || text.includes('나사') || text.includes('리머') || text.includes('홀')) return '가공부적합';
    if (text.includes('치수') || text.includes('공차') || text.includes('금형') || text.includes('주물')) return '주물치수부적합';
    if (text.includes('조립') || text.includes('뻑뻑') || text.includes('유격')) return '조립부적합';
    if (text.includes('재질') || text.includes('성적') || text.includes('강도')) return '재질부적합';
    return '기타';
  }
}
