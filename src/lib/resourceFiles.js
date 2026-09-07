export const RESOURCE_BUCKET = 'qms-files';
export const MAX_RESOURCE_FILE_SIZE = 20971520;

const MIME_BY_EXTENSION = Object.freeze({
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    txt: 'text/plain',
    zip: 'application/zip',
    hwp: 'application/x-hwp',
    hwpx: 'application/vnd.hancom.hwpx'
});

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const DOC_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export class ResourceFilesError extends Error {
    constructor(message, code, receipt = null) {
        super(message);
        this.name = 'ResourceFilesError';
        this.code = code;
        this.receipt = receipt;
    }
}

const clean = (value) => String(value ?? '').trim();
const extensionOf = (name) => {
    const match = /\.([^.\s]+)$/.exec(clean(name));
    return match ? match[1].toLowerCase() : '';
};

const safeName = (name) => clean(name)
    .normalize('NFC')
    .replace(/[\\/\0]/g, '_')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^\./, 'file.')
    .slice(-120) || 'file';

const ensureKey = (name, value, pattern) => {
    const normalized = clean(value).toLowerCase();
    if (!pattern.test(normalized)) {
        throw new ResourceFilesError(`${name} 형식이 올바르지 않습니다.`, 'RESOURCE_INVALID_METADATA');
    }
    return normalized;
};

const normalizeDraft = (draft) => {
    const normalized = {
        module: ensureKey('module', draft?.module, KEY_PATTERN),
        moduleLabel: clean(draft?.moduleLabel),
        category: ensureKey('category', draft?.category, KEY_PATTERN),
        categoryLabel: clean(draft?.categoryLabel),
        docKey: ensureKey('doc_key', draft?.docKey, DOC_KEY_PATTERN),
        title: clean(draft?.title),
        description: String(draft?.description ?? ''),
        sourceRef: clean(draft?.sourceRef),
        revisionNote: String(draft?.revisionNote ?? '')
    };
    if (!normalized.moduleLabel || !normalized.categoryLabel || !normalized.title) {
        throw new ResourceFilesError('모듈명, 구분명, 자료명은 필수입니다.', 'RESOURCE_INVALID_METADATA');
    }
    return normalized;
};

export const mimeForResourceFile = (file) => {
    const extension = extensionOf(file?.name);
    const canonical = MIME_BY_EXTENSION[extension];
    if (!canonical) return '';
    // File.type is frequently blank for HWP/HWPX. Always upload the fixed
    // extension-derived MIME; the publish RPC independently validates it.
    return canonical;
};

export const validateResourceFile = (file) => {
    if (!file || !clean(file.name)) {
        throw new ResourceFilesError('파일을 선택하세요.', 'RESOURCE_FILE_REQUIRED');
    }
    const extension = extensionOf(file.name);
    if (!MIME_BY_EXTENSION[extension]) {
        throw new ResourceFilesError('허용되지 않는 파일 확장자입니다.', 'RESOURCE_FILE_EXTENSION');
    }
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_RESOURCE_FILE_SIZE) {
        throw new ResourceFilesError('파일은 20 MiB 이하만 등록할 수 있습니다.', 'RESOURCE_FILE_SIZE');
    }
    return { extension, mimeType: mimeForResourceFile(file), originalName: String(file.name) };
};

export const buildResourceStoragePath = ({ id, module, category, docKey, originalName, now = new Date() }) => {
    const safeId = clean(id);
    if (!safeId) throw new ResourceFilesError('업로드 ID가 없습니다.', 'RESOURCE_INVALID_ID');
    const normalizedModule = ensureKey('module', module, KEY_PATTERN);
    const normalizedCategory = ensureKey('category', category, KEY_PATTERN);
    const normalizedDocKey = ensureKey('doc_key', docKey, DOC_KEY_PATTERN);
    const year = new Date(now).getUTCFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
        throw new ResourceFilesError('업로드 날짜가 올바르지 않습니다.', 'RESOURCE_INVALID_DATE');
    }
    return `resources/${normalizedModule}/${normalizedCategory}/${year}/${normalizedDocKey}/${safeId}--${safeName(originalName)}`;
};

const defaultCreateId = () => {
    if (!globalThis.crypto?.randomUUID) throw new ResourceFilesError('브라우저 UUID 기능을 사용할 수 없습니다.', 'RESOURCE_ID_UNAVAILABLE');
    return globalThis.crypto.randomUUID();
};

const defaultHashFile = async (file) => {
    if (!globalThis.crypto?.subtle || typeof file?.arrayBuffer !== 'function') {
        throw new ResourceFilesError('파일 SHA-256을 계산할 수 없습니다.', 'RESOURCE_HASH_UNAVAILABLE');
    }
    const bytes = await file.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const receiptInputs = (draft, fileInfo, sha256) => ({
    module: draft.module,
    moduleLabel: draft.moduleLabel,
    category: draft.category,
    categoryLabel: draft.categoryLabel,
    docKey: draft.docKey,
    title: draft.title,
    description: draft.description,
    sourceRef: draft.sourceRef,
    revisionNote: draft.revisionNote,
    originalName: fileInfo.originalName,
    fileSize: fileInfo.size,
    mimeType: fileInfo.mimeType,
    sha256
});

const sameReceiptInputs = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const throwIfResponseFailed = (response, message) => {
    if (!response?.ok) throw new ResourceFilesError(message, 'RESOURCE_LIST_FAILED');
};

/**
 * Supplies a testable resource Storage/RPC adapter. Browser callers resolve
 * api/supabase from api.js; tests inject only the narrow interfaces used.
 */
export const createResourceFiles = ({
    apiClient,
    supabaseClient,
    createId = defaultCreateId,
    hashFile = defaultHashFile,
    now = () => new Date()
} = {}) => {
    // Keep this module unit-testable in plain Node. The browser adapters are
    // lazily imported from api.js only when a caller did not inject them.
    const getApiClient = async () => apiClient || (await import('./api.js')).api;
    const getSupabaseClient = async () => supabaseClient || (await import('./api.js')).supabase;

    const listCurrent = async () => {
        try {
            const response = await (await getApiClient()).fetch('/resources?is_current=eq.true&is_deleted=eq.false');
            throwIfResponseFailed(response, '자료실 목록을 불러오지 못했습니다.');
            const rows = await response.json();
            return (Array.isArray(rows) ? rows : [])
                .filter(row => row?.is_current === true && row?.is_deleted === false)
                .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        } catch (error) {
            if (error instanceof ResourceFilesError) throw error;
            throw new ResourceFilesError('자료실 목록을 불러오지 못했습니다.', 'RESOURCE_LIST_FAILED');
        }
    };

    const listHistory = async ({ isAdmin } = {}) => {
        if (!isAdmin) {
            throw new ResourceFilesError('관리자만 개정 이력을 볼 수 있습니다.', 'RESOURCE_ADMIN_REQUIRED');
        }
        try {
            const response = await (await getApiClient()).fetch('/resources');
            throwIfResponseFailed(response, '자료실 이력을 불러오지 못했습니다.');
            const rows = await response.json();
            return (Array.isArray(rows) ? rows : []).sort((a, b) => {
                const date = String(b.created_at || '').localeCompare(String(a.created_at || ''));
                return date || Number(b.revision || 0) - Number(a.revision || 0);
            });
        } catch (error) {
            if (error instanceof ResourceFilesError) throw error;
            throw new ResourceFilesError('자료실 이력을 불러오지 못했습니다.', 'RESOURCE_HISTORY_FAILED');
        }
    };

    const publish = async ({ draft, file, receipt = null, isAdmin }) => {
        if (!isAdmin) {
            throw new ResourceFilesError('관리자만 자료를 발행할 수 있습니다.', 'RESOURCE_ADMIN_REQUIRED');
        }
        const normalizedDraft = normalizeDraft(draft);
        const validatedFile = validateResourceFile(file);
        const fileInfo = { ...validatedFile, size: file.size };
        const sha256 = await hashFile(file);
        if (!/^[a-f0-9]{64}$/i.test(sha256 || '')) {
            throw new ResourceFilesError('파일 SHA-256이 올바르지 않습니다.', 'RESOURCE_HASH_INVALID');
        }
        const immutable = receiptInputs(normalizedDraft, fileInfo, String(sha256).toLowerCase());
        let activeReceipt = receipt;

        if (activeReceipt) {
            if (!activeReceipt.id || !activeReceipt.storagePath || !sameReceiptInputs(activeReceipt.immutable, immutable)) {
                throw new ResourceFilesError('재시도 입력값이 최초 업로드 영수증과 다릅니다.', 'RESOURCE_RECEIPT_CONFLICT', activeReceipt);
            }
        } else {
            const id = createId();
            const storagePath = buildResourceStoragePath({
                id,
                module: normalizedDraft.module,
                category: normalizedDraft.category,
                docKey: normalizedDraft.docKey,
                originalName: fileInfo.originalName,
                now: now()
            });
            activeReceipt = { id, storagePath, immutable, uploaded: false };
        }
        if (!activeReceipt.uploaded) {
            const storage = (await getSupabaseClient()).storage.from(RESOURCE_BUCKET);
            let error;
            try {
                ({ error } = await storage.upload(activeReceipt.storagePath, file, {
                    contentType: fileInfo.mimeType,
                    upsert: false
                }));
            } catch (uploadError) {
                error = uploadError;
            }
            if (error) {
                // A lost response may follow a committed object. Recover only
                // when the exact same path contains the exact original bytes.
                let recovered = false;
                try {
                    const existing = await storage.download(activeReceipt.storagePath);
                    recovered = !existing.error && existing.data
                        && await hashFile(existing.data) === immutable.sha256;
                } catch { /* Keep the receipt for a same-path upload retry. */ }
                if (!recovered) {
                    throw new ResourceFilesError(`파일 저장 실패: ${error.message || error}`, 'RESOURCE_STORAGE_UPLOAD_FAILED', activeReceipt);
                }
            }
            activeReceipt = { ...activeReceipt, uploaded: true };
        }

        try {
            return await (await getApiClient()).rpc('resource_publish_revision', {
                p_id: activeReceipt.id,
                p_module: normalizedDraft.module,
                p_module_label: normalizedDraft.moduleLabel,
                p_category: normalizedDraft.category,
                p_category_label: normalizedDraft.categoryLabel,
                p_doc_key: normalizedDraft.docKey,
                p_title: normalizedDraft.title,
                p_description: normalizedDraft.description,
                p_source_ref: normalizedDraft.sourceRef || null,
                p_revision_note: normalizedDraft.revisionNote,
                p_storage_path: activeReceipt.storagePath,
                p_original_name: fileInfo.originalName,
                p_file_size: fileInfo.size,
                p_mime_type: fileInfo.mimeType,
                p_sha256: immutable.sha256
            });
        } catch (error) {
            throw new ResourceFilesError('파일은 저장되었지만 자료 발행에 실패했습니다. 같은 입력으로 다시 시도하세요.', 'RESOURCE_PUBLISH_FAILED', activeReceipt);
        }
    };

    const softDelete = async ({ id, isAdmin }) => {
        if (!isAdmin) throw new ResourceFilesError('관리자만 자료를 삭제할 수 있습니다.', 'RESOURCE_ADMIN_REQUIRED');
        if (!clean(id)) throw new ResourceFilesError('자료 ID가 없습니다.', 'RESOURCE_INVALID_ID');
        try {
            return await (await getApiClient()).rpc('resource_soft_delete', { p_id: id });
        } catch (error) {
            throw new ResourceFilesError('자료 논리삭제에 실패했습니다.', 'RESOURCE_DELETE_FAILED');
        }
    };

    const createDownload = async ({ id, isAdmin = false }) => {
        try {
            const response = await (await getApiClient()).fetch(`/resources?id=eq.${encodeURIComponent(id)}`);
            throwIfResponseFailed(response, '자료 정보를 다시 확인하지 못했습니다.');
            const rows = await response.json();
            const row = (Array.isArray(rows) ? rows : []).find(item => String(item?.id) === String(id));
            if (!row) throw new ResourceFilesError('자료를 찾을 수 없습니다.', 'RESOURCE_NOT_FOUND');
            if (row.is_deleted) throw new ResourceFilesError('삭제된 자료는 다운로드할 수 없습니다.', 'RESOURCE_DELETED');
            if (!row.is_current && !isAdmin) throw new ResourceFilesError('현재 개정본만 다운로드할 수 있습니다.', 'RESOURCE_NOT_CURRENT');
            const { data, error } = await (await getSupabaseClient()).storage.from(RESOURCE_BUCKET).createSignedUrl(row.storage_path, 300, {
                download: row.original_name
            });
            if (error || !data?.signedUrl) {
                throw new ResourceFilesError('다운로드 주소를 만들지 못했습니다.', 'RESOURCE_SIGN_FAILED');
            }
            return data.signedUrl;
        } catch (error) {
            if (error instanceof ResourceFilesError) throw error;
            throw new ResourceFilesError('다운로드 주소를 만들지 못했습니다.', 'RESOURCE_SIGN_FAILED');
        }
    };

    return { listCurrent, listHistory, publish, softDelete, createDownload };
};

const resourceFiles = createResourceFiles();
export const listCurrentResources = resourceFiles.listCurrent;
export const listResourceHistory = resourceFiles.listHistory;
export const publishResourceRevision = resourceFiles.publish;
export const softDeleteResource = resourceFiles.softDelete;
export const createResourceDownload = resourceFiles.createDownload;
