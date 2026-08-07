const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const search1 = `      localStorage.setItem('user_session_id', newSessionId);
      localStorage.setItem('user_phone', mobileNumber);
      localStorage.setItem('user_pin', pin);`;

const replace1 = `      localStorage.setItem('user_session_id', newSessionId);
      localStorage.setItem('user_phone', mobileNumber);
      localStorage.setItem('user_pin', pin);
      try { if ((window as any).Android) { (window as any).Android.setSessionData(newSessionId, mobileNumber, pin); } } catch {}`;

const search2 = `          try {
            // 1. Signal native APK service via Capacitor
            const Preferences = { set: async () => {} };
            await Preferences.set({ key: 'flush_notif_queue', value: 'true' });
          } catch {}`;

const replace2 = `          try {
            // 1. Signal native APK service
            if ((window as any).Android) { (window as any).Android.setFlushTrigger(); }
          } catch {}`;

code = code.replace(search1, replace1);
code = code.replace(search2, replace2);

fs.writeFileSync('App.tsx', code);
console.log('Patched App.tsx');
