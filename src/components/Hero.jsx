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
                <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
                <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">

                {/* Left Side: Text Content */}
                <div className="text-center lg:text-left space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-primary-600 font-semibold tracking-wide uppercase text-sm">
                            품질 관리 시스템
                        </h2>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                            모든 공정의 <br />
                            <span className="text-primary-600">완벽함을 추구합니다.</span>
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                            신우밸브의 차세대 QMS 플랫폼은 간소화된 워크플로우와 통합 데이터 관리로 신뢰할 수 있는 환경을 제공합니다.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                        <a
                            href="https://www.swvis.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-lg shadow-primary-500/30"
                        >
                            신우밸브 홈페이지
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </a>
                        <Link
                            to="/exam"
                            className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg transition-colors"
                        >
                            자격인증 시험
                            <Award className="ml-2 w-5 h-5" />
                        </Link>
                    </div>

                    <div className="pt-8 border-t border-slate-200/60 hidden lg:block">
                        <div className="grid grid-cols-3 gap-8">
                            <div>
                                <p className="text-3xl font-bold text-slate-900">40+</p>
                                <p className="text-sm text-slate-500 mt-1">년 이상의 경험</p>
                            </div>

                            <div>
                                <p className="text-3xl font-bold text-slate-900">100%</p>
                                <p className="text-sm text-slate-500 mt-1">품질 보증</p>
                            </div>

                            <div>
                                <p className="text-3xl font-bold text-slate-900">100PPM</p>
                                <p className="text-sm text-slate-500 mt-1">목표불량률</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Auth Form */}
                <div className="w-full max-w-md mx-auto lg:ml-auto">
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-white/50 backdrop-blur-sm">
                        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-8">
                            <button
                                onClick={() => setAuthMode('login')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${authMode === 'login'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                로그인
                            </button>
                            <button
                                onClick={() => setAuthMode('signup')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${authMode === 'signup'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
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
                            }} className="space-y-5">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">아이디</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            id="email"
                                            required
                                            className="block w-full pl-10 pr-40 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                            placeholder="ID를 입력하시오"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500 font-medium">
                                            @shinwoovalve.com
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label htmlFor="password" className="block text-sm font-medium text-slate-700">비밀번호</label>
                                        <a href="#" className="text-sm text-primary-600 hover:text-primary-500 font-medium">비밀번호 찾기</a>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            type="password"
                                            id="password"
                                            required
                                            className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all shadow-lg shadow-primary-500/20"
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
                                    role: 'employee', // Default role for new signups
                                    email: e.target.email.value.includes('@') ? e.target.email.value : e.target.email.value + '@shinwoovalve.com',
                                    password: password
                                };
                                onSignup(formData);
                                setAuthMode('login');
                                // Reset form state
                                setPassword('');
                                setConfirmPassword('');
                            }} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="name" type="text" required className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="홍길동" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">부서명</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Building className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="company" type="text" required className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="소속된 부서명을 명기하시오" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Award className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="rank" type="text" required className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="직급 (예: 대리, 과장)" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">아이디</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="email" type="text" required className="block w-full pl-10 pr-40 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="ID를 입력하시오" />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500 font-medium">
                                            @shinwoovalve.com
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 확인</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            name="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all shadow-lg shadow-primary-500/20"
                                >
                                    계정 생성
                                </button>
                            </form>
                        ) : null}

                        <div className="mt-6">
                            <p className="text-xs text-center text-slate-500">
                                계속 진행함으로써, 귀하는 신우밸브의 <a href="#" className="text-primary-600 hover:underline">이용약관</a> 및 <a href="#" className="text-primary-600 hover:underline">개인정보처리방침</a>에 동의하게 됩니다.
                            </p>
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
