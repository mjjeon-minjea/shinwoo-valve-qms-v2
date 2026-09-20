/* NCR 권한 판정의 단일 정본.
   직급(rank)은 화면 표시용으로만 보존하고, 승인·실무 권한은 role로만 판정한다. */

export const DEFAULT_USER_ROLE = 'employee';

const hasRole = (user, role) => user?.role === role;
const sameDept = (user, dept) => Boolean(dept) && user?.company === dept;
const deputyEnabled = (settings) => settings?.allow_deputy === true;

export const isNcrRouteStaff = (user) => hasRole(user, 'employee');

export const isNcrFinished = (report) => ['종결', '무효'].includes(report?.status);

/* 목록 가시성은 부서 단위 업무 기준. 품질은 전 건, 일반 부서는 실제 회람 row가 기준이다. */
export const isNcrRelatedToUser = (user, report) => {
    if (!user || !report) return false;
    if (user.company === '품질보증부') return true;
    if (report.author_email && report.author_email === user.email) return true;
    const reviews = report.reviews || {};
    const mine = reviews[user.company];
    if (Object.keys(reviews).length > 0) return !!mine && mine.state !== 'skip';
    return !!report.dept && report.dept === user.company;
};

export const roleOf = (user, settings) => {
    const company = user?.company || '';
    const rank = user?.rank || '';
    const role = user?.role || '';
    const isDirector = role === 'director';
    const isManager = role === 'manager';
    const isEmployee = role === 'employee';
    const canDeputize = isManager && deputyEnabled(settings);
    const isQa = company === '품질보증부';
    const isTech = company === '응용기술팀';

    return {
        company,
        rank,
        role,
        isQa,
        isQaHead: isQa && isDirector,
        isQaDeputy: isQa && canDeputize,
        isQaApprover: isQa && (isDirector || canDeputize),
        isQaStaff: isQa && isEmployee,
        isTechStaff: isTech && isEmployee,
        isTechHead: isTech && isDirector,
        isTechDeputy: isTech && canDeputize,
        isTechApprover: isTech && (isDirector || canDeputize),
        isDeptHead: (dept) => sameDept(user, dept) && isDirector,
        isDeptDeputy: (dept) => sameDept(user, dept) && canDeputize,
        isDeptStaff: (dept) => sameDept(user, dept) && isEmployee
    };
};

/* 기술 회신 저장 직전에도 렌더 시점과 동일한 권한을 재검사한다. */
export const techApprovalDecision = (user, settings) => {
    const role = roleOf(user, settings);
    if (role.isTechHead) return { allowed: true, deputy: false };
    if (role.isTechDeputy) return { allowed: true, deputy: true };
    return { allowed: false, deputy: false };
};

/* 레거시(v10.0) 단선 결재도 같은 role 정책을 사용한다. */
export const canApprove = (user, report, settings) => {
    if (!user || !report) return false;
    const role = user.role || '';
    const approver = role === 'director' || (role === 'manager' && deputyEnabled(settings));
    if (report.status === '발행') return approver && user.company === report.dept;
    if (report.status === '특채 판단') return approver && user.company === '품질보증부';
    return false;
};
