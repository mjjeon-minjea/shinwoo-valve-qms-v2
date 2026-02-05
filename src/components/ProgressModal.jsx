import { useMemo } from 'react';

const ProgressModal = ({ isOpen, type, current, total, startTime }) => {
    
    // Hooks defined unconditionally
    const percentage = useMemo(() => {
        if (total === 0) return 0;
        return Math.min(100, Math.round((current / total) * 100));
    }, [current, total]);

    const eta = useMemo(() => {
        if (!startTime || current === 0) return null;
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const rate = current / elapsed; // items per second
        const remaining = total - current;
        if (rate <= 0) return null;
        return Math.ceil(remaining / rate);
    }, [current, total, startTime]);

    // Circular Progress Props
    const radius = 60;
    const stroke = 8;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const title = type === 'upload' ? '데이터 업로드 중' : '데이터 삭제 중';
    const statusText = type === 'upload' ? '등록중' : '삭제중';

    // Early return AFTER hooks
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 flex flex-col items-center animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold text-slate-900 mb-6">{title}</h3>

                {/* Circular Progress Bar */}
                <div className="relative flex items-center justify-center mb-6">
                    <svg
                        height={radius * 2}
                        width={radius * 2}
                        className="transform -rotate-90"
                    >
                        <circle
                            stroke="#e2e8f0"
                            strokeWidth={stroke}
                            fill="transparent"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                        <circle
                            stroke="#3b82f6"
                            strokeWidth={stroke}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.3s ease' }}
                            strokeLinecap="round"
                            fill="transparent"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-800">{percentage}%</span>
                    </div>
                </div>

                <div className="text-center space-y-2 w-full">
                    <p className="text-slate-600 font-medium">
                        {statusText}... <span className="text-slate-900 font-bold">{current}</span> / {total}
                    </p>

                    {eta !== null && (
                        <div className="bg-slate-50 rounded-lg py-2 px-4 mt-2">
                            <p className="text-sm text-slate-500">
                                예상 완료시간: <span className="text-primary-600 font-bold">{eta}초</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProgressModal;
