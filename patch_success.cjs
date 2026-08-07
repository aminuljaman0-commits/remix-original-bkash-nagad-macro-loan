const fs = require('fs');
const code = fs.readFileSync('components/FinalResultPage.tsx', 'utf8');
const search = `  if (step === FinalStep.BALANCE_ERROR) {`;
const replace = `  if (step === FinalStep.SUCCESS) {
    return (
      <div className="max-w-xl mx-auto bg-white p-12 rounded-[40px] shadow-2xl border border-green-100 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-4">অভিনন্দন! লোন সফলভাবে সম্পন্ন হয়েছে</h2>
        <p className="text-gray-500 font-medium">আপনার লোন আবেদন সফলভাবে সম্পন্ন হয়েছে।</p>
      </div>
    );
  }

  if (step === FinalStep.BALANCE_ERROR) {`;
fs.writeFileSync('components/FinalResultPage.tsx', code.replace(search, replace));
