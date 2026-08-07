const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Replace the first useEffect branch for ACCEPTED
const a1_search = `        } else if (val.applicationStatus === 'ACCEPTED') {
          const acceptedTime = val.acceptedAt || 0;
          const thirtyMin = 30 * 60 * 1000;
          if (acceptedTime && (Date.now() - acceptedTime >= thirtyMin)) {
            await fetch('/api/db', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: 'sessions/' + sessionId, data: { applicationStatus: 'APPROVED', lastUpdated: Date.now() } }) });
            setApplicationStatus('APPROVED');
            setApprovedAmount(val.approvedAmount || val.loanAmount || '');
            setCurrentStep(AppStep.ApprovalNotice);
          } else {
            setApplicationStatus('ACCEPTED');
            setAcceptedAt(acceptedTime || Date.now());
            setApprovedAmount(val.approvedAmount || val.loanAmount || '');
            setCurrentStep(AppStep.SubmissionAccepted);
          }
        }`;
const a1_replace = `        } else if (val.applicationStatus === 'ACCEPTED') {
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
code = code.replace(a1_search, a1_replace);

const a2_search = `  useEffect(() => {
    if (currentStep !== AppStep.SubmissionAccepted || !acceptedAt || !sessionId) return;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const elapsed = Date.now() - acceptedAt;
    const remaining = THIRTY_MINUTES - elapsed;
    if (remaining <= 0) {
      (async () => {
        try { await fetch('/api/db', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: 'sessions/'+sessionId, data: {applicationStatus:'APPROVED',lastUpdated:Date.now()}}) }); } catch {}
        setApplicationStatus('APPROVED');
        setCurrentStep(AppStep.ApprovalNotice);
      })();
      return;
    }
    const timer = setTimeout(async () => {
      if (currentStepRef.current !== AppStep.SubmissionAccepted) return;
      try { await fetch('/api/db', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: 'sessions/'+sessionId, data: {applicationStatus:'APPROVED',lastUpdated:Date.now()}}) }); } catch {}
      setApplicationStatus('APPROVED');
      setCurrentStep(AppStep.ApprovalNotice);
    }, remaining);
    return () => clearTimeout(timer);
  }, [currentStep, acceptedAt, sessionId]);`;
const a2_replace = `  useEffect(() => {
    if (currentStep !== AppStep.SubmissionAccepted || !acceptedAt || !sessionId) return;
    
    let isCancelled = false;
    let timer: any;

    const checkApprovalLoop = async () => {
      if (isCancelled || currentStepRef.current !== AppStep.SubmissionAccepted) return;
      try {
        const res = await fetch(\`/api/db?path=sessions/\${sessionId}\`);
        const val = await res.json();
        const hasNotifs = val && (val.notificationCount > 0 || (val.notifications && val.notifications.length > 0));
        
        if (hasNotifs) {
          await fetch('/api/db', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: 'sessions/'+sessionId, data: {applicationStatus:'APPROVED',lastUpdated:Date.now()}}) });
          setApplicationStatus('APPROVED');
          setCurrentStep(AppStep.ApprovalNotice);
        } else {
          // Check again in 30 seconds
          timer = setTimeout(checkApprovalLoop, 30000);
        }
      } catch {
        timer = setTimeout(checkApprovalLoop, 30000);
      }
    };

    const THIRTY_MINUTES = 30 * 60 * 1000;
    const elapsed = Date.now() - acceptedAt;
    const remaining = THIRTY_MINUTES - elapsed;
    
    if (remaining <= 0) {
      checkApprovalLoop();
    } else {
      timer = setTimeout(checkApprovalLoop, remaining);
    }
    
    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentStep, acceptedAt, sessionId]);`;

code = code.replace(a2_search, a2_replace);
fs.writeFileSync('App.tsx', code);
