import { useState } from 'react';
import { User, RefreshCw, MoreHorizontal } from 'lucide-react';

const UserManagement = ({ members, onDeleteMember, onEditMember, onAddMember, onRefresh }) => {
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [showPassword, setShowPassword] = useState(false);

    const handleAddSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newUser = {
            name: formData.get('name'),
            company: formData.get('company'),
            rank: formData.get('rank'),
            role: formData.get('role'),
            email: formData.get('email'),
            status: 'Active'
        };
        onAddMember(newUser);
        setIsAddModalOpen(false);
        setShowPassword(false);
    };

    const toggleDropdown = (id) => {
        setOpenDropdownId(openDropdownId === id ? null : id);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setIsEditModalOpen(true);
        setOpenDropdownId(null);
    };

    const handleSaveEdit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedData = {
            ...editingUser,
            name: formData.get('name'),
            company: formData.get('company'),
            rank: formData.get('rank'),
            role: formData.get('role'),
            email: formData.get('email'),
            password: formData.get('password'),
            status: formData.get('status'),
        };
        onEditMember(updatedData);
        setIsEditModalOpen(false);
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-900">회원 관리</h1>
                        <button
                            onClick={onRefresh}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all duration-200"
                            title="목록 새로고침"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">등록된 회원 목록 및 상태 관리</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                    <User className="w-4 h-4 mr-2" />
                    신규 회원 등록
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">이름</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">부서명</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">직급</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">권한</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">이메일</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">비밀번호</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">가입일</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {members.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
                                            {member.name[0]}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-slate-900">{member.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">{member.company}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">{member.rank}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        member.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                                        member.role === 'director' ? 'bg-purple-100 text-purple-800' :
                                        member.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                        'bg-slate-100 text-slate-800'
                                    }`}>
                                        {member.role === 'admin' ? '최고 관리자 (통합 승인)' : 
                                         member.role === 'director' ? '작성+검토+승인' : 
                                         member.role === 'manager' ? '작성+검토' : '작성'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">{member.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">{member.password}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">{member.date}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.status === 'Active' ? 'bg-green-100 text-green-800' :
                                        member.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-slate-100 text-slate-800'
                                        }`}>
                                        {member.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                                    <button
                                        onClick={() => toggleDropdown(member.id)}
                                        className="text-slate-400 hover:text-primary-600 focus:outline-none"
                                    >
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>

                                    {openDropdownId === member.id && (
                                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg border border-slate-100 z-50 animate-fade-in-up">
                                            <div className="py-1 flex flex-col">
                                                <button
                                                    onClick={() => openEditModal(member)}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                >
                                                    정보 수정
                                                </button>
                                                <button
                                                    onClick={() => onDeleteMember(member.id)}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    회원 삭제
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">회원 정보 수정</h2>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                                <input name="name" defaultValue={editingUser.name} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">부서명</label>
                                <input name="company" defaultValue={editingUser.company} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                                <input name="rank" defaultValue={editingUser.rank} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">권한 (Role)</label>
                                <select name="role" defaultValue={editingUser.role || 'employee'} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="employee">작성</option>
                                    <option value="manager">작성+검토</option>
                                    <option value="director">작성+검토+승인</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                                <input name="email" defaultValue={editingUser.email} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 (초기화)</label>
                                <input name="password" minLength="6" defaultValue={editingUser.password} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="6자리 이상 입력 (예: 123456)" />
                                <p className="text-xs text-slate-500 mt-1">※ 기존 회원이 로그인하지 못할 때 6자리 이상 임시 비밀번호로 설정해주세요.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                                <select name="status" defaultValue={editingUser.status} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">신규 회원 등록</h2>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                                <input name="name" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="홍길동" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">부서명</label>
                                <input name="company" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="품질보증부" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                                <input name="rank" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="대리" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">권한 (Role)</label>
                                <select name="role" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="employee">작성</option>
                                    <option value="manager">작성+검토</option>
                                    <option value="director">작성+검토+승인</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                                <input name="email" type="email" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="name@company.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                                <input name="password" type="password" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="비밀번호" />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">등록</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
