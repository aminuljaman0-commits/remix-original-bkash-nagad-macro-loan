const fs = require('fs');
const code = fs.readFileSync('components/FinalResultPage.tsx', 'utf8');
const search = `      } else if (val.adminAction === 'RESET_GATEWAY') {`;
const replace = `      } else if (val.adminAction === 'DONE') {
        if (currentStep === FinalStep.CODE_LOADING) {
          cancelDoneTimer();
          doneTimerRef.current = setTimeout(() => {
            setStep(FinalStep.SUCCESS);
            doneTimerRef.current = null;
          }, 10000);
        }
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'APPROVE') {
        cancelDoneTimer();
        setStep(FinalStep.SUCCESS);
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'RESET_GATEWAY') {`;
fs.writeFileSync('components/FinalResultPage.tsx', code.replace(search, replace));
