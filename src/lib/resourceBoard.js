// 자료실 게시판 화면이 쓰는 순수 함수 모음 — React·서버 호출 없음(서버 연결은 resourceFiles.js).
// 화면은 이름(구분·업무)만 다루고, 서버가 요구하는 영문 키는 여기서 자동으로 채운다.

export const DEFAULT_CATEGORIES = [
    ['manual', '매뉴얼'], ['procedure', '절차서'], ['instruction', '지침서'],
    ['form', '양식'], ['standard', '규격']
];
export const COMMON_MODULE = '전사 공통';
export const DEFAULT_MODULES = [['common', COMMON_MODULE]];
export const FIRST_NOTE = '최초 등록';
export const NEW_OPTION = '__new__'; // 고르기 목록의 「직접 입력…」
const FRESH_MS = 14 * 24 * 60 * 60 * 1000;

const clean = (value) => String(value ?? '').trim();
const byNewest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));

/** 고르기 목록 [{ key, label }] — 지금 있는 것(이름→키)이 먼저, 기본값은 같은 이름·같은 키가 없을 때만 더한다. */
export const mergeOptions = (rows, keyField, labelField, defaults) => {
    const keyByLabel = new Map();
    for (const row of rows || []) {
        const key = clean(row?.[keyField]);
        const label = clean(row?.[labelField]);
        if (key && label && !keyByLabel.has(label)) keyByLabel.set(label, key);
    }
    const usedKeys = new Set(keyByLabel.values());
    for (const [key, label] of defaults) {
        if (!keyByLabel.has(label) && !usedKeys.has(key)) keyByLabel.set(label, key);
    }
    // 보기 순서: 기본값 순서 → 그 밖의 이름(가나다)
    const rank = (label) => {
        const index = defaults.findIndex(([, name]) => name === label);
        return index < 0 ? defaults.length : index;
    };
    return [...keyByLabel].map(([label, key]) => ({ key, label }))
        .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, 'ko'));
};
export const categoryOptions = (rows) => mergeOptions(rows, 'category', 'category_label', DEFAULT_CATEGORIES);
export const moduleOptions = (rows) => mergeOptions(rows, 'module', 'module_label', DEFAULT_MODULES);

/** 이름의 영문 키: 같은 이름이 이미 있으면 그 키, 없으면 접두(c=구분·m=업무)-base36 시각. */
export const keyForLabel = (options, label, prefix, now = Date.now()) =>
    options.find(option => option.label === clean(label))?.key || `${prefix}-${Number(now).toString(36)}`;

/** 새 자료의 문서 키: d + YYYYMMDD + - + base36 난수 6자. 이미 쓰는 키와 겹치면 다시 뽑는다(남의 자료에 판이 붙지 않게). */
export const newDocKey = ({ taken = [], now = new Date(), random = Math.random } = {}) => {
    const date = new Date(now);
    const ymd = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(part => String(part).padStart(2, '0')).join('');
    const used = new Set(taken);
    let key;
    do {
        key = `d${ymd}-${random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    } while (used.has(key));
    return key;
};

const picked = (choice, typed) => clean(choice === NEW_OPTION ? typed : choice);

/**
 * 올리는 창의 입력 → 서버에 보낼 draft.
 * - 영수증이 있으면(발행 실패 뒤 다시 누름) 처음 보낸 입력을 그대로 돌려준다.
 *   자동 키를 다시 만들면 영수증과 달라져 올려 둔 파일을 재사용하지 못한다.
 * - form.base 가 있으면 새 판: 원 자료의 업무·구분·문서 키·이름을 그대로 쓴다.
 * - 없으면 새 자료: 키는 전부 자동, 바뀐 점은 「최초 등록」.
 */
export const buildDraft = (form, { receipt = null, categories = [], modules = [], takenDocKeys = [], now = new Date(), random = Math.random } = {}) => {
    if (receipt?.immutable) {
        const { module, moduleLabel, category, categoryLabel, docKey, title, description, sourceRef, revisionNote } = receipt.immutable;
        return { module, moduleLabel, category, categoryLabel, docKey, title, description, sourceRef, revisionNote };
    }
    const shared = { title: clean(form.title), description: String(form.description ?? ''), sourceRef: clean(form.sourceRef) };
    if (form.base) {
        const { module, module_label: moduleLabel, category, category_label: categoryLabel, doc_key: docKey } = form.base;
        return { module, moduleLabel, category, categoryLabel, docKey, ...shared, revisionNote: clean(form.revisionNote) };
    }
    const stamp = new Date(now).getTime();
    const categoryLabel = picked(form.category, form.categoryNew);
    const moduleLabel = picked(form.module, form.moduleNew);
    return {
        module: keyForLabel(modules, moduleLabel, 'm', stamp), moduleLabel,
        category: keyForLabel(categories, categoryLabel, 'c', stamp), categoryLabel,
        docKey: newDocKey({ taken: takenDocKeys, now, random }),
        ...shared, revisionNote: FIRST_NOTE
    };
};

/** 빠진 필수 입력을 쉬운 말로(없으면 빈 문자열). 새 판은 바뀐 점이 필수. */
export const draftProblem = (draft, isRevision = false) => {
    if (!draft.categoryLabel) return '구분을 입력하세요.';
    if (!draft.moduleLabel) return '업무를 입력하세요.';
    if (!draft.title) return '자료명을 입력하세요.';
    return isRevision && !clean(draft.revisionNote) ? '바뀐 점을 입력하세요.' : '';
};

/**
 * 직원 화면 찾기: 자료명·구분·업무·원본 참조·파일명에서 찾는다(영문 키로는 찾지 않는다). 결과는 등록일 최신순.
 * 검색어가 있으면 모든 구분에서 찾는다(고른 탭을 보지 않는다). 업무 고르기는 검색 중에도 적용된다.
 */
export const filterResources = (rows, { search = '', category = '', module = '' } = {}) => {
    const needle = clean(search).toLowerCase();
    return (rows || [])
        .filter(row => (needle || !category || row.category_label === category) && (!module || row.module_label === module))
        .filter(row => !needle || [row.title, row.category_label, row.module_label, row.source_ref, row.original_name]
            .some(text => String(text ?? '').toLowerCase().includes(needle)))
        .sort(byNewest);
};

/**
 * 구분 탭 [{ label, count }] — 기본 구분은 자료가 없어도 늘 있고, 그 밖의 구분은 자료가 있을 때만(가나다순). 「전체」 탭은 없다.
 * 탭 목록은 모든 자료로 만들고 건수만 고른 업무(module)의 것을 센다 — 업무를 바꿔도 탭이 사라지지 않게.
 */
export const categoryTabs = (rows, module = '') => {
    const counts = new Map(DEFAULT_CATEGORIES.map(([, label]) => [label, 0]));
    for (const row of rows || []) {
        counts.set(row.category_label, (counts.get(row.category_label) || 0) + (!module || row.module_label === module ? 1 : 0));
    }
    const labels = [...counts.keys()]; // Map 은 넣은 순서를 지킨다 → 앞쪽이 기본 구분
    const base = DEFAULT_CATEGORIES.length;
    return [...labels.slice(0, base), ...labels.slice(base).sort((a, b) => a.localeCompare(b, 'ko'))]
        .map(label => ({ label, count: counts.get(label) }));
};

/** 보여 줄 탭: 고른 탭이 아직 있으면 그 탭, 없으면(처음 열었거나 그 구분이 사라졌으면) 자료가 있는 첫 탭 — 자료가 하나도 없으면 맨 앞(매뉴얼). */
export const activeTabOf = (tabs, wanted) =>
    (tabs.find(tab => tab.label === wanted) || tabs.find(tab => tab.count > 0) || tabs[0]).label;

/** 새 자료 등록 창의 구분 처음 값 = 보고 있는 탭. 탭을 보고 있지 않거나(관리 탭·검색 중 → 빈 값) 고르기 목록에 없는 이름이면 비운다 → 「구분을 고르세요」. */
export const startCategory = (options, tab) => (options.some(option => option.label === tab) ? tab : '');

/** 자료 하나를 가리키는 값 — 서버가 판을 묶는 기준(업무·구분·문서 키)과 같다. */
export const docId = (row) => [row.module, row.category, row.doc_key].join('\n');

/**
 * 관리 탭의 판 목록(지난 판·숨긴 판 포함): 자료별로 모아(최근에 등록된 자료가 위) 그 안에서 큰 판이 먼저.
 * 검색어(자료명·구분·파일명)는 자료 단위로 건다 — 어느 판이든 맞으면 그 자료의 모든 판이 나온다(판마다 자료명·파일명이 달라도 이력이 끊기지 않게).
 * hiddenOnly 는 그중 숨긴 판만 남긴다.
 */
export const adminRows = (history, { search = '', hiddenOnly = false } = {}) => {
    const needle = clean(search).toLowerCase();
    const newest = new Map(); // 자료 → 그 자료의 가장 최근 등록일
    const hit = new Set(); // 검색어에 맞는 판이 있는 자료
    for (const row of history || []) {
        const id = docId(row);
        const created = String(row.created_at || '');
        if (!newest.has(id) || newest.get(id) < created) newest.set(id, created);
        if (!needle || [row.title, row.category_label, row.original_name].some(text => String(text ?? '').toLowerCase().includes(needle))) hit.add(id);
    }
    return (history || [])
        .filter(row => hit.has(docId(row)) && (!hiddenOnly || row.is_deleted))
        .sort((a, b) => newest.get(docId(b)).localeCompare(newest.get(docId(a)))
            || docId(a).localeCompare(docId(b)) || Number(b.revision || 0) - Number(a.revision || 0));
};

/** 관리 탭 요약: 자료 수 · 판 수 · 숨긴 판 수. */
export const adminSummary = (history) => ({
    docs: new Set((history || []).map(docId)).size,
    revisions: (history || []).length,
    hidden: (history || []).filter(row => row.is_deleted).length
});

export const revisionStatus = (row) => (row.is_deleted ? '숨김' : row.is_current ? '최신' : '지난 판');

/** 등록 14일 이내 표시: 1판은 「새 자료」, 2판 이상은 「새 판」. */
export const freshLabel = (row, now = Date.now()) => {
    if (!(Number(now) - new Date(row.created_at).getTime() <= FRESH_MS)) return '';
    return Number(row.revision) >= 2 ? '새 판' : '새 자료';
};

/**
 * 자료실 관리(등록·새 판·숨기기·되살리기·관리 탭) 권한 = 품질보증부 + 승인(Active).
 * 사이트 관리자(is_admin)와는 따로 본다 — 타부서 사이트 관리자는 자료실에서 보기·현재본 다운로드만.
 * 화면 표시용일 뿐이고, 실제 권한은 서버 함수·Storage 정책이 같은 조건으로 다시 판정한다.
 */
export const QUALITY_DEPARTMENT = '품질보증부';
export const canManageResources = (user) => user?.status === 'Active' && clean(user?.company) === QUALITY_DEPARTMENT;

/** 원본이 최신 개정본인지 아직 확인되지 않은 자료(등록 때 바뀐 점·내용에 이 표시를 붙였다). */
export const LATEST_UNVERIFIED = '최신본 미확인';
export const isLatestUnverified = (row) => !!row && [row.revision_note, row.description].some(text => String(text ?? '').includes(LATEST_UNVERIFIED));
/** 상세 머리글의 판 상태: 미확인 자료는 「최신본」이라고 단정하지 않는다. */
export const latestLabel = (row) => (isLatestUnverified(row) ? LATEST_UNVERIFIED : '최신본');
const LATEST_NOTICE = '여기 올라온 파일이 최신본입니다. 내려받아 둔 파일이나 출력물은 개정 전 것일 수 있으니, 쓰기 전에 등록일을 확인하세요.';
/** 맨 위 안내: 미확인 자료가 없으면 원래 문구, 있으면 그 자료만 예외로 알린다. */
export const latestNotice = (rows) => ((rows || []).some(isLatestUnverified)
    ? '여기 올라온 파일은 자료실에 등록된 가장 새 판입니다. 「최신본 미확인」 표시가 붙은 자료는 원본이 최신 개정본인지 아직 확인되지 않았으니, 쓰기 전에 품질보증부에 확인하세요. 내려받아 둔 파일이나 출력물은 개정 전 것일 수 있습니다.'
    : LATEST_NOTICE);

export const fileExt = (name) => (/\.([^.\s]+)$/.exec(clean(name))?.[1] || '파일').toUpperCase();

export const formatSize = (bytes) => {
    const size = Number(bytes);
    if (bytes == null || !Number.isFinite(size) || size < 0) return '';
    if (size < 1024) return `${size} B`;
    return size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`;
};
