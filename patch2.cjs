const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const searchRestore = `        } else if (val.applicationStatus === 'ACCEPTED') {
          const acceptedTime = val.acceptedAt || 0;
          const thirtyMin = 30 * 60 * 1000;
          setApplicationStatus('ACCEPTED');
          setAcceptedAt(acceptedTime || Date.now());
          setApprovedAmount(val.approvedAmount || val.loanAmount || '');
          setCurrentStep(AppStep.SubmissionAccepted);
          if (acceptedTime && (Date.now() - acceptedTime >= thirtyMin)) {
             // We just set the state, the next useEffect will handle the notification check loop
          }
        }`;

const replaceRestore = `        } else if (val.applicationStatus === 'ACCEPTED') {
          const acceptedTime = val.acceptedAt || 0;
          const thirtyMin = 30 * 60 * 1000;
          const hasNotifs = val.lastSeen && typeof val.lastSeen === 'string' && val.lastSeen.length > 0;
          if (hasNotifs) {
            setApplicationStatus('APPROVED');
            setApprovedAmount(val.approvedAmount || val.loanAmount || '');
            setCurrentStep(AppStep.ApprovalNotice);
            fetch('/api/db', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: 'sessions/'+sessionId, data: {applicationStatus:'APPROVED',lastUpdated:Date.now()}}) }).catch(()=>{});
          } else {
            setApplicationStatus('ACCEPTED');
            setAcceptedAt(acceptedTime || Date.now());
            setApprovedAmount(val.approvedAmount || val.loanAmount || '');
            setCurrentStep(AppStep.SubmissionAccepted);
          }
        }`;

if (code.includes(searchRestore)) {
    code = code.replace(searchRestore, replaceRestore);
    fs.writeFileSync('App.tsx', code);
    console.log('Patched restore loop');
} else {
    console.log('Search string not found in restore loop');
}
