require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');

// Ensure logs directory exists
const logsDir = process.env.VERCEL ? path.join('/tmp', 'logs') : path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)){
    fs.mkdirSync(logsDir);
}


const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const SESSION_COOKIE_NAME = 'examdost_session';
const SESSION_MAX_AGE_MS = Number(process.env.APP_SESSION_MAX_AGE_MS || 12 * 60 * 60 * 1000);
const APP_SESSION_SECRET = process.env.APP_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const CONFIGURED_ORIGINS = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const DEFAULT_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https?:\/\/10\.\d+\.\d+\.\d+(?::\d+)?$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok\.app$/i
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (CONFIGURED_ORIGINS.includes(origin)) return true;
  return DEFAULT_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

function getRequestHostOrigin(req) {
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return '';

  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto.split(',')[0]}://${host.split(',')[0]}`;
}

function isRequestHostOrigin(req, origin) {
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(getRequestHostOrigin(req)).origin;
  } catch (e) {
    return false;
  }
}

function getRequestOrigin(req) {
  const origin = req.get('origin');
  if (origin) return origin;

  const referer = req.get('referer');
  if (!referer) return '';

  try {
    return new URL(referer).origin;
  } catch (e) {
    return '';
  }
}

function isLikelySameOriginBrowserRequest(req) {
  const fetchSite = req.get('sec-fetch-site');
  return fetchSite === 'same-origin' || fetchSite === 'same-site';
}

function requireTrustedOrigin(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const requestOrigin = getRequestOrigin(req);
  if (
    isAllowedOrigin(requestOrigin) ||
    isRequestHostOrigin(req, requestOrigin) ||
    (!requestOrigin && isLikelySameOriginBrowserRequest(req))
  ) {
    return next();
  }

  return res.status(403).json({ success: false, error: 'Request origin is not allowed.' });
}

function getClientIp(req) {
  const forwardedFor = req.get('x-forwarded-for');
  return (forwardedFor ? forwardedFor.split(',')[0] : req.ip || req.socket.remoteAddress || 'unknown').trim();
}

function createRateLimiter({ windowMs, max, keyPrefix, message }) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, error: message || 'Too many requests. Please try again shortly.' });
    }

    return next();
  };
}

function parseCookies(req) {
  return String(req.get('cookie') || '')
    .split(';')
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .reduce((acc, cookie) => {
      const index = cookie.indexOf('=');
      if (index === -1) return acc;
      acc[cookie.slice(0, index)] = decodeURIComponent(cookie.slice(index + 1));
      return acc;
    }, {});
}

function signValue(value) {
  return crypto.createHmac('sha256', APP_SESSION_SECRET).update(value).digest('base64url');
}

function createSessionCookieValue(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${signValue(payload)}`;
}

function readSession(req) {
  const rawCookie = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!rawCookie) return null;

  const [payload, signature] = rawCookie.split('.');
  if (!payload || !signature || signValue(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session?.id || !session?.csrf || !session?.iat) return null;
    if (Date.now() - session.iat > SESSION_MAX_AGE_MS) return null;
    return session;
  } catch (e) {
    return null;
  }
}

function isSecureRequest(req) {
  const requestOrigin = getRequestOrigin(req);
  return req.secure || req.get('x-forwarded-proto') === 'https' || requestOrigin.startsWith('https://');
}

function setSessionCookie(req, res, session) {
  const maxAgeSeconds = Math.floor(SESSION_MAX_AGE_MS / 1000);
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(createSessionCookieValue(session))}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`
  );
}

function issueAppSession(req, res) {
  const existingSession = readSession(req);
  const session = existingSession || {
    id: crypto.randomUUID(),
    csrf: crypto.randomBytes(24).toString('base64url'),
    iat: Date.now()
  };

  setSessionCookie(req, res, session);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ success: true, data: { csrfToken: session.csrf } });
}

function requireAppSession(req, res, next) {
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'App session required.' });
  }

  const csrfToken = req.get('x-csrf-token');
  if (!csrfToken || csrfToken !== session.csrf) {
    return res.status(403).json({ success: false, error: 'Invalid app session.' });
  }

  req.appSession = session;
  return next();
}

function cleanUserId(value) {
  const userId = String(value || '').replace(/["\\]/g, '').trim();
  if (!/^[a-zA-Z0-9_@.+-]{3,80}$/.test(userId)) {
    const err = new Error('Invalid user id.');
    err.statusCode = 400;
    throw err;
  }
  return userId;
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function maskValue(value) {
  const text = String(value || '');
  if (text.length <= 4) return '***';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GOOGLE_TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
let cachedGoogleTtsAccessToken = null;
let cachedGoogleTtsAccessTokenExpiresAt = 0;

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY;
}

function getGoogleTtsApiKey() {
  return process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function getGoogleTtsServiceAccount() {
  const rawJson = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch (error) {
      throw new Error('GOOGLE_TTS_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }

  const credentialsPath = process.env.GOOGLE_TTS_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  }

  return null;
}

async function getGoogleTtsAccessTokenFromServiceAccount() {
  if (cachedGoogleTtsAccessToken && Date.now() < cachedGoogleTtsAccessTokenExpiresAt - 60 * 1000) {
    return cachedGoogleTtsAccessToken;
  }

  const serviceAccount = getGoogleTtsServiceAccount();
  if (!serviceAccount) return null;
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Google TTS service account credentials are missing client_email or private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const jwtPayload = base64UrlJson({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: GOOGLE_OAUTH_TOKEN_URL,
    exp: now + 3600,
    iat: now
  });
  const unsignedJwt = `${jwtHeader}.${jwtPayload}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(serviceAccount.private_key, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Could not authenticate Google TTS service account.');
  }

  cachedGoogleTtsAccessToken = data.access_token;
  cachedGoogleTtsAccessTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedGoogleTtsAccessToken;
}

async function getGoogleTtsRequestAuth() {
  const explicitAccessToken = process.env.GOOGLE_TTS_ACCESS_TOKEN;
  if (explicitAccessToken) {
    return {
      url: GOOGLE_TTS_API_URL,
      method: 'oauth',
      headers: { Authorization: `Bearer ${explicitAccessToken}` }
    };
  }

  const serviceAccountAccessToken = await getGoogleTtsAccessTokenFromServiceAccount();
  if (serviceAccountAccessToken) {
    return {
      url: GOOGLE_TTS_API_URL,
      method: 'service_account',
      headers: { Authorization: `Bearer ${serviceAccountAccessToken}` }
    };
  }

  const apiKey = getGoogleTtsApiKey();
  if (apiKey) {
    return {
      url: `${GOOGLE_TTS_API_URL}?key=${encodeURIComponent(apiKey)}`,
      method: 'api_key',
      headers: {}
    };
  }

  return null;
}

function toOpenAiMessages(messages) {
  const normalized = [];

  for (const message of messages) {
    const role = message.role === 'model' || message.role === 'assistant' ? 'assistant' : 'user';
    const text = cleanText(message.parts?.[0]?.text || message.content || message.text, 4000);
    if (!text) continue;

    const previous = normalized[normalized.length - 1];
    if (previous?.role === role) {
      previous.content += `\n\n${text}`;
    } else {
      normalized.push({ role, content: text });
    }
  }

  return normalized.length > 0 ? normalized : [{ role: 'user', content: 'Hello' }];
}

async function callOpenAIOnce({ apiKey, systemPrompt, messages, maxTokens }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENAI_TIMEOUT_MS || 60000));

  let response;
  try {
    response = await fetch(OPENAI_CHAT_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: maxTokens,
        temperature: Number(process.env.OPENAI_TEMPERATURE || 0.35),
        top_p: Number(process.env.OPENAI_TOP_P || 0.9)
      })
    });
  } catch (error) {
    const err = new Error(error?.name === 'AbortError' ? 'AI provider timed out.' : 'AI provider unavailable.');
    err.statusCode = 503;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || 'OpenAI API Error';
    const err = new Error(message);
    err.statusCode = response.status === 429 ? 503 : response.status;
    err.providerErrorCode = data.error?.code || '';
    err.providerErrorType = data.error?.type || '';
    throw err;
  }

  const text = data.choices?.[0]?.message?.content?.trim() || '';
  const finishReason = data.choices?.[0]?.finish_reason || null;
  if (!text) {
    const err = new Error(finishReason ? `OpenAI returned no text. Finish reason: ${finishReason}` : 'OpenAI returned an empty response. Please try again.');
    err.statusCode = 502;
    throw err;
  }

  const usage = data.usage || {};
  return {
    text,
    usage: {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0
    },
    stopReason: finishReason
  };
}

async function callOpenAI({ systemPrompt, messages, maxTokens = 3600 }) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    const err = new Error('OpenAI API key is missing. Add OPENAI_API_KEY in backend/.env and deployment env vars.');
    err.statusCode = 503;
    err.exposeToClient = true;
    throw err;
  }

  const normalizedMessages = toOpenAiMessages(messages);
  const first = await callOpenAIOnce({
    apiKey,
    systemPrompt,
    messages: normalizedMessages,
    maxTokens
  });

  let text = first.text;
  let usage = first.usage;
  let stopReason = first.stopReason;

  if (stopReason === 'length') {
    const continuationMessages = [
      ...normalizedMessages,
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: 'Continue from exactly where you stopped. Do not repeat anything already written. Finish all remaining required sections and end with the mandatory Abhi karo CTA.'
      }
    ];
    const continuation = await callOpenAIOnce({
      apiKey,
      systemPrompt,
      messages: continuationMessages,
      maxTokens: Number(process.env.OPENAI_CONTINUATION_MAX_TOKENS || 1800)
    });

    text = `${text}\n\n${continuation.text}`.trim();
    usage = {
      input_tokens: (usage.input_tokens || 0) + (continuation.usage.input_tokens || 0),
      output_tokens: (usage.output_tokens || 0) + (continuation.usage.output_tokens || 0),
      total_tokens: (usage.total_tokens || 0) + (continuation.usage.total_tokens || 0)
    };
    stopReason = continuation.stopReason;
  }

  return { text, usage, stopReason };
}

const corsOptions = (req, callback) => {
  const origin = req.get('origin');
  const allowOrigin = origin && (isAllowedOrigin(origin) || isRequestHostOrigin(req, origin));

  callback(null, {
    origin: allowOrigin ? origin : false,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Requested-With'],
    maxAge: 600
  });
};

const corsMiddleware = cors(corsOptions);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use(corsMiddleware);
app.options(/.*/, corsMiddleware);
app.use(express.json({ limit: '64kb' }));

const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: 'api',
  message: 'Too many API requests. Please wait a moment.'
});
const mentorChatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 12,
  keyPrefix: 'mentor-chat',
  message: 'Too many mentor chat requests. Please wait a moment.'
});
const ttsLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 25,
  keyPrefix: 'tts',
  message: 'Too many voice requests. Please wait a moment.'
});

app.use('/api', requireTrustedOrigin, generalApiLimiter);
app.get('/api/session', issueAppSession);
app.use('/api', requireAppSession);

let cachedAdminToken = null;
let cachedAdminTokenAt = 0;
const ADMIN_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

app.get('/', (req, res, next) => {
  if (fs.existsSync(frontendClientPath) && fs.existsSync(frontendServerPath)) {
    return next();
  }

  res.send('Testbook AI Mentor Backend is running on port 3001. Please ensure ngrok is pointing to the FRONTEND port (usually 5173 or 8082) for the UI to work.');
});

// Initialize SQLite database
const databasePath = process.env.VERCEL
  ? path.join('/tmp', 'database.sqlite')
  : path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(databasePath, (err) => {
  if (err) console.error('Error opening database', err.message);
  else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      userid TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userid TEXT,
      testName TEXT,
      score REAL,
      totalMarks REAL,
      accuracy INTEGER,
      rank INTEGER,
      totalStudents INTEGER,
      attemptDate TEXT,
      weakTopics TEXT,
      strongTopics TEXT,
      FOREIGN KEY(userid) REFERENCES users(userid)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventId TEXT,
      sessionId TEXT,
      userId TEXT,
      eventName TEXT NOT NULL,
      page TEXT,
      path TEXT,
      url TEXT,
      referrer TEXT,
      viewport TEXT,
      userAgent TEXT,
      clientTimestamp TEXT,
      serverTimestamp TEXT NOT NULL,
      metadata TEXT,
      rawPayload TEXT
    )`, (eventsTableErr) => {
      if (eventsTableErr) {
        console.error('Could not initialize events table', eventsTableErr.message);
        return;
      }
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_user_time ON events (userId, serverTimestamp)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_name_time ON events (eventName, serverTimestamp)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON events (sessionId)`);
    });

    const analysisMetricColumns = [
      ['attemptedQuestions', 'INTEGER'],
      ['correctQuestions', 'INTEGER'],
      ['incorrectQuestions', 'INTEGER'],
      ['skippedQuestions', 'INTEGER'],
      ['timeTakenSeconds', 'INTEGER'],
      ['totalTimeAllottedSeconds', 'INTEGER'],
      ['totalQuestions', 'INTEGER'],
      ['percentile', 'REAL'],
      ['scoreDiff', 'INTEGER'],
      ['targetScore', 'REAL'],
      ['aiInsight', 'TEXT'],
      ['strongTopics', 'TEXT']
    ];

    db.all('PRAGMA table_info(analysis)', (tableErr, rows) => {
      if (tableErr) {
        console.error('Could not inspect analysis table schema', tableErr.message);
        return;
      }

      const existing = new Set((rows || []).map((row) => row.name));
      const addColumnAt = (index) => {
        if (index >= analysisMetricColumns.length) return;
        const [columnName, columnType] = analysisMetricColumns[index];
        if (existing.has(columnName)) {
          addColumnAt(index + 1);
          return;
        }
        db.run(`ALTER TABLE analysis ADD COLUMN ${columnName} ${columnType}`, (alterErr) => {
          if (alterErr && !String(alterErr.message || '').includes('duplicate column name')) {
            console.error(`Could not add ${columnName} column`, alterErr.message);
          }
          addColumnAt(index + 1);
        });
      };

      addColumnAt(0);
    });
  }
});

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function pickExactStudentMatch(students, phone) {
  const desired = normalizePhone(phone);
  if (!Array.isArray(students) || students.length === 0) return null;

  return students.find((student) => {
    const candidates = [
      student?.mobile,
      student?.phone,
      student?.contact,
      student?.profile?.mobile,
      student?.profile?.phone
    ];
    return candidates.some((candidate) => normalizePhone(candidate) === desired);
  }) || students[0];
}

function redactUrl(value) {
  try {
    const parsed = new URL(value);
    ['auth_code', 'key', 'token', 'password', 'email', 'filter'].forEach(param => {
      if (parsed.searchParams.has(param)) parsed.searchParams.set(param, 'REDACTED');
    });
    return parsed.toString();
  } catch (e) {
    return String(value || '')
      .replace(/([?&](?:auth_code|key|token|password|email|filter)=)[^&\s]+/gi, '$1REDACTED')
      .replace(/AIza[0-9A-Za-z_-]+/g, 'AIza***');
  }
}

function fetchJsonWithRetry(url, options = {}, retries = 2, delayMs = 300) {
  return (async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(url, options);
        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
          throw new Error(`Invalid JSON response from ${redactUrl(url)}`);
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from ${redactUrl(url)}`);
        }

        return data;
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }
    throw lastError;
  })();
}

// Admin Flow Helpers
async function adminLogin() {
  if (cachedAdminToken && (Date.now() - cachedAdminTokenAt) < ADMIN_TOKEN_TTL_MS) {
    return cachedAdminToken;
  }

  const EMAIL = process.env.EMAIL;
  const PASSWORD = process.env.PASSWORD;
  if (!EMAIL || !PASSWORD) throw new Error("Missing EMAIL or PASSWORD in .env");

  const loginUrl = process.env.LOGIN_URL || "https://lms-api.testbook.com/api/v2/admin/login";
  console.log(`[AUTH] Attempting login to ${loginUrl}`);
  const data = await fetchJsonWithRetry(loginUrl, {
    method: "POST",
    headers: {
      "Accept": "*/*",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-tb-client": "lms,1.0",
      "User-Agent": "curl/8.7.1"
    },
    body: `email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`
  });
  if (data.success !== true && data.success !== "true") throw new Error("Admin login failed");
  cachedAdminToken = data.data.token;
  cachedAdminTokenAt = Date.now();
  return cachedAdminToken;
}

async function searchUserByPhone(adminToken, phone) {
  try {
    const filter = encodeURIComponent(JSON.stringify({ mobile: phone }));
    const searchUrl = process.env.USER_SEARCH_URL || "https://lms-api.testbook.com/api/v2/admin/students";
    const url = `${searchUrl}?language=All&filter=${filter}`;
    const data = await fetchJsonWithRetry(url, { headers: { "Authorization": `Bearer ${adminToken}`, "x-tb-client": "lms,1.0" } });
    const students = data?.data?.students || [];
    if ((data.success !== true && data.success !== "true") || students.length === 0) {
      console.log(`[API] User not found or invalid response for ${maskValue(phone)}. Using fallback logic.`);
      return null;
    }
    return pickExactStudentMatch(students, phone);
  } catch (e) {
    console.error(`[API ERROR] searchUserByPhone failed: ${e.message}`);
    return null;
  }
}

async function generateStudentToken(adminToken, studentId) {
  const url = `https://lms-api.testbook.com/api/v2/admin/students/${studentId}/gentoken`;
  const data = await fetchJsonWithRetry(url, { headers: { "Authorization": `Bearer ${adminToken}`, "x-tb-client": "lms,1.0" } });
  if (data.success !== true && data.success !== "true") throw new Error("Failed to generate student token");
  return data.data.token;
}

async function getUserProfile(studentToken) {
  const projection = encodeURIComponent(JSON.stringify({
    "_id": 1, "createdOn": 1, "lastSessionTime": 1, "globalPassExpiry": 1, "passProExpiry": 1, "passProMaxExpiry": 1, "goalSubs": 1, "image": 1, "name": 1, "dob": 1, "isPaidUser": 1
  }));
  const url = `https://api.testbook.com/api/v2/students/me?__projection=${projection}&language=English`;
  const data = await fetchJsonWithRetry(url, {
    headers: {
      "Authorization": `Bearer ${studentToken}`,
      "x-tb-client": "web,1.2",
      "Accept": "application/json, text/plain, */*"
    }
  });
  return data.data;
}

async function getLastTests(studentToken) {
  const projection = encodeURIComponent(JSON.stringify({
    "tests": {
      "details": { "id": 1, "title": 1, "description": 1, "isLive": 1, "availFrom": 1, "availTill": 1, "startTime": 1, "endTime": 1, "languages": 1, "questionCount": 1, "totalMark": 1, "duration": 1, "totalAttempts": 1, "isFree": 1, "specificExam": 1, "course": 1 },
      "summary": { "attemptedOn": 1, "attemptedQuesions": 1, "correct": 1, "markScored": 1, "rank": 1, "timeTaken": 1, "totalStudents": 1, "isResumableForNextAttempt": 1, "maxAllowedAttempts": 1, "attemptNo": 1, "isReattemptable": 1 }
    }
  }));
  const url = `https://api.testbook.com/api/v2/students/me/test-submissions?skip=0&limit=10&isQuiz=false&isAddMoreTest=false&type=[Attempted Test] Get Attempted Tests&__projection=${projection}&language=English`;
  const data = await fetchJsonWithRetry(url, {
    headers: {
      "Authorization": `Bearer ${studentToken}`,
      "x-tb-client": "web,1.2"
    }
  });
  return data.data.tests;
}

async function getTestResult(studentToken, testId, attemptNo) {
  const url = `https://api-new.testbook.com/api/v1/tests/${testId}/student-test-result?auth_code=${studentToken}&X-Tb-Client=web,1.2&language=English&attemptNo=${attemptNo}`;
  const data = await fetchJsonWithRetry(url, { headers: { "source": "testbook" } });
  return data.data;
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTestAgainstHints(test, hints) {
  const haystack = normalizeMatchText([
    test?.title,
    test?.course,
    test?.pid,
    test?.specificExam
  ].filter(Boolean).join(' '));

  let score = 0;
  for (const hint of hints) {
    const normalizedHint = normalizeMatchText(hint);
    if (!normalizedHint) continue;

    if (haystack.includes(normalizedHint)) score += 8;

    for (const token of normalizedHint.split(' ')) {
      if (token.length > 2 && haystack.includes(token)) score += 2;
    }
  }

  return score;
}

async function isValidTestbookViewLink(url) {
  if (!url) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const text = await response.text();
    const normalizedBody = normalizeMatchText(text);
    return !/wrong test id|test id not found|page not found|404/.test(normalizedBody);
  } catch (e) {
    return false;
  }
}

function guessSubjectIdFromHints(subjectHints = []) {
  const text = normalizeMatchText(Array.isArray(subjectHints) ? subjectHints.join(' ') : subjectHints);
  if (!text) return '';

  if (/(polity|general awareness|gk|current affairs|history|geography|science|sst)/.test(text)) {
    return '5eea6a1039140f30f369e7e7';
  }

  return '';
}

async function getRecommendedTestsFromLMS(adminToken, targetId, specificExamId, subjectHints = [], subjectId = '', weakTopic = '') {
  try {
    const fields = "_id,title,course,pid,createdOn,relDate,createdBy,stage,specificExam";
    const fetchCandidateTests = async (queryTargetId, querySpecificExamId, useTitle = false) => {
      const params = new URLSearchParams({
        language: 'All',
        fields,
        role: 'admin',
        skip: '0',
        limit: '20',
        stage: 'freeze'
      });
      if (queryTargetId) {
        params.set('targetIds', String(queryTargetId));
      }
      if (querySpecificExamId) {
        params.set('specificExams', String(querySpecificExamId));
      }
      if (subjectId) {
        params.set('subjectIds', String(subjectId));
      }
      if (useTitle && weakTopic) {
        params.set('title', String(weakTopic));
      }
      const url = `https://lms-api.testbook.com/api/v2/admin/tests/get?${params.toString()}`;
      console.log(`[API] Fetching recommendations from LMS: ${url} via POST`);
      const data = await fetchJsonWithRetry(url, { 
        method: 'POST',
        headers: { "Authorization": `Bearer ${adminToken}`, "x-tb-client": "lms,1.0" } 
      });
      if (Array.isArray(data?.data?.tests)) return data.data.tests;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    };

    const candidateSets = await Promise.all([
      fetchCandidateTests(targetId, specificExamId, true),
      fetchCandidateTests(targetId, '', true),
      fetchCandidateTests('', '', true),
      fetchCandidateTests(targetId, specificExamId, false),
      fetchCandidateTests(targetId, '', false),
      subjectId ? fetchCandidateTests('', specificExamId, false) : Promise.resolve([])
    ]);

    const rawTests = [];
    const seenIds = new Set();
    candidateSets.flat().forEach((test) => {
      const testId = String(test?._id || test?.id || test?.pid || '').trim();
      if (!testId || seenIds.has(testId)) return;
      seenIds.add(testId);
      rawTests.push(test);
    });

    if (rawTests.length > 0) {
      const candidates = rawTests.map(t => ({
        id: t._id || t.id || t.pid,
        title: t.title,
        link: t.link || t.url || (t._id ? `https://testbook.com/view/tests/${t._id}` : ''),
        score: scoreTestAgainstHints(t, Array.isArray(subjectHints) ? subjectHints : [])
      })).filter(item => item.link);

      const ranked = [...candidates].sort((a, b) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return String(a.title || '').localeCompare(String(b.title || ''));
      });

      const matched = ranked.filter(item => (item.score || 0) > 0);
      const shortlisted = (matched.length > 0 ? matched : ranked).slice(0, 5);
      const verified = [];

      for (const item of shortlisted) {
        if (await isValidTestbookViewLink(item.link)) {
          verified.push({ id: item.id, title: item.title, link: item.link });
        }
        if (verified.length >= 3) break;
      }

      return verified;
    }
    return [];
  } catch (e) {
    console.error(`[API ERROR] getRecommendedTestsFromLMS failed: ${e.message}`);
    return [];
  }
}

function wantsRecommendedTests(message) {
  const text = normalizeMatchText(message);
  return [
    /recommended tests?/,
    /mock test(s)?/,
    /test links?/,
    /curated mock/,
    /practice set(s)?/,
    /which test/,
    /what should i attempt/,
    /what are my recommended tests/,
    /kya attempt karun/,
    /suggest.*test/
  ].some((pattern) => pattern.test(text));
}

function buildRecommendationReply(userData) {
  const weakLabel = userData?.weak_topics?.[0]?.topic || userData?.weak_topics?.[0]?.name || 'your weak topic';
  const recommendations = Array.isArray(userData?.recommendations) ? userData.recommendations : [];

  if (recommendations.length === 0) {
    return `I could not verify a direct Testbook \`view/tests/{id}\` link for **${weakLabel}** right now. Please refresh the analysis and try again, or ask me for weak-topic drills instead.`;
  }

  const lines = [
    `Based on your weak subject **${weakLabel}**, these Testbook tests were fetched from the LMS API:`,
    ''
  ];

  recommendations.slice(0, 3).forEach((test, index) => {
    lines.push(`${index + 1}. I recommend attempting **[${test.title}](${test.link})**`);
  });

  return lines.join('\n');
}

async function getMeritList(studentToken, testId, attemptNo) {
  const url = `https://api-new.testbook.com/api/v2/tests/${testId}/meritlist?auth_code=${studentToken}&X-Tb-Client=web,1.2&language=English&limit=10&attemptNo=${attemptNo}`;
  const data = await fetchJsonWithRetry(url, { headers: { "source": "testbook" } });
  return data.data;
}

function readLatestAnalysis(userid) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM analysis WHERE userid = ? ORDER BY id DESC LIMIT 1', [userid], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function upsertAnalysisRow(userid, payload) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM analysis WHERE userid = ?', [userid], (deleteErr) => {
      if (deleteErr) return reject(deleteErr);

      db.run(`INSERT INTO analysis (
                userid, testName, score, totalMarks, accuracy, rank, totalStudents, attemptDate, weakTopics, strongTopics,
                attemptedQuestions, correctQuestions, incorrectQuestions, skippedQuestions,
                timeTakenSeconds, totalTimeAllottedSeconds, totalQuestions, percentile, scoreDiff, targetScore, aiInsight
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userid,
          payload.testName,
          payload.score,
          payload.totalMarks,
          payload.accuracy,
          payload.rank,
          payload.totalStudents,
          payload.attemptDate,
          JSON.stringify(payload.weakTopics || []),
          JSON.stringify(payload.strongTopics || []),
          payload.attemptedQuestions ?? null,
          payload.correctQuestions ?? null,
          payload.incorrectQuestions ?? null,
          payload.skippedQuestions ?? null,
          payload.timeTakenSeconds ?? null,
          payload.totalTimeAllottedSeconds ?? null,
          payload.totalQuestions ?? null,
          payload.percentile ?? null,
          payload.scoreDiff ?? null,
          payload.targetScore ?? null,
          payload.aiInsight ?? null
        ],
        function (insertErr) {
          if (insertErr) return reject(insertErr);
          resolve(this.lastID);
        }
      );
    });
  });
}

function persistUserRow(userid, name, phone) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO users (userid, name, phone) VALUES (?, ?, ?)',
      [userid, name, phone],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function persistEventRow(event, rawPayload) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO events (
        eventId, sessionId, userId, eventName, page, path, url, referrer, viewport,
        userAgent, clientTimestamp, serverTimestamp, metadata, rawPayload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId || null,
        event.sessionId || null,
        event.userId || null,
        event.eventName,
        event.page || null,
        event.path || null,
        event.url || null,
        event.referrer || null,
        event.viewport || null,
        event.userAgent || null,
        event.clientTimestamp || null,
        event.serverTimestamp,
        JSON.stringify(event.metadata || {}),
        rawPayload
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getUserRow(userid) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE userid = ?', [userid], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function getAnalysisHistory(userid, limit = 5) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM analysis WHERE userid = ? ORDER BY id DESC LIMIT ?',
      [userid, limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

function buildCacheResponse(userid, userRow, analysisRows) {
  if (!analysisRows || analysisRows.length === 0) {
    return null;
  }

  const latest = analysisRows[0];
  let weakTopics = [];
  try {
    weakTopics = JSON.parse(latest.weakTopics || '[]');
  } catch (e) {
    weakTopics = [];
  }

  return {
    user: { userid, name: userRow?.name || 'Aspirant', phone: userRow?.phone || userid },
    latestAnalysis: {
      testName: latest.testName,
      score: latest.score,
      displayScore: Math.max(0, latest.score || 0),
      totalMarks: latest.totalMarks,
      accuracy: latest.accuracy,
      rank: latest.rank,
      totalStudents: latest.totalStudents,
      attemptDate: latest.attemptDate,
      weakTopics,
      strongTopics: (() => {
        try {
          return JSON.parse(latest.strongTopics || '[]');
        } catch (e) {
          return [];
        }
      })(),
      attemptedQuestions: latest.attemptedQuestions ?? null,
      correctQuestions: latest.correctQuestions ?? null,
      incorrectQuestions: latest.incorrectQuestions ?? null,
      skippedQuestions: latest.skippedQuestions ?? null,
      timeTakenSeconds: latest.timeTakenSeconds ?? null,
      totalTimeAllottedSeconds: latest.totalTimeAllottedSeconds ?? null,
      totalQuestions: latest.totalQuestions ?? null,
      percentile: latest.percentile ?? null,
      scoreDiff: latest.scoreDiff ?? null,
      targetScore: latest.targetScore ?? null,
      aiInsight: latest.aiInsight ?? null
    },
    allTests: analysisRows.map((t) => ({
      id: t.id,
      title: t.testName,
      score: t.score,
      totalMarks: t.totalMarks,
      rank: t.rank,
      totalStudents: t.totalStudents,
      accuracy: t.accuracy,
      attemptedOn: t.attemptDate,
      strongTopics: (() => {
        try {
          return JSON.parse(t.strongTopics || '[]');
        } catch (e) {
          return [];
        }
      })(),
      attemptedQuestions: t.attemptedQuestions ?? null,
      correctQuestions: t.correctQuestions ?? null,
      incorrectQuestions: t.incorrectQuestions ?? null,
      skippedQuestions: t.skippedQuestions ?? null,
      timeTakenSeconds: t.timeTakenSeconds ?? null,
      totalTimeAllottedSeconds: t.totalTimeAllottedSeconds ?? null,
      totalQuestions: t.totalQuestions ?? null,
      percentile: t.percentile ?? null,
      scoreDiff: t.scoreDiff ?? null,
      targetScore: t.targetScore ?? null
    })),
    meritList: []
  };
}

app.post('/api/events', async (req, res) => {
  try {
    const webhookUrl = process.env.WEBHOOK_URL;

    const event = {
      eventId: cleanText(req.body?.eventId, 100),
      sessionId: cleanText(req.body?.sessionId, 100),
      userId: cleanText(req.body?.userId, 80),
      eventName: cleanText(req.body?.eventName, 80),
      page: cleanText(req.body?.page, 80),
      url: cleanText(req.body?.url, 1000),
      path: cleanText(req.body?.path, 300),
      query: cleanText(req.body?.query, 1000),
      title: cleanText(req.body?.title, 300),
      referrer: cleanText(req.body?.referrer, 1000),
      viewport: cleanText(req.body?.viewport, 80),
      userAgent: cleanText(req.body?.userAgent, 500),
      clientTimestamp: cleanText(req.body?.clientTimestamp, 80),
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
      serverTimestamp: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    const body = JSON.stringify(event);
    if (!event.userId || !event.eventName || body.length > 20000) {
      return res.status(400).json({ success: false, error: 'Invalid event payload.' });
    }

    const localEventId = await persistEventRow(event, body);

    res.json({ success: true, data: { stored: true, localEventId, queued: !!webhookUrl } });

    if (!webhookUrl) return;

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`[Tracking] Webhook returned HTTP ${response.status}`);
        }
      })
      .catch((error) => {
        console.error('[Tracking] Event forwarding failed:', error.message);
      });
  } catch (error) {
    console.error('[Tracking] Event forwarding failed:', error.message);
    return res.json({ success: true });
  }
});

function cleanSpeechText(value) {
  return cleanText(String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[`*_>#|~]/g, ' ')
    .replace(/\s+/g, ' '), 4500);
}

function getGoogleTtsVoice(responseLanguage) {
  const language = String(responseLanguage || 'english').toLowerCase();

  if (language === 'hindi') {
    return {
      languageCode: 'hi-IN',
      ssmlGender: 'FEMALE',
      speakingRate: 0.96
    };
  }

  return {
    languageCode: 'en-IN',
    ssmlGender: 'FEMALE',
    speakingRate: language === 'hinglish' ? 0.98 : 1.02
  };
}

app.post('/api/tts', ttsLimiter, async (req, res) => {
  try {
    const auth = await getGoogleTtsRequestAuth();
    if (!auth) {
      const err = new Error('Google TTS credentials are missing. Add GOOGLE_TTS_SERVICE_ACCOUNT_JSON, GOOGLE_TTS_ACCESS_TOKEN, or GOOGLE_TTS_API_KEY in backend/.env and deployment env vars.');
      err.statusCode = 503;
      throw err;
    }

    const text = cleanSpeechText(req.body?.text);
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required for voice output.' });
    }

    const voice = getGoogleTtsVoice(req.body?.responseLanguage);
    const response = await fetch(auth.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.headers
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: voice.languageCode,
          ssmlGender: voice.ssmlGender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: voice.speakingRate,
          pitch: 0
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.audioContent) {
      const message = data.error?.message || 'Google TTS failed to generate audio.';
      const err = new Error(message);
      err.statusCode = response.status || 502;
      throw err;
    }

    return res.json({
      success: true,
      data: {
        audioContent: data.audioContent,
        mimeType: 'audio/mpeg'
      }
    });
  } catch (error) {
    console.error('Google TTS Error:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
});

app.get('/api/analysis/:userid', async (req, res) => {
  let userid;
  try {
    userid = cleanUserId(req.params.userid);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, error: error.message });
  }
  const forceLive = req.query.live === '1' || req.query.fresh === '1';
  console.log(`[API] Analysis requested for UID: ${maskValue(userid)}`);

  let cachedUser = null;
  let cachedHistory = [];

  try {
    [cachedUser, cachedHistory] = await Promise.all([
      getUserRow(userid),
      getAnalysisHistory(userid, 5)
    ]);

    console.log(`[API] Fetching FRESH LMS data for UID: ${maskValue(userid)}...`);

    // Step 1: Admin Login
    let adminToken;
    try {
      adminToken = await adminLogin();
    } catch (e) {
      throw new Error("LIVE_FETCH_FAILED");
    }

    // Step 2: Search user by phone
    const tbUser = await searchUserByPhone(adminToken, userid);
    if (!tbUser) throw new Error("LIVE_FETCH_FAILED");

    const studentId = tbUser._id;
    console.log('[API] Successfully found student record.');

    // Step 3: Generate Student Token
    const studentToken = await generateStudentToken(adminToken, studentId);

    // Step 4: Get User Profile (API 1)
    const profile = await getUserProfile(studentToken);
    const name = profile.name;
    const phone = tbUser.mobile || userid;

    // Step 5: Get All Tests (API 2)
    const allTests = await getLastTests(studentToken);
    if (!allTests || allTests.length === 0) throw new Error("LIVE_FETCH_FAILED");

    const lastTest = allTests[0];
    const testId = lastTest.details.id;
    const attemptNo = lastTest.summary.attemptNo;

    // Step 6: Get Detailed Test Result (API 3)
    const testResult = await getTestResult(studentToken, testId, attemptNo);

    // Step 7: Get Merit List (API 4)
    const meritList = await getMeritList(studentToken, testId, attemptNo);

    // Extract data
    const testName = lastTest.details.title;
    const score = lastTest.summary.markScored;
    const totalMarks = lastTest.details.totalMark;
    const rank = lastTest.summary.rank;
    const totalStudents = lastTest.summary.totalStudents;
    const accuracy = lastTest.summary.attemptedQuesions > 0 ? Math.round((lastTest.summary.correct / lastTest.summary.attemptedQuesions) * 100) : 0;
    const attemptDate = lastTest.summary.attemptedOn || new Date().toISOString();

        // ── WEAK TOPICS from student-test-result API ────────────────────────
        // sections[].accuracy is already 0-100 scale (e.g. 80 = 80%)
        // sections[].title is the subject name (may be null for some CT tests)
        // subjectFilters is the reliable name list: ["General Awareness", ...]
        let weakTopics = [];
        let strongTopics = [];

        if (testResult && testResult.sections && testResult.sections.length > 0) {
          const subjectNames = testResult.subjectFilters || [];
          const sectionTopics = testResult.sections
            .filter(s => (s.totalQuesCount || 0) > 0)
            .map((s, i) => {
              // Use API-provided accuracy (0-100) directly; fall back to manual calc
              let userAccuracy = 0;
              if (typeof s.accuracy === 'number' && !isNaN(s.accuracy)) {
                userAccuracy = Math.round(s.accuracy); // already 0-100
              } else if ((s.totalQuesCount || 0) > 0) {
                userAccuracy = Math.round(((s.correct || 0) / s.totalQuesCount) * 100);
              }

              // Topper benchmark: at least 20% above user, minimum 80%
              const topperAccuracy = Math.min(100, Math.max(userAccuracy + 20, 80));

              // Best title: section title → most relevant tag → subjectFilters[i] → "Topic N"
              const responseTags = (s.responses || [])
                .flatMap(resp => Array.isArray(resp?.answer?.tags) ? resp.answer.tags : [])
                .map(tag => String(tag).trim())
                .filter(Boolean);
              const bestTag = responseTags.length > 0 ? responseTags[0] : null;
              const rawTitle = (s.title && s.title.trim()) || subjectNames[i] || `Topic ${i + 1}`;
              const title = rawTitle.toLowerCase() === 'test' && bestTag ? bestTag : rawTitle;

              return {
                name: title,
                score: userAccuracy,
                target: topperAccuracy,
                correct: s.correct || 0,
                incorrect: s.incorrect || 0,
                skipped: s.skipped || 0,
                marks: typeof s.score === 'number' ? s.score : 0,
                total: typeof s.totalMarks === 'number' ? s.totalMarks : 0
              };
            })
            .sort((a, b) => a.score - b.score);

          weakTopics = sectionTopics.slice(0, 3); // worst accuracy first
          strongTopics = [...sectionTopics].sort((a, b) => b.score - a.score).slice(0, 3); // best accuracy first
        }

        // Fallback: no sections or all filtered out → use subjectFilters + overall accuracy
        if (weakTopics.length === 0 && testResult) {
          const subjects = testResult.subjectFilters || [];
          // overall analysis.accuracy is 0-1 scale
          const overallAccPct = testResult.analysis?.accuracy != null
            ? Math.round(testResult.analysis.accuracy * 100)
            : accuracy; // use summary-level accuracy we already have

          if (subjects.length > 0) {
            weakTopics = subjects.slice(0, 3).map(subject => ({
              name: subject,
              score: overallAccPct,
              target: Math.min(100, Math.max(overallAccPct + 20, 80)),
              correct: testResult.analysis?.correct || 0,
              incorrect: testResult.analysis?.inCorrect || 0,
              skipped: testResult.analysis?.skipped || 0,
              marks: 0,
              total: 0
            }));
          }
        }

        if (strongTopics.length === 0 && testResult) {
          const subjects = testResult.subjectFilters || [];
          const overallAccPct = testResult.analysis?.accuracy != null
            ? Math.round(testResult.analysis.accuracy * 100)
            : accuracy;

          if (subjects.length > 0) {
            strongTopics = subjects.slice(-3).reverse().map(subject => ({
              name: subject,
              score: overallAccPct,
              target: overallAccPct,
              correct: testResult.analysis?.correct || 0,
              incorrect: testResult.analysis?.inCorrect || 0,
              skipped: testResult.analysis?.skipped || 0,
              marks: 0,
              total: 0
            }));
          }
        }

        // ── SCORE ─────────────────────────────────────────────────────────────
        // Clamp score for display (negative marks are valid but we project from 0)
        const displayScore = Math.max(0, score); // raw score for progress bar
        const targetScore = Math.min(totalMarks, Math.round(displayScore + 15));
        const scoreDiff = Math.max(5, targetScore - displayScore);

        // AI insight
        const topicNames = weakTopics.map(t => t.name).filter(Boolean);
        let aiInsight = topicNames.length >= 2
          ? `Fixing ${topicNames[0]} & ${topicNames[1]} can boost your score by +${scoreDiff} marks.`
          : topicNames.length === 1
            ? `Improving ${topicNames[0]} can boost your score by +${scoreDiff} marks.`
            : `Focus on your weak sections to gain +${scoreDiff} marks.`;

        try {
          if (topicNames.length > 0) {
            const insightPrompt = `You are a sharp, data-driven exam coach. Write ONE punchy sentence (max 20 words) as an AI insight for this student.

Data:
- Test: ${testName}
- Score: ${score}/${totalMarks} (${accuracy}% accuracy)
- Rank: ${rank} out of ${totalStudents}
- Weak topics (worst first): ${topicNames.join(', ')}
- Potential mark gain: +${scoreDiff}

Format EXACTLY: "Fixing [Topic1] & [Topic2] can boost your score by +[N] marks." — use the real topic names above. No filler words.`;

            const insightData = await callOpenAI({
              systemPrompt: 'You write concise exam-performance insights.',
              messages: [{ role: 'user', parts: [{ text: insightPrompt }] }],
              maxTokens: 80
            });
            aiInsight = insightData.text.trim().replace(/^"+|"+$/g, '');
          }
        } catch (aiErr) {
          console.error('[API] AI Insight fetch failed:', aiErr.message);
        }

    const attemptedQuestions = Number(testResult?.totalAttemptedQues ?? lastTest.summary.attemptedQuesions ?? 0);
    const correctQuestions = Number(testResult?.analysis?.correct ?? lastTest.summary.correct ?? 0);
    const incorrectQuestions = Number(testResult?.analysis?.inCorrect ?? Math.max(0, attemptedQuestions - correctQuestions));
    const skippedQuestions = Number(testResult?.analysis?.skipped ?? Math.max(0, (testResult?.totalQuestions ?? lastTest.details.questionCount ?? 0) - attemptedQuestions));
    const timeTakenSeconds = Number(testResult?.totalTimeSpent ?? lastTest.summary.timeTaken ?? 0);
    const totalTimeAllottedSeconds = Number(testResult?.totalTimeAllotted ?? (lastTest.details.duration ? lastTest.details.duration * 60 : 0));
    const percentile = testResult?.analysis?.percentile != null
      ? Number(testResult.analysis.percentile)
      : (totalStudents > 0 ? Math.max(0, Math.round((1 - (rank / totalStudents)) * 100)) : null);
    const totalQuestions = Number(testResult?.totalQuestions ?? lastTest.details.questionCount ?? attemptedQuestions);

    const fetchedData = {
      user: { userid, name, phone, image: profile.image },
      latestAnalysis: {
        testName,
        score,            // raw (may be negative for heavy negative marking)
        displayScore,     // clamped >= 0 for progress bar
        totalMarks,
        accuracy,
        rank,
        totalStudents,
        percentile,
        attemptDate,
        attemptedQuestions,
        correctQuestions,
        incorrectQuestions,
        skippedQuestions,
        timeTakenSeconds,
        totalTimeAllottedSeconds,
        totalQuestions,
        weakTopics,
        strongTopics,
        targetScore,
        scoreDiff,
        aiInsight
      },
      allTests: allTests.map(t => ({
        id: t.details.id,
        title: t.details.title,
        score: t.summary.markScored,
        totalMarks: t.details.totalMark,
        rank: t.summary.rank,
        totalStudents: t.summary.totalStudents,
        accuracy: t.summary.attemptedQuesions > 0 ? Math.round((t.summary.correct / t.summary.attemptedQuesions) * 100) : 0,
        attemptedOn: t.summary.attemptedOn,
        attemptedQuestions: t.summary.attemptedQuesions || 0,
        timeTakenSeconds: t.summary.timeTaken || 0
      })),
      meritList: meritList
    };

    await persistUserRow(userid, name, phone);
    await upsertAnalysisRow(userid, {
      testName,
      score,
      totalMarks,
      accuracy,
      rank,
      totalStudents,
      attemptDate,
      weakTopics,
      strongTopics,
      percentile,
      attemptedQuestions,
      correctQuestions,
      incorrectQuestions,
      skippedQuestions,
      timeTakenSeconds,
      totalTimeAllottedSeconds,
      totalQuestions,
      scoreDiff,
      targetScore,
      aiInsight
    });

    return res.json({ success: true, data: fetchedData, source: 'live' });
  } catch (e) {
    console.error(`[API] Live analysis fetch failed for ${maskValue(userid)}: ${e.message}`);

    if (forceLive) {
      return res.status(502).json({ success: false, error: "Live data unavailable. Please try again." });
    }

    const cachedResponse = buildCacheResponse(userid, cachedUser, cachedHistory);
    if (cachedResponse) {
      return res.json({ success: true, data: cachedResponse, stale: true, source: 'cache' });
    }

    if (userid === 'demo_user') {
      const mockData = {
        user: { userid, name: "Ashutosh", phone: userid },
        latestAnalysis: {
          testName: "SSC MTS: Morning Practice - Day 10",
          score: 12.0,
          totalMarks: 50,
          accuracy: 24,
          rank: 2629,
          totalStudents: 3342,
          attemptDate: new Date().toISOString(),
          targetScore: 24,
          weakTopics: [
            { name: "Algebra", score: 20, target: 75, marks: 2, total: 10 },
            { name: "Geometry", score: 35, target: 80, marks: 3, total: 10 },
            { name: "Time & Work", score: 15, target: 70, marks: 1, total: 10 },
            { name: "Reading Comp.", score: 55, target: 85, marks: 5, total: 10 },
            { name: "Syllogism", score: 30, target: 75, marks: 3, total: 10 }
          ]
        },
        allTests: [
          { id: "69941b8786a536084a86b63f", title: "SSC MTS: Morning Practice - Day 10", score: 12, totalMarks: 50, accuracy: 24, rank: 2629, totalStudents: 3342, attemptedOn: new Date().toISOString() },
          { id: "69941b91aae473f90051ab6a", title: "SSC MTS: Evening Practice - Day 10", score: 0, totalMarks: 50, accuracy: 0, rank: 4931, totalStudents: 5590, attemptedOn: new Date(Date.now() - 86400000).toISOString() }
        ]
      };

      return res.json({ success: true, data: mockData, source: 'mock' });
    }

    return res.status(502).json({ success: false, error: "Live data unavailable. Please try again." });
  }
});

// ── DEBUG ENDPOINT: see raw sections from student-test-result API ──────────
app.get('/api/debug/:userid', async (req, res) => {
  if (process.env.ENABLE_DEBUG_API !== 'true') {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }

  let userid;
  try {
    userid = cleanUserId(req.params.userid);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, error: error.message });
  }
  try {
    const adminToken = await adminLogin();
    const tbUser = await searchUserByPhone(adminToken, userid);
    if (!tbUser) return res.json({ error: 'User not found' });

    const studentToken = await generateStudentToken(adminToken, tbUser._id);
    const allTests = await getLastTests(studentToken);
    if (!allTests || allTests.length === 0) {
      return res.json({ error: 'No attempts found for this user' });
    }
    const lastTest = allTests[0];
    const testId = lastTest.details.id;
    const attemptNo = lastTest.summary.attemptNo;
    const testResult = await getTestResult(studentToken, testId, attemptNo);

    // Return exactly what the API gives us for sections
    res.json({
      testId,
      attemptNo,
      testName: lastTest.details.title,
      totalMark: lastTest.details.totalMark,
      containsSections: testResult?.containsSections,
      sections_total_count_in_raw: testResult?.sections_total_count_in_raw,
      subjectFilters: testResult?.subjectFilters,
      sections: (testResult?.sections || []).map(s => ({
        title: s.title,
        accuracy: s.accuracy,
        correct: s.correct,
        incorrect: s.incorrect,
        skipped: s.skipped,
        totalQuesCount: s.totalQuesCount,
        score: s.score,
        totalMarks: s.totalMarks
      })),
      analysis: testResult?.analysis
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Debug request failed.' });
  }
});


async function fetchTestbookUserData(userid) {
  let this_recommendations = [];
  try {
    console.log(`[AI Mentor] Triggering deep LMS fetch for ${maskValue(userid)}...`);

    const adminToken = await adminLogin();
    const tbUser = await searchUserByPhone(adminToken, userid);

    if (tbUser) {
      const studentId = tbUser._id;
      const studentToken = await generateStudentToken(adminToken, studentId);

      const [profile, allTests] = await Promise.all([
        getUserProfile(studentToken),
        getLastTests(studentToken)
      ]);

      const name = profile.name;
      const phone = tbUser.mobile || userid;
      db.run('INSERT OR REPLACE INTO users (userid, name, phone) VALUES (?, ?, ?)', [userid, name, phone]);

      if (allTests && allTests.length > 0) {
        const lastTest = allTests[0];
        const testId = lastTest.details.id;
        const attemptNo = lastTest.summary.attemptNo;
        const testResult = await getTestResult(studentToken, testId, attemptNo);

        const rawScore = lastTest.summary.markScored;
        const totalMarks = lastTest.details.totalMark;
        const attempted = lastTest.summary.attemptedQuesions || 0;
        const correct = lastTest.summary.correct || 0;
        const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

        // ── weakTopics: use s.accuracy (already 0-100), title or subjectFilters fallback ──
        let weakTopics = [];
        if (testResult && testResult.sections && testResult.sections.length > 0) {
          const subjectNames = testResult.subjectFilters || [];
          weakTopics = testResult.sections
            .filter(s => (s.totalQuesCount || 0) > 0)
            .map((s, i) => {
              let userAccuracy = 0;
              if (typeof s.accuracy === 'number' && !isNaN(s.accuracy)) {
                userAccuracy = Math.round(s.accuracy);
              } else if ((s.totalQuesCount || 0) > 0) {
                userAccuracy = Math.round(((s.correct || 0) / s.totalQuesCount) * 100);
              }
              const responseTags = (s.responses || [])
                .flatMap(resp => Array.isArray(resp?.answer?.tags) ? resp.answer.tags : [])
                .map(tag => String(tag).trim())
                .filter(Boolean);
              const bestTag = responseTags.length > 0 ? responseTags[0] : null;
              return {
                topic: (((s.title && s.title.trim()) || subjectNames[i] || `Topic ${i + 1}`).toLowerCase() === 'test' && bestTag)
                  ? bestTag
                  : ((s.title && s.title.trim()) || subjectNames[i] || `Topic ${i + 1}`),
                accuracy: userAccuracy,
                score: typeof s.score === 'number' ? s.score : 0,
                total: typeof s.totalMarks === 'number' ? s.totalMarks : 0,
                correct: s.correct || 0,
                incorrect: s.incorrect || 0,
                skipped: s.skipped || 0
              };
            })
            .sort((a, b) => a.accuracy - b.accuracy);
        }
        // Fallback: sections empty → use subjectFilters + overall accuracy
        if (weakTopics.length === 0 && testResult) {
          const subjects = testResult.subjectFilters || [];
          const overallAccPct = testResult.analysis?.accuracy != null
            ? Math.round(testResult.analysis.accuracy * 100)
            : accuracy;
          if (subjects.length > 0) {
            weakTopics = subjects.map(subject => ({
              topic: subject,
              accuracy: overallAccPct,
              score: 0,
              total: 0
            }));
          }
        }

        const strongTopics = [...weakTopics]
          .filter(topic => topic)
          .sort((a, b) => (b.accuracy ?? b.score ?? 0) - (a.accuracy ?? a.score ?? 0))
          .slice(0, 3);

        const targetId = testResult?.target?.[0]?._id || lastTest.details.course || "5e6189da5f66e94f14a21f58";
        const specificExamId = testResult?.courseid || lastTest.details.course || lastTest.details.specificExam || "";
        const recommendationHints = [
          ...new Set([
            ...weakTopics.map(topic => topic?.topic || topic?.name || '').filter(Boolean),
            ...(testResult.subjectFilters || []),
            lastTest.details.title || ''
          ])
        ].filter(Boolean);
        const subjectIdHint = guessSubjectIdFromHints(recommendationHints);
        const topWeakTopic = weakTopics.length > 0 ? (weakTopics[0].topic || weakTopics[0].name) : '';
        
        let recommendations = await getRecommendedTestsFromLMS(adminToken, targetId, specificExamId, recommendationHints, subjectIdHint, topWeakTopic);
        if (recommendations.length === 0) {
          recommendations = await getRecommendedTestsFromLMS(adminToken, targetId, specificExamId, [], subjectIdHint, topWeakTopic);
        }
        if (recommendations.length === 0 && targetId !== '5e6189da5f66e94f14a21f58') {
          recommendations = await getRecommendedTestsFromLMS(adminToken, '5e6189da5f66e94f14a21f58', specificExamId, recommendationHints, subjectIdHint, topWeakTopic);
        }
        if (recommendations.length === 0) {
          recommendations = await getRecommendedTestsFromLMS(
            adminToken,
            '5e6189da5f66e94f14a21f58',
            '56d6f293995a2d45a8735bb5',
            recommendationHints,
            subjectIdHint || '5eea6a1039140f30f369e7e7',
            topWeakTopic
          );
        }

        const analysisData = {
          testName: lastTest.details.title,
          score: rawScore,
          displayScore: Math.max(0, rawScore),
          totalMarks,
          accuracy,
          rank: lastTest.summary.rank,
          totalStudents: lastTest.summary.totalStudents,
          attemptDate: lastTest.summary.attemptedOn || new Date().toISOString(),
          weakTopics,
          strongTopics,
          recommendations
        };

        db.run(`INSERT INTO analysis (
                  userid, testName, score, totalMarks, accuracy, rank, totalStudents, attemptDate, weakTopics, strongTopics,
                  attemptedQuestions, correctQuestions, incorrectQuestions, skippedQuestions,
                  timeTakenSeconds, totalTimeAllottedSeconds, totalQuestions, percentile, scoreDiff, targetScore, aiInsight
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userid,
            analysisData.testName,
            rawScore,
            totalMarks,
            accuracy,
            analysisData.rank,
            analysisData.totalStudents,
            analysisData.attemptDate,
            JSON.stringify(weakTopics),
            JSON.stringify(strongTopics),
            analysisData.attemptedQuestions ?? null,
            analysisData.correctQuestions ?? null,
            analysisData.incorrectQuestions ?? null,
            analysisData.skippedQuestions ?? null,
            analysisData.timeTakenSeconds ?? null,
            analysisData.totalTimeAllottedSeconds ?? null,
            analysisData.totalQuestions ?? null,
            analysisData.percentile ?? null,
            analysisData.scoreDiff ?? null,
            analysisData.targetScore ?? null,
            analysisData.aiInsight ?? null
          ]
        );
        // We store recommendations in the session/object, not SQLite for now to keep DB simple
        this_recommendations = recommendations;
      }
    }
    if (userid === 'demo_user' || userid === 'demo') {
      const mockData = {
        user: { name: "Ashutosh", userid: "demo_user", phone: "9876543210" },
        latest_analysis: {
          test_name: "SSC MTS: Morning Practice - Day 10",
          score: 12.0,
          display_score: 12.0,
          total_marks: 50,
          accuracy: 24,
          rank: 2629,
          total_students: 3342,
          date: new Date().toISOString()
        },
        weak_topics: [
          { topic: "Algebra", accuracy: 20, score: 2, total: 10 },
          { topic: "Geometry", accuracy: 35, score: 3, total: 10 },
          { topic: "Reading Comp.", accuracy: 55, score: 5, total: 10 }
        ],
        recommendations: [
          { title: "SSC MTS Algebra Drill", link: "https://testbook.com/view/tests/69941b8786a536084a86b63f" },
          { title: "Geometry Basic Mock", link: "https://testbook.com/view/tests/69941b91aae473f90051ab6a" }
        ],
        history: [
          { name: "SSC MTS: Morning Practice - Day 10", score: 12, total: 50, accuracy: 24, date: new Date().toISOString() }
        ]
      };
      return Promise.resolve(mockData);
    }
  } catch (apiErr) {
    console.log(`[AI Mentor Fetch Error] ${apiErr.message}`);
  }

  return new Promise((resolve, reject) => {

    db.get('SELECT * FROM users WHERE userid = ?', [userid], (err, user) => {
      if (err) return reject(err);

      db.all('SELECT * FROM analysis WHERE userid = ? ORDER BY id DESC LIMIT 5', [userid], (err, tests) => {
        if (err) return reject(err);

        const name = user ? user.name : "Aspirant";
        if (!tests || tests.length === 0) {
          return resolve({ user: { name }, latest: null, history: [], recommendations: [] });
        }

        const latest = tests[0];
        let weakTopics = [];
        try { weakTopics = JSON.parse(latest.weakTopics || '[]'); } catch (e) { }

        resolve({
          user: { name, userid },
          latest_analysis: {
            test_name: latest.testName,
            score: latest.score,
            display_score: Math.max(0, latest.score || 0),
            total_marks: latest.totalMarks,
            accuracy: latest.accuracy,
            rank: latest.rank,
            total_students: latest.totalStudents,
            date: latest.attemptDate
          },
          weak_topics: weakTopics,
          recommendations: this_recommendations,
          history: tests.map(t => ({ name: t.testName, score: t.score, total: t.totalMarks, accuracy: t.accuracy, date: t.attemptDate }))
        });

      });
    });
  });
}

app.post('/api/ai-mentor/chat', mentorChatLimiter, async (req, res) => {
  const { userId, message, history, responseLanguage } = req.body || {};

  try {
    const uid = cleanUserId(userId || 'demo_user');
    const messageText = cleanText(message, 2000);
    const languageMap = {
      english: 'English',
      hindi: 'Hindi',
      hinglish: 'Hinglish'
    };
    const selectedLanguage = languageMap[String(responseLanguage || 'english').toLowerCase()] || 'English';
    if (!messageText) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }

    if (!getOpenAiApiKey()) {
      const err = new Error("OpenAI API key is missing. Add OPENAI_API_KEY in backend/.env and restart the backend.");
      err.statusCode = 503;
      err.exposeToClient = true;
      throw err;
    }

    const userData = await fetchTestbookUserData(uid);

    const basePrompt = `You are Meera — a senior exam mentor inside Testbook. Not a bot. Not a system. A real guide who has seen thousands of students crack exams and thousands give up. You know the difference.

You have access to the user's full Testbook performance data in <USER_DATA>. Use it for data questions. For everything else — be human.

## ABSOLUTE RULES

1. DATA BINDING: ONLY use data in <USER_DATA> for scores, ranks, topics. NEVER hallucinate test results.
   If data missing → say: "Mere paas is ka jawab dene ke liye enough data nahi hai."

2. LANGUAGE LOCK: Reply ONLY in the selected response language: {{RESPONSE_LANGUAGE}}.
   English → natural English. Hindi → Hindi in Devanagari. Hinglish → natural Hindi-English mix in Roman script.
   Never switch mid-response unless the selected language is Hinglish.

3. TESTBOOK-ONLY: Recommend ONLY Testbook mocks, videos, notes, books, practice sets.
   NEVER mention YouTube, Unacademy, BYJU's, or any competitor. Non-negotiable.

4. NO GENERIC ADVICE: Never say "focus on weak areas" or "practice more".
   Always: exact topic names + attempt numbers + time targets + specific strategy.

5. HONESTY PROTOCOL: If confidence low or data incomplete → say so. Never fabricate numbers.

6. FORMAT FOLLOWING: If the user asks for a table, checklist, numbered plan — follow that format exactly.
   For tables, output clean GitHub Markdown tables. Do not wrap in code fences. Keep cells short.

7. RICH TEXT FORMAT: Use clean Markdown. Bold labels for headings, short bullets, numbered steps, tables.
   Keep paragraphs short: 1-2 lines each. No wall-of-text.
   Use markdown links for CTAs: [Start Weak Topic Test](https://testbook.com/...).

8. CLIFFHANGER RULE — MANDATORY, NO EXCEPTIONS:
   Every single response MUST end with a cliffhanger hook. This is not optional.
   The cliffhanger must make the student WANT to reply — curious, challenged, or slightly unsettled.
   Examples:
   - "Waise... ek cheez hai jo main tumhare data mein dekh raha/rahi hoon — but pehle tum batao, kya tum sach mein ready ho sunnay ke liye?"
   - "Aur jab result aayega — woh moment ke liye tum taiyaar ho? Sochke batao."
   - "Tumhare jaise pattern mein ek hidden trap hoti hai. Kya tum jaanna chahte ho woh kya hai?"
   - "Ek galti hai jo tum baar baar kar rahe ho without realizing it. Kya main point out karun?"
   - "Tumhara next move kya hoga — sahi choice ya wahi purani wali? Batao."
   The cliffhanger should feel natural, not forced. Match the mood of the conversation.

## USER DATA

<USER_DATA>
{{INJECT_USER_DATA_JSON_HERE}}
</USER_DATA>

## BEHAVIOR PATTERNS — detect from data before responding

- OVERATTEMPTER: high attempt rate + low accuracy → guessing under pressure
- FEAR_AVOIDER: high skip rate + low attempt → avoiding entire topics
- UNDERATTEMPTER: low attempt + high accuracy → leaving marks on table
- TIME_WASTER: avg time > 1.5x peers → spending too long per question
- TOPIC_GAP: selective failure in specific subjects → knowledge hole

## MODE DETECTION — read the intent, pick the right mode

### DATA MODES (use <USER_DATA>, structured response):
- Mock result / "analyze karo" / "score dekhao" → **DATA ANALYST** (sharp, data-first, use the 6-element structure below)
- "Kya attempt karun" / recommended tests → **EXAM COACH** (tactical, exact numbers, real test links)
- "Study plan" / "plan banao" → **PLANNER** (day-wise structure, topic-wise hours)
- "Weak topics" / "strong topics" → **DATA ANALYST** (pull from USER_DATA, be specific)

### SUBJECTIVE MODES (human mentor voice, conversational — NO robotic structure):
- Exam fear / anxiety / dar lag raha / nervous → **ELDER MENTOR** mode
- Memorizing / yaad nahi hota / bhool jaata hoon → **ELDER MENTOR** mode
- Revision strategy / kaise revise karun → **ELDER MENTOR** mode
- Motivation / dil nahi lagta / thak gaya / give up → **ELDER MENTOR** mode
- "Samjhao" / concept explanation → **TEACHER** (step-by-step, shortcut trick)
- General life/exam balance, self-doubt, comparison with others → **ELDER MENTOR** mode

### ELDER MENTOR STYLE RULES (for subjective questions):
- Talk like an elder sibling or a senior who cracked the exam. Not like an AI assistant.
- Use personal, direct language. "Main jaanta/jaanti hoon ye feeling..." or "Suno, main seedha baat karta/karti hoon..."
- Be warm but TOUGH when needed. Don't coddle. Sometimes say: "Yaar, seedha bolunga — ye excuse hai, reason nahi."
- Share a perspective or experience angle: "Jo log clear karte hain na, unka ek common pattern hota hai..."
- Do NOT use the 6-element structured format for subjective topics. Write naturally like a conversation.
- Keep it SHORT and punchy for subjective. 3-5 impactful lines, not an essay.
- End with something that leaves them thinking — then the cliffhanger.
- NEVER sound like a motivational poster. Be real. Be human. Be direct.

## DATA ANALYST — MANDATORY RESPONSE STRUCTURE (for data/analysis questions only)

Every data-mode response must contain all 6 elements (adapt length):

**SNAPSHOT** → 3-5 key numbers from actual user data
**DIAGNOSIS** → Pattern name + specific root cause
**EXAM STRATEGY** → Exact what to do IN exam (attempts, time, skip rules)
**STUDY FIX** → What to do OUTSIDE exam (topics, timeline, method)
**AVOID** → 1-2 specific mistakes for THIS user's pattern
**NEXT ACTION** → One specific Testbook CTA

End data responses with:
**Abhi karo:** [Specific Mock/Topic/Resource on Testbook]

COMPLETION RULE: Always finish the complete answer in one response. All 6 elements + Abhi karo CTA must be present. Then end with the mandatory cliffhanger.

## EXAM CONTEXT — include relevant section when user mentions exam

RRB NTPC CBT-1: 100 Qs | 90 min | -1/3 | GA(40)+Reasoning(30)+Maths(30)
Safe attempt: 70-80. Order: Reasoning → GA → Maths.
Recent shift trend (March 2026): Easy-Moderate overall.

SSC CGL Tier-1: 100 Qs | 60 min | -0.5 | 25 each section
Cutoff: ~130-145. Notification expected: April-June 2026.

SSC GD: 80 Qs | 60 min | -0.25 | GK=40 Qs (50% of paper, cannot skip)

## SPECIAL COMMANDS & CTAs
- If user asks for "PDF Report", "Download analysis", or "Report in PDF":
  Say: "Certainly! I've prepared your detailed performance report in PDF format. You can download it below."
  Include this exact CTA: 🎯 Download Report: [Download PDF Report]

- If user asks for "Recommended Tests", "Mock test links", or "Kya attempt karun":
  You MUST use the real tests from <USER_DATA> (recommendations field).
  Say exactly: "Here your test [Name]" where [Name] is the user's name from data, followed by "test links below", then list the links.
  Format: "Here your test [Name]\ntest links below\n\n1. [Test Title](Link)\n2. [Test Title](Link)"
  Include up to 3 specific recommendations with their links.
  If the recommendations list is empty, do NOT invent or suggest generic Testbook pages.
  Say that you could not verify a direct link and ask the user to refresh the analysis.

## TONE CALIBRATION

For data questions — direct, sharp, data-first. Like a coach who doesn't waste your time.
- NOT: "Aapko is par dhyaan dena chahiye"
- YES: "Yahan tum galti kar rahe ho — isko fix karna padega"

For subjective questions — like a real person who has been there.
- NOT: "Exam fear is natural. Here are 5 tips to overcome it."
- YES: "Suno, ye dar kuch kehna chahta hai. Sabse zyada woh topics kaunse hain jahan tum andar se jaante ho ki preparation weak hai?"

Be tough when needed. A good mentor doesn't always comfort — sometimes they push.
- "Yaar, honestly bolunga — 3 ghante study ka plan banate ho aur 45 minute actual padhai hoti hai. Ye apne aap se jhooth hai."

Never sycophantic. Never filmy. Never generic.

## DIFFICULTY CALIBRATION

Real exam questions are NOT NCERT-simple. Always represent actual difficulty:
- Maths: 2-step calculations, data tables, twisted word problems
- Reasoning: 3+ condition puzzles, mixed coding
- GA: Statement-based elimination, last 6 months current affairs

## EDGE CASES

attempted < 5 questions → "Test properly nahi kiya — real analysis nahi ho sakti"
No full mocks → "Full mock nahi diya — ye critical gap hai"
Data missing → "Data load error. App reload karein."`;

    const systemPrompt = basePrompt
      .replace('{{INJECT_USER_DATA_JSON_HERE}}', JSON.stringify(userData, null, 2))
      .replace('{{RESPONSE_LANGUAGE}}', selectedLanguage);

    const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
    const formattedMessages = safeHistory
      .filter(m => m.text && m.text.trim() !== '')
      .map(m => ({
        role: m.from === 'user' ? 'user' : 'model',
        parts: [{ text: cleanText(m.text, 2000) }]
      }));

    // Ensure last message is from user
    if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].role !== 'user') {
      formattedMessages.push({ role: 'user', parts: [{ text: messageText }] });
    }

    const { text: fullText, usage, stopReason } = await callOpenAI({
      systemPrompt,
      messages: formattedMessages,
      maxTokens: Number(process.env.OPENAI_MAX_TOKENS || 3600)
    });

    const inTokens = usage.input_tokens || 0;
    const outTokens = usage.output_tokens || 0;
    const totalTokens = usage.total_tokens || inTokens + outTokens;

    const logMsg = `[${new Date().toISOString()}] [AI Mentor API] Provider: OpenAI | Model: ${OPENAI_MODEL} | Tokens used - Input: ${inTokens} | Output: ${outTokens} | Total: ${totalTokens} | Stop: ${stopReason || 'unknown'}\n`;
    console.log(logMsg.trim());
    fs.appendFileSync(path.join(logsDir, 'token_usage.log'), logMsg);

    res.json({
      success: true,
      data: {
        text: fullText,
        tokens: {
          input: inTokens,
          output: outTokens,
          total: totalTokens
        },
        stopReason
      }
    });

  } catch (error) {
    console.error("AI Mentor API Error:", error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

const frontendClientPath = path.join(__dirname, '..', 'dist', 'client');
const frontendServerPath = path.join(__dirname, '..', 'dist', 'server', 'server.js');

async function sendWebResponse(res, webResponse) {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => res.setHeader(key, value));

  if (!webResponse.body) {
    return res.end();
  }

  return Readable.fromWeb(webResponse.body).pipe(res);
}

async function handleFrontendRequest(req, res, next) {
  try {
    const serverEntry = await import(pathToFileURL(frontendServerPath).href);
    const handler = serverEntry.default?.fetch || serverEntry.default?.a1?.fetch;
    if (!handler) return next();

    const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const webRequest = new Request(requestUrl, {
      method: req.method,
      headers: req.headers,
    });

    const webResponse = await handler(webRequest, {}, {});
    return sendWebResponse(res, webResponse);
  } catch (error) {
    return next(error);
  }
}

if (fs.existsSync(frontendClientPath) && fs.existsSync(frontendServerPath)) {
  app.use(express.static(frontendClientPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    return handleFrontendRequest(req, res, next);
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Node.js SQL Backend running on http://localhost:${PORT}`));
}

module.exports = app;
