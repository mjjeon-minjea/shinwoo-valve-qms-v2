import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/api';

const PasswordChangeModal = ({ onComplete }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // 비밀번호 표시 토글
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // ESC 닫기 방지용 Effect
    useEffect(() => {
        const preventEsc = (e) => { if (e.key === 'Escape') e.preventDefault(); };
        window.addEventListener('keydown', preventEsc);
        return () => window.removeEventListener('keydown', preventEsc);
    }, []);

    // 🔒 유효성 검사 (Real-time)
    const isLengthValid = newPassword.length >= 10;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const isMatch = newPassword !== '' && newPassword === confirmPassword;
    const allValid = isLengthValid && hasSpecialChar && isMatch && oldPassword.trim() !== '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!allValid) return;

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) { alert('오류: ' + error.message); return; }

        alert("비밀번호가 안전하게 변경되었습니다. 다시 로그인해 주십시오.");
        onComplete();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
            {/* 오버레이 클릭 방어: onMouseDown 차단 */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" 
                 onMouseDown={(e) => e.stopPropagation()}>
                
                <div className="bg-red-50 border-b border-red-100 p-6 text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm relative">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">보안 경고: 초기 비밀번호 감지</h2>
                    <p className="text-sm text-red-600 mt-2 font-medium">안전한 데이터 무결성을 위해 비밀번호를 필수 변경해 주십시오.</p>
                </div>
                
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 현재 비밀번호 */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <input 
                                type={showOld ? "text" : "password"} required
                                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                                placeholder="현재 비밀번호 (123456)"
                                value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                            />
                            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-3 text-slate-400">
                                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        {/* 새 비밀번호 */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <input 
                                type={showNew ? "text" : "password"} required
                                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                                placeholder="신규 비밀번호 설정"
                                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-3 text-slate-400">
                                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        
                        {/* 새 비밀번호 확인 */}
                        <div className="relative">
                            <CheckCircle2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <input 
                                type={showConfirm ? "text" : "password"} required
                                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                                placeholder="신규 비밀번호 확인"
                                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3 text-slate-400">
                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        {/* 실시간 유효성 피드백 패널 */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 mt-2 text-xs font-medium">
                            <p className={isLengthValid ? 'text-green-600 flex items-center' : 'text-slate-500 flex items-center'}>
                                {isLengthValid ? '✅ ' : '❌ '} 영문, 숫자 조합 10자리 이상
                            </p>
                            <p className={hasSpecialChar ? 'text-green-600 flex items-center' : 'text-slate-500 flex items-center'}>
                                {hasSpecialChar ? '✅ ' : '❌ '} 특수문자(!@#$ 등) 최소 1개 이상 포함
                            </p>
                            <p className={isMatch ? 'text-green-600 flex items-center' : 'text-slate-500 flex items-center'}>
                                {isMatch ? '✅ ' : '❌ '} 새 비밀번호 2회 일치
                            </p>
                        </div>

                        <button 
                            type="submit" 
                            disabled={!allValid}
                            className={`w-full py-3 mt-4 text-white font-bold rounded-lg transition-all ${
                                allValid ? 'bg-red-600 hover:bg-red-700 shadow-lg' : 'bg-slate-300 cursor-not-allowed'
                            }`}
                        >
                            안전하게 비밀번호 변경
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PasswordChangeModal;
