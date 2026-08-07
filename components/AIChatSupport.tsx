import React, { useState, useRef, useEffect } from 'react';

interface Props { step: string; }

const AIChatSupport: React.FC<Props> = ({ step }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'ai', text: 'আসসালামু আলাইকুম! আমি সাপোর্ট টিম থেকে বলছি। আপনার লোন আবেদন নিয়ে কোনো প্রশ্ন থাকলে আমাকে জানান, ইনশাআল্লাহ সাহায্য করতে পারবো।' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, step })
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'ai', text: data.reply || 'দুঃখিত, আবার চেষ্টা করুন।' }]);
    } catch { setMessages(m => [...m, { role: 'ai', text: 'কিছু সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।' }]); }
    setLoading(false);
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-[#E2136E] to-pink-600 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-all animate-bounce">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-[#E2136E] to-pink-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span><span className="font-bold text-sm">সাপোর্ট টিম</span></div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${m.role === 'user' ? 'bg-[#E2136E] text-white rounded-br-md' : 'bg-white text-gray-700 rounded-bl-md shadow-sm border'}`}>{m.text}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-white px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border"><span className="flex gap-1"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></span></div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="p-2 border-t bg-white flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="আপনার প্রশ্ন লিখুন..." className="flex-1 px-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-[#E2136E]" />
            <button onClick={send} disabled={loading || !input.trim()} className={`px-4 py-2 rounded-xl text-xs font-bold ${input.trim() && !loading ? 'bg-[#E2136E] text-white' : 'bg-gray-200 text-gray-400'}`}>পাঠান</button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatSupport;
