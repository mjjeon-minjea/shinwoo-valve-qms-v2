import { useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { ArrowRight, User, Lock, Mail, Building, Eye, EyeOff, MessageSquare, Youtube, Play, Award, X } from 'lucide-react';

const PasswordResetModal = ({ email, onMigrate, onCancel }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 1) return setError('비밀번호를 입력해 주세요.');
        if (newPassword !== confirmNewPassword) return setError('새 비밀번호가 일치하지 않습니다.');
        if (oldPassword === newPassword) return setError('현재 비밀번호와 동일합니다.');

        try {
            await onMigrate(email, oldPassword, newPassword);
            window.alert('비밀번호 변경이 정상적으로 완료되었습니다!\n이후 화면은 다시 로그인할 필요 없이 즉시 메인 화면으로 진입합니다.');
            onCancel(); // 성공 시 모달 해제
        } catch (err) {
            const msg = err.message || '비밀번호 변경에 실패했습니다.';
            if (msg.includes('rate limit')) {
                setError('보안 조치로 인해 일시적으로 접속이 차단되었습니다. 잠시 후(약 1시간 뒤) 다시 시도해주세요.');
            } else {
                setError(msg);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="bg-white border-b border-slate-100 p-6 text-center relative pointer-events-auto">
                    <div className="absolute top-4 right-4">
                        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-14 h-14 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 relative mt-2">
                        <Lock className="w-6 h-6 text-slate-400" />
                        <div className="absolute -top-1 right-0 w-6 h-6 bg-red-400 rounded-full flex items-center justify-center border-2 border-white">
                            <Lock className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <h2 className="text-[17px] font-bold text-slate-800 tracking-tight mt-2">개인정보 보안 강화</h2>
                    <h3 className="text-xl font-bold text-[#e65c5c] mt-1 mb-2">비밀번호 변경</h3>
                </div>
                
                <div className="p-6 pt-4">
                    <div className="text-center mb-6">
                        <p className="text-[14px] text-slate-600 mb-2 leading-relaxed font-medium tracking-tight">
                            현재 F12(개발자 도구)를 누를 줄 아는 사람이면 누구나 해킹할 수 있습니다.<br/>
                            대응방안으로 Supabase 인증 시스템을 적용하고, DB 자체에 접근 권한 보안을 추가하여 원천 차단 예정입니다.<br/>
                            이에 따라 비밀번호 체계 또한 강화 되어 아래 내용에 따라 비밀번호 변경을 요청드립니다.
                        </p>
                        <p className="text-[14px] text-slate-600 mb-4 font-medium tracking-tight">
                            연속적인 숫자, 생일, 전화번호, 아이디와 비슷한 설정을 제외하여<br/>
                            <span className="font-bold text-slate-800">비밀번호를 변경해주세요.</span>
                        </p>
                        <div className="mt-2 text-[13px] font-bold text-[#e65c5c]">
                            [ 안전한 비밀번호 설정방법 ]<br/>
                            <span className="text-slate-500 font-medium tracking-tight">비밀번호를 입력해 주세요.</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center font-bold tracking-tight">{error}</div>}
                        
                        <div className="space-y-[1px]">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-300" />
                                </div>
                                <input 
                                    type={showOldPassword ? "text" : "password"} required 
                                    className="block w-full pl-10 pr-10 py-3 bg-[#fafafa] border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm placeholder:text-slate-400 rounded-t-sm transition-colors" 
                                    placeholder="현재 비밀번호"
                                    value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none">
                                    {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 border border-slate-300 rounded-[3px] p-[2px] text-slate-300" />
                                </div>
                                <input 
                                    type={showNewPassword ? "text" : "password"} required 
                                    className="block w-full pl-10 pr-10 py-3 bg-[#fafafa] border-l border-r border-b border-t-0 border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm placeholder:text-slate-400 transition-colors" 
                                    placeholder="신규 비밀번호"
                                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none">
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 border border-slate-300 rounded-[3px] p-[2px] text-slate-300" />
                                </div>
                                {/* overlay check icon inside the standard lock */}
                                <div className="absolute inset-y-0 left-0 pl-[16px] flex items-center pointer-events-none">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-[10px] h-[10px] text-slate-300 mt-[2px] -ml-[0.5px]">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <input 
                                    type={showConfirmNewPassword ? "text" : "password"} required 
                                    className="block w-full pl-10 pr-10 py-3 bg-[#fafafa] border-l border-r border-b border-t-0 border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm placeholder:text-slate-400 rounded-b-sm transition-colors" 
                                    placeholder="신규 비밀번호 확인"
                                    value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none">
                                    {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 !mt-5">
                            <button type="submit" className="flex-1 py-[14px] bg-[#DE534E] text-white font-bold text-[15px] hover:bg-[#c74540] transition-colors border border-transparent rounded-[4px] tracking-wide">
                                변경하기
                            </button>
                            <button type="button" onClick={onCancel} className="flex-1 py-[14px] bg-white border border-slate-300 text-slate-700 font-bold text-[15px] hover:bg-slate-50 transition-colors rounded-[4px] tracking-wide">
                                홈으로 가기
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const Hero = ({ onLogin, onSignup, migrationState, onMigrate, onCancelMigration }) => {
    const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'admin'
    
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50 pt-16">
            {/* Background decoration */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 -left-4 w-72 h-72 bg-slate-200 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob"></div>
                <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-20 w-72 h-72 bg-slate-100 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden grid lg:grid-cols-12 min-h-[600px]">
                    
                    {/* Left Side: Dark-Grey Premium Info Panel */}
                    <div className="lg:col-span-5 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-10 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                        {/* Decorative background grid pattern */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        
                        <div className="space-y-8 relative z-10">
                            <div>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-400/20 tracking-wider uppercase mb-4">
                                    SHINWOO QMS V2
                                </span>
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
                                    품질 보증부의<br/>
                                    <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-slate-200 bg-clip-text text-transparent">
                                        새로운 도약
                                    </span>
                                </h1>
                            </div>
                            
                            <p className="text-slate-300 text-[15px] leading-relaxed font-light tracking-wide">
                                신우밸브 차세대 품질보증 시스템(QMS)은 더욱 단단해진 보안 체계와 단방향 아키텍처 제약(Harness)을 탑재하여 완벽한 품질 정합성을 실현합니다.
                            </p>

                            <div className="space-y-4 pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                    <p className="text-sm text-slate-300 font-medium tracking-tight">Supabase 기반 강력한 인증 구조</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                    <p className="text-sm text-slate-300 font-medium tracking-tight">ESLint Boundaries 아키텍처 제약망</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                    <p className="text-sm text-slate-300 font-medium tracking-tight">자율 오작동 제어 하네스 엔진 탑재</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-slate-800 relative z-10 grid grid-cols-3 gap-4 text-center lg:text-left mt-8">
                            <div>
                                <p className="text-2xl font-black text-white">40+</p>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">품질 업력</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">100%</p>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">자격 인증</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">100PPM</p>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">목표 불량</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Premium Light Auth Form */}
                    <div className="lg:col-span-7 p-8 lg:p-12 bg-white flex items-center justify-center">
                        <div className="w-full max-w-md space-y-6">
                            <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-xl mb-6">
                                <button
                                    onClick={() => setAuthMode('login')}
                                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${authMode === 'login'
                                        ? 'bg-white text-slate-800 shadow-md border border-slate-200/40'
                                        : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    로그인
                                </button>
                                <button
                                    onClick={() => setAuthMode('signup')}
                                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${authMode === 'signup'
                                        ? 'bg-white text-slate-800 shadow-md border border-slate-200/40'
                                        : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    회원가입
                                </button>
                            </div>

                            {authMode === 'login' ? (
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const rawEmail = e.target.email.value;
                                    const email = rawEmail.includes('@') ? rawEmail : rawEmail + '@shinwoovalve.com';
                                    const password = e.target.password.value;
                                    onLogin(email, password);
                                }} className="space-y-4">
                                    <div className="space-y-1">
                                        <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">아이디</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <User className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                id="email"
                                                required
                                                className="block w-full pl-11 pr-36 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all placeholder:text-slate-400 text-sm font-medium"
                                                placeholder="ID를 입력하시오"
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                                                @shinwoovalve.com
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">비밀번호</label>
                                            <a href="#" className="text-xs text-blue-500 hover:text-blue-600 font-semibold">비밀번호 찾기</a>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Lock className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                id="password"
                                                required
                                                className="block w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all placeholder:text-slate-400 text-sm"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-lg shadow-slate-900/10 mt-2"
                                    >
                                        로그인
                                    </button>
                                </form>
                            ) : authMode === 'signup' ? (
                                <form onSubmit={(e) => {
                                    e.preventDefault();

                                    if (password !== confirmPassword) {
                                        alert('비밀번호가 일치하지 않습니다.');
                                        return;
                                    }

                                    const formData = {
                                        name: e.target.name.value,
                                        company: e.target.company.value,
                                        rank: e.target.rank.value,
                                        role: 'employee',
                                        email: e.target.email.value.includes('@') ? e.target.email.value : e.target.email.value + '@shinwoovalve.com',
                                        password: password
                                    };
                                    onSignup(formData);
                                    setAuthMode('login');
                                    setPassword('');
                                    setConfirmPassword('');
                                }} className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">이름</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <User className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input name="name" type="text" required className="block w-full pl-11 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="홍길동" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">부서명</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Building className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input name="company" type="text" required className="block w-full pl-11 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="소속된 부서명을 명기하시오" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">직급</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Award className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input name="rank" type="text" required className="block w-full pl-11 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="직급 (예: 대리, 과장)" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">아이디</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <User className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input name="email" type="text" required className="block w-full pl-11 pr-36 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="ID를 입력하시오" />
                                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                                                @shinwoovalve.com
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">비밀번호</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Lock className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input
                                                name="password"
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="block w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                                placeholder="비밀번호"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">비밀번호 확인</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Lock className="h-4.5 w-4.5 text-slate-400" />
                                            </div>
                                            <input
                                                name="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                required
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="block w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                                placeholder="비밀번호 재확인"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {confirmPassword && (
                                            <p className={`text-xs mt-1 ml-1 ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                                                {password === confirmPassword ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-md mt-3"
                                    >
                                        계정 생성
                                    </button>
                                </form>
                            ) : null}

                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[11px] text-center text-slate-400 leading-normal">
                                    계속 진행함으로써, 귀하는 신우밸브의 <a href="#" className="text-blue-500 hover:underline">이용약관</a> 및 <a href="#" className="text-blue-500 hover:underline">개인정보처리방침</a>에 동의하게 됩니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-4">
                {/* YouTube Button */}
                <a
                    href="https://www.youtube.com/@ShinwooValve"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-14 h-14 bg-[#FF0000] hover:bg-[#CC0000] text-white rounded-2xl shadow-lg transition-transform hover:scale-110"
                >
                    <Play className="w-6 h-6 fill-current ml-1" />
                </a>

                {/* KakaoTalk Channel Button */}
                <a
                    href="https://pf.kakao.com/_xnxmGDxj/friend"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-14 h-14 bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] rounded-full shadow-lg transition-transform hover:scale-110"
                >
                    <MessageSquare className="w-7 h-7 fill-current" />
                </a>
            </div>
            {/* Password Reset Modal */}
            {migrationState && (
                <PasswordResetModal 
                    email={migrationState.email} 
                    onMigrate={onMigrate} 
                    onCancel={onCancelMigration} 
                />
            )}
        </div>
    );
};

export default Hero;
