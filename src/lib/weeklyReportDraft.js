const DRAFT_VERSION = 1;
const DRAFT_KEY_PREFIX = 'qms:weekly-report-draft:v1:';
const SECTION_NAMES = ['schedule', 'projects', 'issues', 'samples'];

export function buildWeeklyReportDraftKey(authorId, weekStartDate) {
    return `${DRAFT_KEY_PREFIX}${String(authorId)}:${String(weekStartDate)}`;
}

export function isWeeklyReportEditable(report, authorId) {
    if (!report || report.authorId == null || authorId == null) return false;

    return String(report.authorId) === String(authorId)
        && (report.status === 'draft' || report.status === 'rejected');
}

function removeInvalidDraft(storage, key) {
    try {
        storage?.removeItem(key);
    } catch {
        // Storage failures must not interrupt report rendering or editing.
    }
}

function normalizeDraftReport(report) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) return null;

    const normalized = { ...report };
    for (const section of SECTION_NAMES) {
        if (normalized[section] == null) {
            normalized[section] = [];
        } else if (!Array.isArray(normalized[section])) {
            return null;
        }
    }
    return normalized;
}

export function saveWeeklyReportDraft({
    storage,
    authorId,
    weekStartDate,
    report,
    now = () => new Date()
}) {
    try {
        const timestamp = typeof now === 'function' ? now() : now;
        const envelope = {
            version: DRAFT_VERSION,
            authorId: String(authorId),
            weekStartDate: String(weekStartDate),
            reportId: report?.id == null ? null : String(report.id),
            updatedAt: new Date(timestamp).toISOString(),
            report
        };
        storage?.setItem(
            buildWeeklyReportDraftKey(authorId, weekStartDate),
            JSON.stringify(envelope)
        );
        return Boolean(storage);
    } catch {
        return false;
    }
}

export function loadWeeklyReportDraft({
    storage,
    authorId,
    weekStartDate,
    serverReport
}) {
    const key = buildWeeklyReportDraftKey(authorId, weekStartDate);
    let rawValue;

    try {
        rawValue = storage?.getItem(key);
    } catch {
        return null;
    }
    if (rawValue == null) return null;

    try {
        const envelope = JSON.parse(rawValue);
        const contextAuthorId = String(authorId);
        const contextWeekStartDate = String(weekStartDate);
        const report = normalizeDraftReport(envelope?.report);
        const serverReportId = serverReport?.id == null ? null : String(serverReport.id);

        const isValid = envelope
            && typeof envelope === 'object'
            && !Array.isArray(envelope)
            && envelope.version === DRAFT_VERSION
            && envelope.authorId === contextAuthorId
            && envelope.weekStartDate === contextWeekStartDate
            && report
            && String(report.authorId) === contextAuthorId
            && String(report.weekStartDate) === contextWeekStartDate
            && isWeeklyReportEditable(report, authorId)
            && isWeeklyReportEditable(serverReport, authorId)
            && envelope.reportId === serverReportId;

        if (!isValid) {
            removeInvalidDraft(storage, key);
            return null;
        }

        return report;
    } catch {
        removeInvalidDraft(storage, key);
        return null;
    }
}

export function clearWeeklyReportDraft({ storage, authorId, weekStartDate }) {
    try {
        storage?.removeItem(buildWeeklyReportDraftKey(authorId, weekStartDate));
        return Boolean(storage);
    } catch {
        return false;
    }
}

export function createWeeklyReportDraftUpdater({
    storage,
    authorId,
    weekStartDate,
    update,
    now
}) {
    return previousReport => {
        const nextReport = update(previousReport);
        if (isWeeklyReportEditable(nextReport, authorId)) {
            saveWeeklyReportDraft({
                storage,
                authorId,
                weekStartDate,
                report: nextReport,
                now
            });
        }
        return nextReport;
    };
}
