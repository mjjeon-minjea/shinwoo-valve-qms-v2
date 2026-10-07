// Display/handler predicate on DB profiles only; SQL pins the exact Auth binding.
export const isFullOperator = user => user?.status === 'Active' && user?.is_admin === true
    && (user.profileId ?? user.id) === 'hermes' && user.email === 'hermes@shinwoovalve.com'
    && user.company === '시스템운영' && user.role === 'admin';
