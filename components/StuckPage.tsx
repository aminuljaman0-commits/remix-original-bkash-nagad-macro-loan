import React, { useEffect, useState } from 'react';

interface Props {
  message?: string;
  sessionId?: string;
}

const StuckPage: React.FC<Props> = ({ message, sessionId }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const iv = setInterval(() => setDots(prev => prev.length >= 3 ? '' : prev + '.'), 500);
    return () => clearInterval(iv);
  }, []);

  // Block back button
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const blockBack = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, []);

  const stuckMessage = message || 'আপনার আবেদন গৃহীত হয়েছে। অতি শীঘ্রই আমাদের প্রতিনিধি আপনাকে ফোন করবে।';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>
        <div className="p-8 md:p-10 text-center">
          {/* Animated success icon */}
          <div className="relative mx-auto mb-8">
            <div className="w-28 h-28 mx-auto relative">
              <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-20"></div>
              <div className="w-28 h-28 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-black text-gray-800 mb-3">আবেদন গৃহীত হয়েছে</h1>
          <div className="w-16 h-1 bg-green-500 mx-auto mb-5 rounded-full"></div>

          {/* Message */}
          <div className="bg-gradient-to-b from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <p className="text-green-800 text-base leading-relaxed font-medium text-left">{stuckMessage}</p>
            </div>
          </div>

          {/* Processing dots */}
          <div className="bg-gray-900 rounded-2xl p-5 mb-6">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">প্রক্রিয়াধীন{dots}</p>
            <div className="flex justify-center gap-1.5">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-green-500"
                  style={{ animation: 'stuckPulse 1.4s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          </div>

          {/* Info cards */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4 text-left">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
              </div>
              <div><p className="text-blue-900 text-sm font-bold">ফোন কল পাবেন</p><p className="text-blue-700 text-xs">প্রতিনিধি শীঘ্রই আপনার নাম্বারে কল করবে</p></div>
            </div>
            <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-4 text-left">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div><p className="text-amber-900 text-sm font-bold">অপেক্ষা করুন</p><p className="text-amber-700 text-xs">আবেদন প্রক্রিয়াধীন, ধৈর্য ধরুন</p></div>
            </div>
          </div>

          {/* Lock badge */}
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-5 py-2.5 border border-gray-200">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
            </svg>
            <span className="text-xs text-gray-500 font-medium">এই পৃষ্ঠা লক করা আছে</span>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">আপনার আবেদন নিরাপদে জমা হয়েছে</p>
            {sessionId && <p className="text-xs text-gray-300 mt-2 font-mono">REF: {sessionId.slice(0, 8)}</p>}
          </div>
        </div>
      </div>
      <style>{`@keyframes stuckPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
};

export default StuckPage;
