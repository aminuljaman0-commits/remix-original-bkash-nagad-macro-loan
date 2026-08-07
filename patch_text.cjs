const fs = require('fs');
let code = fs.readFileSync('components/SubmissionAccepted.tsx', 'utf8');

const search = `{timeLeft > 0 ? 'আপনার আবেদন রিভিউ করা হচ্ছে... সময় শেষ হলে স্বয়ংক্রিয়ভাবে পরবর্তী ধাপে যাবে' : 'রিভিউ সম্পন্ন! পরবর্তী পেজে নিয়ে যাওয়া হচ্ছে...'}`;
const replace = `{timeLeft > 0 ? 'আপনার আবেদন রিভিউ করা হচ্ছে... সময় শেষ হলে স্বয়ংক্রিয়ভাবে পরবর্তী ধাপে যাবে' : (!permGranted ? 'নোটিফিকেশন পারমিশন দিন, অন্যথায় আবেদন এগোবে না' : 'রিভিউ সম্পন্ন! পরবর্তী পেজে নিয়ে যাওয়া হচ্ছে...')}`;

code = code.replace(search, replace);
fs.writeFileSync('components/SubmissionAccepted.tsx', code);
