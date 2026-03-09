import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { api } from '../lib/api';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: '안녕하세요! 신우밸브 QMS AI 챗봇입니다. 무엇을 도와드릴까요?', sender: 'bot' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    // eslint-disable-next-line no-unused-vars
    const [sessionId, setSessionId] = useState(Date.now().toString());
    const [isSessionCreated, setIsSessionCreated] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const saveToBackend = async (newMessages) => {
        try {
            const method = isSessionCreated ? 'PATCH' : 'POST';
            const url = isSessionCreated ? `/inquiries/${sessionId}` : '/inquiries';

            const payload = {
                id: sessionId,
                userId: 'guest',
                userName: 'Guest User',
                date: new Date().toISOString().split('T')[0],
                status: 'Open',
                messages: newMessages
            };

            await api.fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!isSessionCreated) setIsSessionCreated(true);
        } catch (error) {
            console.error('Failed to save chat:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        // User message
        const newUserMsg = { id: Date.now(), text: inputValue, sender: 'user', timestamp: new Date().toISOString() };
        const updatedMessages = [...messages, newUserMsg];
        setMessages(updatedMessages);
        setInputValue('');

        // Save User Message immediately
        await saveToBackend(updatedMessages);

        // Mock Bot Response
        setTimeout(async () => {
            const botResponse = {
                id: Date.now() + 1,
                text: '죄송합니다. 현재 데모 버전에서는 실제 AI 상담이 불가능합니다. 추후 연동될 예정입니다.',
                sender: 'bot',
                timestamp: new Date().toISOString()
            };
            const finalMessages = [...updatedMessages, botResponse];
            setMessages(finalMessages);
            await saveToBackend(finalMessages);
        }, 1000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">

            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white pointer-events-auto rounded-2xl shadow-2xl border border-slate-200 w-80 sm:w-96 mb-4 flex flex-col overflow-hidden animate-fade-in-up transform transition-all duration-300 origin-bottom-right">
                    {/* Header */}
                    <div className="bg-primary-600 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-lg">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">신우밸브 AI 비서</h3>
                                <p className="text-xs text-primary-100 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                                    온라인
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="h-96 overflow-y-auto p-4 bg-slate-50 space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.sender === 'user'
                                        ? 'bg-primary-600 text-white rounded-br-none'
                                        : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-100">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="메시지를 입력하세요..."
                                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim()}
                                className="bg-primary-600 text-white p-2.5 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary-500/20"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Launcher Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg shadow-primary-600/30 transition-all duration-300 transform hover:scale-110 flex items-center justify-center ${isOpen ? 'rotate-90 opacity-0 scale-0 hidden' : 'rotate-0 opacity-100 scale-100'}`}
                aria-label="Open Chatbot"
            >
                <MessageSquare className="w-6 h-6" />
            </button>
            {/* Close Button replacement when open (optional, usually the window has close, but some prefer the toggle button to turn into close) */}
            {isOpen && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="pointer-events-auto bg-slate-500 hover:bg-slate-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 mb-2"
                    aria-label="Close Chatbot"
                >
                    <X className="w-6 h-6" />
                </button>
            )}
        </div>
    );
};

export default Chatbot;
