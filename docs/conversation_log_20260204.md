# 2026-02-04 Conversation Log

## Topics

1.  **Network Setup**: Confirmed correct installation of ipTIME router (Double NAT configuration with `192.168.1.1` subnet) to resolve IP conflicts.
2.  **Weekly Report Improvements**:
    - Added "Time" field to the "Schedule & Attendance" section.
    - Refined "Time" input to use dropdowns for Hour (00-23) and Minute (00-50, 10-minute intervals).
    - Implemented logic to handle "Vacation" (휴가) type as an "All Day" (종일) event, hiding time inputs.
3.  **Dashboard (Weekly Status) Improvements**:
    - Updated sorting logic to order schedule items by **Date** > **Time**.
    - Fixed truncated time display by increasing column width (`w-32` -> `w-48`).
    - Fixed rank display issue ("사원" default fallback) by ensuring type-safe ID comparison (`String(id)`).
4.  **Deployment**:
    - Verified local server function.
    - Committed and pushed changes to trigger Vercel deployment.

## Key Code Changes

- `src/components/WeeklyReport.jsx`: Added time dropdowns, conditional "All Day" rendering for Vacation.
- `src/components/WeeklyStatus.jsx`: Updated sort logic, fixed ranks, improved layout.

## Next Steps

- Automated verification of Vercel deployment.
- Detailed conflict check.
