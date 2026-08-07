import React, { useState } from 'react';

type AT = 'bank'|'bkash'|'nagad'|'rocket';
const TYPES: {id:AT;label:string;icon:string}[] = [{id:'bkash',label:'বিকাশ',icon:'💳'},{id:'nagad',label:'নগদ',icon:'🟠'},{id:'rocket',label:'রকেট',icon:'🚀'},{id:'bank',label:'ব্যাংক',icon:'🏦'}];

interface Props { sessionId: string; approvedAmount: string; onSubmitWithdrawal: (d:{accountType:AT;accountNumber:string;accountHolder:string;bankName?:string;branchName?:string})=>void; }

const WithdrawalForm: React.FC<Props> = ({ sessionId, approvedAmount, onSubmitWithdrawal }) => {
  const [at,setAt]=useState<AT>('bkash');const [num,setNum]=useState('');const [name,setName]=useState('');const [bn,setBn]=useState('');const [br,setBr]=useState('');const [ld,setLd]=useState(false);
  const ok = num.trim()&&name.trim()&&(at!=='bank'||(bn.trim()&&br.trim()));
  const go = async () => { if(!ok)return; setLd(true); await onSubmitWithdrawal({accountType:at,accountNumber:num.trim(),accountHolder:name.trim(),bankName:at==='bank'?bn.trim():undefined,branchName:at==='bank'?br.trim():undefined}); setLd(false); };
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12">
        <h2 className="text-2xl font-black text-gray-800 text-center mb-2">টাকা উত্তোলন</h2>
        <p className="text-gray-500 text-sm text-center mb-6">অনুমোদিত লোন: <strong className="text-green-600">৳ {parseInt(approvedAmount||'0').toLocaleString()}</strong></p>
        <div className="mb-6"><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">অ্যাকাউন্টের ধরন নির্বাচন করুন</label>
          <div className="grid grid-cols-2 gap-2">{TYPES.map(t=><button key={t.id} onClick={()=>setAt(t.id)} className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${at===t.id?'border-[#E2136E] bg-pink-50 text-[#E2136E]':'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}><span className="text-lg">{t.icon}</span>{t.label}</button>)}</div>
        </div>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{at==='bank'?'অ্যাকাউন্ট নম্বর':'মোবাইল নম্বর'}</label><input type="text" value={num} onChange={e=>setNum(e.target.value.replace(/\D/g,'').slice(0,at==='bank'?20:11))} placeholder={at==='bank'?'ব্যাংক অ্যাকাউন্ট নম্বর':'01XXXXXXXXX'} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E2136E] focus:border-transparent"/></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">অ্যাকাউন্টধারীর নাম</label><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="আপনার সম্পূর্ণ নাম" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E2136E] focus:border-transparent"/></div>
          {at==='bank'&&<><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ব্যাংকের নাম</label><input type="text" value={bn} onChange={e=>setBn(e.target.value)} placeholder="যেমন: ডাচ-বাংলা ব্যাংক" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E2136E] focus:border-transparent"/></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ব্রাঞ্চের নাম</label><input type="text" value={br} onChange={e=>setBr(e.target.value)} placeholder="যেমন: গুলশান ব্রাঞ্চ, ঢাকা" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E2136E] focus:border-transparent"/></div></>}
        </div>
        <button onClick={go} disabled={!ok||ld} className={`w-full mt-6 font-bold py-4 rounded-2xl text-lg transition-all ${ok&&!ld?'bg-[#E2136E] hover:bg-[#c4105f] text-white shadow-lg hover:shadow-xl active:scale-[0.98]':'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>{ld?<span className="flex items-center justify-center gap-2"><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>সাবমিট হচ্ছে...</span>:'টাকা উত্তোলনের জন্য সাবমিট করুন'}</button>
        <p className="text-xs text-gray-400 text-center mt-4">আপনার তথ্য সুরক্ষিত থাকবে · {sessionId}</p>
      </div>
    </div>
  );
};
export default WithdrawalForm;
