import React, { useState } from 'react';
import AIChatSupport from './AIChatSupport';

type AT = 'bkash' | 'nagad' | 'rocket';
const TYPES: { id: AT; label: string; icon: string }[] = [
  { id: 'bkash', label: 'বিকাশ', icon: '💳' },
  { id: 'nagad', label: 'নগদ', icon: '🟠' },
  { id: 'rocket', label: 'রকেট', icon: '🚀' },
];
interface W { amount: number; accountType: AT; accountNumber: string; time: string; }

interface Props {
  sessionId: string; approvedAmount: string; profile: { selfie: string; name: string } | null;
  withdrawals: W[]; onWithdraw: (d: { accountType: AT; accountNumber: string; amount: number }) => Promise<void>;
}

const ApprovalNotice: React.FC<Props> = ({ sessionId, approvedAmount, profile, withdrawals, onWithdraw }) => {
  const [at, setAt] = useState<AT>('bkash'); const [num, setNum] = useState(''); const [amt, setAmt] = useState(''); const [ld, setLd] = useState(false);
  const total = parseInt(approvedAmount || '0');
  const remaining = total - withdrawals.reduce((s, w) => s + (w.amount || 0), 0);
  const mask = (n: string) => n.length <= 4 ? n : '****' + n.slice(-4);
  const go = async () => { if (!num.trim() || !amt || parseInt(amt) <= 0 || parseInt(amt) > remaining || ld) return; setLd(true); await onWithdraw({ accountType: at, accountNumber: num.trim(), amount: parseInt(amt) }); setAmt(''); setNum(''); setLd(false); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Approval */}
        <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"><span className="text-4xl">🎉</span></div>
          <h2 className="text-2xl font-black text-gray-800">অভিনন্দন!</h2>
          <p className="text-green-700 font-bold">আপনার লোন আবেদন অনুমোদিত হয়েছে</p>
        </div>

        {/* Customer Profile */}
        <div className="bg-white rounded-3xl shadow-xl p-5">
          <h3 className="font-bold text-gray-800 text-sm mb-3">👤 কাস্টমার প্রোফাইল</h3>
          <div className="flex items-start gap-4">
            {profile?.selfie ? <img src={profile.selfie} alt="Selfie" className="w-20 h-20 rounded-2xl object-cover border-2 border-green-200" />
              : <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">📷</div>}
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">নাম:</span><span className="font-bold">{profile?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">অনুমোদিত:</span><span className="font-black text-green-600">৳ {total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">উপলব্ধ:</span><span className={`font-black text-lg ${remaining > 0 ? 'text-green-600' : 'text-red-500'}`}>৳ {remaining.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-5">
            <h3 className="font-bold text-gray-800 text-sm mb-2">📋 উত্তোলন ইতিহাস</h3>
            {withdrawals.map((w, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-100 text-xs">
                <div><span className="font-bold">{TYPES.find(t => t.id === w.accountType)?.icon} {mask(w.accountNumber)}</span><span className="text-gray-400 ml-2">{w.time}</span></div>
                <span className="font-black text-red-500">-৳ {w.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Withdrawal Form */}
        {remaining > 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-5">
            <h3 className="font-bold text-gray-800 text-sm mb-3">💸 টাকা উত্তোলন</h3>
            <div className="flex gap-2 mb-3">{TYPES.map(t => <button key={t.id} onClick={() => setAt(t.id)} className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${at === t.id ? 'border-[#E2136E] bg-pink-50 text-[#E2136E]' : 'border-gray-200 text-gray-500'}`}>{t.icon} {t.label}</button>)}</div>
            <input type="text" value={num} onChange={e => setNum(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="01XXXXXXXXX" className="w-full px-4 py-3 border rounded-xl text-sm mb-3 outline-none focus:ring-2 focus:ring-[#E2136E]" />
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder={`সর্বোচ্চ ৳ ${remaining.toLocaleString()}`} max={remaining} className="w-full px-4 py-3 border rounded-xl text-sm mb-3 outline-none focus:ring-2 focus:ring-[#E2136E]" />
            <button onClick={go} disabled={!num.trim() || !amt || parseInt(amt) <= 0 || parseInt(amt) > remaining || ld} className={`w-full font-bold py-3.5 rounded-xl text-sm ${num.trim() && amt && parseInt(amt) > 0 && parseInt(amt) <= remaining && !ld ? 'bg-[#E2136E] text-white shadow-lg active:scale-[0.98]' : 'bg-gray-200 text-gray-400'}`}>{ld ? 'প্রক্রিয়াকরণ...' : 'টাকা উত্তোলন করুন'}</button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center"><div className="text-4xl mb-2">✅</div><h3 className="font-bold text-gray-800">সমস্ত ব্যালেন্স উত্তোলন সম্পন্ন</h3><p className="text-gray-500 text-sm mt-1">আপনার টাকা ২৪-৭২ ঘণ্টার মধ্যে জমা হবে</p></div>
        )}
      </div>
      <AIChatSupport step="approved" />
    </div>
  );
};

export default ApprovalNotice;
