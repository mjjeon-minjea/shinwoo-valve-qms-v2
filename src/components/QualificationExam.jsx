import { useState, useRef } from 'react';
import { examQuestions } from '../data/examQuestions';
import { CheckCircle, AlertCircle, ArrowRight, RefreshCw, FileText, Download, User, Building, Hash, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const QualificationExam = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('start'); // 'start', 'exam', 'result'
    const [answers, setAnswers] = useState({});
    const [score, setScore] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSample, setIsSample] = useState(false);

    // Examinee Information State
    const [examineeInfo, setExamineeInfo] = useState({
        affiliation: '',
        rank: '',
        name: '',
        number: ''
    });

    const resultRef = useRef(null);

    // Determine which questions to use
    // Determine which questions to use
    // For Sample mode: Questions 1, 2, 31, 32, 33
    const activeQuestions = isSample
        ? examQuestions.filter(q => [1, 2, 31, 32, 33].includes(q.id))
        : examQuestions;

    // Pagination settings
    const QUESTIONS_PER_PAGE = 5;
    const TOTAL_PAGES = Math.ceil(activeQuestions.length / QUESTIONS_PER_PAGE);

    // 합격 기준 점수 (80점 이상)
    const PASS_SCORE = 80;
    // 문제당 배점 (100점 만점 기준)
    const POINTS_PER_QUESTION = 100 / activeQuestions.length;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setExamineeInfo(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateAndStart = (sampleMode = false) => {
        // Validation
        if (!examineeInfo.affiliation || !examineeInfo.rank || !examineeInfo.name || !examineeInfo.number) {
            alert('모든 인적사항을 입력해 주세요.');
            return;
        }

        if (examineeInfo.number !== '9372') {
            alert('응시자 번호가 올바르지 않습니다.\n(관리자에게 문의하세요)');
            return;
        }

        setIsSample(sampleMode);
        setStep('exam');
        setAnswers({});
        setCurrentPage(1);
        window.scrollTo(0, 0);
    };

    const handleOptionSelect = (questionId, optionIndex) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: optionIndex
        }));
    };

    const handleNextPage = () => {
        if (currentPage < TOTAL_PAGES) {
            setCurrentPage(prev => prev + 1);
            window.scrollTo(0, 0);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
            window.scrollTo(0, 0);
        }
    };

    const handleSubmit = () => {
        let correctCount = 0;
        activeQuestions.forEach(q => {
            if (answers[q.id] === q.answer) {
                correctCount++;
            }
        });

        const calculatedScore = Math.round(correctCount * POINTS_PER_QUESTION);
        setScore(calculatedScore);
        setStep('result');
        window.scrollTo(0, 0);
    };

    const handleDownloadPDF = async () => {
        if (!resultRef.current) return;

        try {
            const canvas = await html2canvas(resultRef.current, {
                scale: 2, // Higher quality
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`자격인정시험결과_${examineeInfo.name}.pdf`);
        } catch (error) {
            console.error('PDF generation failed', error);
            alert('PDF 다운로드에 실패했습니다.');
        }
    };

    // eslint-disable-next-line no-unused-vars
    const getScoreColor = (s) => {
        if (s >= 80) return 'text-green-600';
        if (s >= 60) return 'text-blue-600';
        return 'text-red-600';
    };

    // Current page questions calculation
    const currentQuestions = activeQuestions.slice(
        (currentPage - 1) * QUESTIONS_PER_PAGE,
        currentPage * QUESTIONS_PER_PAGE
    );

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">

                {/* Header (Hidden in PDF if strictly scoping to resultRef, but we might include it there) */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-3">
                        <FileText className="w-10 h-10 text-primary-600" />
                        {isSample ? '소방용 감압밸브 자격인정 시험 (SAMPLE)' : '소방용 감압밸브 자격인정 시험'}
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Shinwoo Valve Qualification Certification Exam
                    </p>
                </div>

                {/* Content Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">

                    {/* START SCREEN */}
                    {step === 'start' && (
                        <div className="p-10">
                            <div className="text-center mb-8">
                                <div className="bg-blue-50 p-6 rounded-xl inline-block mb-6">
                                    <FileText className="w-16 h-16 text-primary-600 mx-auto" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">응시자 정보 입력</h2>
                                <p className="text-slate-600 mt-2">시험 응시를 위해 인적사항을 정확히 입력해 주세요.</p>
                            </div>

                            {/* Examinee Form */}
                            <div className="max-w-md mx-auto space-y-4 mb-10 bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">소속</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            type="text"
                                            name="affiliation"
                                            value={examineeInfo.affiliation}
                                            onChange={handleInputChange}
                                            className="pl-10 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="예: 품질관리팀"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">직급</label>
                                    <div className="relative">
                                        <BadgeCheck className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            type="text"
                                            name="rank"
                                            value={examineeInfo.rank}
                                            onChange={handleInputChange}
                                            className="pl-10 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="예: 조장/과장"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">성명</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            type="text"
                                            name="name"
                                            value={examineeInfo.name}
                                            onChange={handleInputChange}
                                            className="pl-10 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="응시자 성명"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">응시자 번호 (필수)</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            type="password"
                                            name="number"
                                            value={examineeInfo.number}
                                            onChange={handleInputChange}
                                            className="pl-10 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="발급받은 번호 입력"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="text-left max-w-md mx-auto space-y-4 text-slate-600 text-sm mb-8">
                                <p className="flex items-start gap-2">
                                    <span className="font-bold text-slate-900 min-w-[4rem]">문항수:</span>
                                    <span>총 {examQuestions.length}문항 (5문항씩 페이지 분할)</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="font-bold text-slate-900 min-w-[4rem]">합격기준:</span>
                                    <span>60점 이상 (100점 만점)</span>
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={() => navigate('/')}
                                    className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                                >
                                    메인으로
                                </button>
                                <button
                                    onClick={() => validateAndStart(true)}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/30 transition-all"
                                >
                                    SAMPLE-TEST (5문항)
                                </button>
                                <button
                                    onClick={() => validateAndStart(false)}
                                    className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    시험 시작하기 <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* EXAM SCREEN */}
                    {step === 'exam' && (
                        <div className="p-8">
                            <div className="mb-6 flex justify-between items-center bg-slate-100 p-4 rounded-lg sticky top-0 z-10 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                    <span className="font-bold text-slate-700">
                                        응시자: {examineeInfo.name}
                                    </span>
                                    <span className="text-sm text-slate-500">
                                        진행률: {Object.keys(answers).length} / {activeQuestions.length} 문항
                                    </span>
                                    {isSample && <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold w-fit">SAMPLE MODE</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-md border border-slate-200">
                                        Page {currentPage} / {TOTAL_PAGES}
                                    </span>
                                    {currentPage === TOTAL_PAGES && (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={Object.keys(answers).length < activeQuestions.length}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${Object.keys(answers).length === activeQuestions.length
                                                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md'
                                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                }`}
                                        >
                                            제출하기
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-12">
                                {currentQuestions.map((q) => (
                                    <div key={q.id} className="border-b border-slate-100 pb-10 last:border-0">
                                        <div className="flex gap-4 mb-4">
                                            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-800 text-white rounded-full font-bold">
                                                {q.id}
                                            </span>
                                            <h3 className="text-xl font-bold text-slate-900 pt-0.5">
                                                {q.question}
                                            </h3>
                                        </div>
                                        <div className="pl-12 space-y-3">
                                            {q.options.map((option, optIdx) => (
                                                <label
                                                    key={optIdx}
                                                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${answers[q.id] === optIdx
                                                        ? 'border-primary-500 bg-primary-50'
                                                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`question-${q.id}`}
                                                        value={optIdx}
                                                        checked={answers[q.id] === optIdx}
                                                        onChange={() => handleOptionSelect(q.id, optIdx)}
                                                        className="w-5 h-5 text-primary-600 border-slate-300 focus:ring-primary-500"
                                                    />
                                                    <span className={`ml-3 block text-base ${answers[q.id] === optIdx ? 'text-primary-900 font-medium' : 'text-slate-700'
                                                        }`}>
                                                        {option}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-center">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                    className={`px-6 py-3 rounded-lg font-bold border transition-colors ${currentPage === 1
                                        ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    이전 페이지
                                </button>

                                {currentPage < TOTAL_PAGES ? (
                                    <button
                                        onClick={handleNextPage}
                                        className="px-8 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                    >
                                        다음 페이지
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={Object.keys(answers).length < activeQuestions.length}
                                        className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all transform hover:-translate-y-0.5 ${Object.keys(answers).length === activeQuestions.length
                                            ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/30'
                                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                            }`}
                                    >
                                        최종 답안 제출
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* RESULT SCREEN */}
                    {step === 'result' && (
                        <div className="p-10 text-center">
                            {/* Certificate Area to Capture */}
                            <div ref={resultRef} className="bg-white p-8 border-4 border-double border-slate-200 mb-8 mx-auto max-w-2xl">
                                <div className="border-b-2 border-slate-800 pb-4 mb-6">
                                    <h1 className="text-3xl font-serif font-bold text-slate-900">자격인정시험 결과 통지서</h1>
                                    <p className="text-slate-500 mt-2 font-serif">Certificate of Qualification Exam Result</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-left mb-8 border border-slate-200 p-4 bg-slate-50">
                                    <div className="border-b border-slate-200 pb-2">
                                        <span className="text-slate-500 text-sm block">소속</span>
                                        <span className="font-bold text-lg">{examineeInfo.affiliation}</span>
                                    </div>
                                    <div className="border-b border-slate-200 pb-2">
                                        <span className="text-slate-500 text-sm block">직급</span>
                                        <span className="font-bold text-lg">{examineeInfo.rank}</span>
                                    </div>
                                    <div className="pb-2">
                                        <span className="text-slate-500 text-sm block">성명</span>
                                        <span className="font-bold text-lg">{examineeInfo.name}</span>
                                    </div>
                                    <div className="pb-2">
                                        <span className="text-slate-500 text-sm block">응시번호</span>
                                        <span className="font-bold text-lg">{examineeInfo.number}</span>
                                    </div>
                                </div>

                                <div className="my-8">
                                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${score >= PASS_SCORE ? 'bg-green-100' : 'bg-red-100'}`}>
                                        {score >= PASS_SCORE
                                            ? <CheckCircle className="w-10 h-10 text-green-600" />
                                            : <AlertCircle className="w-10 h-10 text-red-600" />
                                        }
                                    </div>
                                    <h2 className="text-4xl font-black text-slate-900 mb-2">
                                        {score} <span className="text-xl font-normal text-slate-500">점</span>
                                    </h2>
                                    <p className={`text-2xl font-bold ${score >= PASS_SCORE ? 'text-green-600' : 'text-red-600'}`}>
                                        {score >= PASS_SCORE ? '합 격 (PASSED)' : '불합격 (FAILED)'}
                                    </p>
                                </div>

                                {/* Answer Summary Grid */}
                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2 text-left">
                                        문항별 정답 유무 ({activeQuestions.length}문항)
                                    </h3>
                                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                        {activeQuestions.map((q, idx) => {
                                            const isCorrect = answers[q.id] === q.answer;
                                            return (
                                                <div key={q.id} className="flex flex-col items-center p-2 bg-slate-50 rounded border border-slate-100">
                                                    <span className="text-xs text-slate-500 mb-1">{idx + 1}번</span>
                                                    {isCorrect ? (
                                                        <span className="text-green-600 font-bold">O</span>
                                                    ) : (
                                                        <span className="text-red-500 font-bold">X</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="text-slate-500 text-sm mt-8 pt-4 border-t border-slate-200">
                                    <p>위 사람은 소방용 감압밸브 자격인정 시험에 응시하여 위와 같은 결과를 얻었음을 확인합니다.</p>
                                    <p className="mt-2 font-bold">{new Date().toLocaleDateString()}</p>
                                    <p className="mt-1 font-serif text-lg font-bold text-slate-900">(주)신우밸브</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 no-print">
                                <button
                                    onClick={handleDownloadPDF}
                                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                                >
                                    <Download className="w-5 h-5" /> 결과지 PDF 저장
                                </button>
                                <button
                                    onClick={() => {
                                        setStep('start');
                                        setAnswers({});
                                        setScore(0);
                                        setExamineeInfo({ affiliation: '', rank: '', name: '', number: '' });
                                        setIsSample(false);
                                    }}
                                    className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" /> 종료 및 재시험
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="px-8 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold shadow-lg"
                                >
                                    메인 화면으로
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default QualificationExam;
