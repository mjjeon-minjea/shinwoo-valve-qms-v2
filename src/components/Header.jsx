import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const Header = ({ isLoggedIn, onLogout, currentUser, onUpdateProfile }) => {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const handleProfileSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedData = {
            name: formData.get('name'),
            company: formData.get('company'),
            rank: formData.get('rank'),
            password: formData.get('password'),
        };
        onUpdateProfile(updatedData);
        setIsProfileModalOpen(false);
    };
    return (
        <header className="fixed w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`flex items-center h-16 ${isLoggedIn && currentUser ? 'justify-between' : 'justify-center'}`}>
                    <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src={logo} alt="신우밸브 로고" className="h-8 w-auto object-contain" />
                        <span className="text-xl font-black tracking-[-0.06em] text-slate-900 uppercase font-sans">
                            SHINWOOVALVE QMS
                        </span>
                    </Link>

                    {isLoggedIn && currentUser && (
                        <nav className="flex items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={onLogout}
                                    className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    로그아웃
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setIsProfileModalOpen(!isProfileModalOpen)}
                                        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors focus:outline-none"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                                            {currentUser?.name?.[0] || 'U'}
                                        </div>
                                        <span>{currentUser?.name || 'User'}</span>
                                    </button>

                                    {isProfileModalOpen && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 p-4 animate-fade-in-up z-50">
                                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold">
                                                    {currentUser?.name?.[0] || 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{currentUser?.name}</p>
                                                    <p className="text-xs text-slate-500">{currentUser?.email}</p>
                                                </div>
                                            </div>

                                            <form onSubmit={handleProfileSubmit} className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">이메일 (변경 불가)</label>
                                                    <input value={currentUser?.email || ''} disabled className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-slate-500 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">이름</label>
                                                    <input name="name" defaultValue={currentUser?.name || ''} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">부서명</label>
                                                    <input name="company" defaultValue={currentUser?.company || ''} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">직급</label>
                                                    <input name="rank" defaultValue={currentUser?.rank || ''} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" placeholder="직급을 입력하세요" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">비밀번호 변경</label>
                                                    <input name="password" type="password" defaultValue={currentUser?.password || ''} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" placeholder="새 비밀번호" />
                                                </div>

                                                <div className="pt-2 flex gap-2">
                                                    <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
                                                        저장
                                                    </button>
                                                    <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">
                                                        취소
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </nav>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
