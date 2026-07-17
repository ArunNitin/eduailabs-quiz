/**
 * EduAILabs Quiz - Static File Server
 * Serves participant, quizmaster, and leaderboard HTML files
 * Integrated with the WebSocket server
 * 
 * Replace server.js with this file for all-in-one serving
 */

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const CONFIG = {
  PORT: process.env.PORT || 8080,
  GOOGLE_SHEET_WEBHOOK: process.env.GOOGLE_SHEET_WEBHOOK || '',
  QUIZ_TITLE: process.env.QUIZ_TITLE || 'EduAILabs AI Workshop Quiz',
  SCHOOL_NAME: process.env.SCHOOL_NAME || 'Your School / Organization',
};

// ─── QUIZ STATE ───────────────────────────────────────────────────────────────
let state = {
  phase: 'LOBBY',
  participants: {},
  questions: getDefaultQuestions(),
  currentQuestionIndex: -1,
  currentQuestion: null,
  questionTimer: null,
  questionStartTime: null,
  answers: {},
  leaderboard: [],
  quizConfig: {
    totalQuestions: 10,
    secondsPerQuestion: 10,
    schoolName: CONFIG.SCHOOL_NAME,
    quizTitle: CONFIG.QUIZ_TITLE,
  }
};

function getDefaultQuestions() {
  return [
    { id:1, question:"What does AI stand for?", options:["Automated Intelligence","Artificial Intelligence","Advanced Integration","Analog Interface"], correct:1, explanation:"AI stands for Artificial Intelligence.", category:"AI Basics" },
    { id:2, question:"Which is a type of Machine Learning?", options:["Supervised Learning","Directed Learning","Commanded Learning","Manual Learning"], correct:0, explanation:"Supervised Learning uses labeled data to train models.", category:"ML" },
    { id:3, question:"What is a Neural Network inspired by?", options:["Computer circuits","The human brain","Internet protocols","Database systems"], correct:1, explanation:"Neural networks mimic the structure of the human brain.", category:"Deep Learning" },
    { id:4, question:"What does GPT stand for?", options:["General Processing Technology","Generative Pre-trained Transformer","Graphic Processing Tool","Global Pattern Training"], correct:1, explanation:"GPT = Generative Pre-trained Transformer.", category:"LLMs" },
    { id:5, question:"Which company created ChatGPT?", options:["Google","Meta","OpenAI","Microsoft"], correct:2, explanation:"ChatGPT was created by OpenAI.", category:"AI Companies" },
    { id:6, question:"What is 'prompt engineering'?", options:["Building AI hardware","Designing AI chips","Crafting effective inputs for AI models","Programming robots"], correct:2, explanation:"Prompt engineering is designing inputs to get better AI outputs.", category:"Practical AI" },
    { id:7, question:"What is 'deep learning' a subset of?", options:["Database Management","Machine Learning","Cloud Computing","Cybersecurity"], correct:1, explanation:"Deep Learning is a subset of Machine Learning using deep neural networks.", category:"Deep Learning" },
    { id:8, question:"Which is NOT an AI application?", options:["Image recognition","Speech translation","PDF printing","Recommendation systems"], correct:2, explanation:"PDF printing is standard software, not AI.", category:"AI Applications" },
    { id:9, question:"What does 'training data' mean in AI?", options:["Exercise videos for robots","Data used to teach an AI model","Backup database files","System logs"], correct:1, explanation:"Training data is the dataset used to teach/train an AI model.", category:"AI Basics" },
    { id:10, question:"What is the main goal of AI?", options:["Replace all humans","Simulate human intelligence to solve problems","Store data faster","Connect to the internet"], correct:1, explanation:"AI simulates human-like intelligence to solve complex problems.", category:"AI Basics" },
  ];
}

// ─── HTTP + WS SERVER ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let filePath = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Route handling
  if (filePath === '/' || filePath === '') filePath = '/participant/index.html';
  if (filePath === '/quizmaster' || filePath === '/quizmaster/') filePath = '/quizmaster/index.html';
  if (filePath === '/leaderboard' || filePath === '/leaderboard/') filePath = '/leaderboard/index.html';
  if (filePath === '/participant' || filePath === '/participant/') filePath = '/participant/index.html';

  // Health check
  if (filePath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      status: 'ok', 
      participants: Object.keys(state.participants).length,
      phase: state.phase,
      questions: state.questions.length,
    }));
  }

  // Serve static files
  const fullPath = path.join(__dirname, '..', filePath);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 - File not found: ${filePath}\n\nAvailable routes:\n/ or /participant/ - Participant app\n/quizmaster/ - Quiz Master panel\n/leaderboard/ - Leaderboard screen\n/health - Server health`);
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
const clients = new Map();

function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function calculateLeaderboard() {
  const lb = Object.entries(state.participants).map(([id, p]) => {
    const totalTime = p.answers.reduce((s, a) => s + (a ? a.timeTaken : state.quizConfig.secondsPerQuestion * 1000), 0);
    return {
      id, name: p.name, school: p.school, score: p.score,
      totalTimeTaken: totalTime,
      avgTimeTaken: p.answers.length ? totalTime / p.answers.length : 9999999,
      answers: p.answers,
    };
  });
  lb.sort((a, b) => b.score !== a.score ? b.score - a.score : a.totalTimeTaken - b.totalTimeTaken);
  lb.forEach((p, i) => { p.rank = i + 1; });
  state.leaderboard = lb;
  return lb;
}

function revealAnswer() {
  if (state.questionTimer) { clearInterval(state.questionTimer); state.questionTimer = null; }
  state.phase = 'ANSWER_REVEAL';
  
  const q = state.currentQuestion;
  const qIdx = state.currentQuestionIndex;
  const questionAnswers = state.answers[qIdx] || {};
  
  Object.entries(state.participants).forEach(([id, p]) => {
    const answer = questionAnswers[id];
    let points = 0;
    if (answer) {
      const isCorrect = answer.option === q.correct;
      if (isCorrect) {
        const speedBonus = Math.max(0, Math.floor(50 * (1 - answer.timeTaken / (state.quizConfig.secondsPerQuestion * 1000))));
        points = 100 + speedBonus;
      }
      p.score += points;
      p.answers[qIdx] = { option: answer.option, correct: isCorrect, timeTaken: answer.timeTaken, points };
    } else {
      p.answers[qIdx] = { option: -1, correct: false, timeTaken: state.quizConfig.secondsPerQuestion * 1000, points: 0 };
    }
  });

  const leaderboard = calculateLeaderboard();
  const answerStats = [0,0,0,0];
  const timings = {};
  
  Object.entries(questionAnswers).forEach(([pid, ans]) => {
    if (ans.option >= 0) answerStats[ans.option]++;
    timings[pid] = { name: state.participants[pid]?.name || 'Unknown', timeTaken: ans.timeTaken, option: ans.option, correct: ans.option === q.correct };
  });

  broadcast({ type: 'ANSWER_REVEAL', correctOption: q.correct, explanation: q.explanation, answerStats, timings, leaderboard, questionIndex: qIdx });
  saveResultsToSheets();
}

function startQuestionTimer() {
  let remaining = state.quizConfig.secondsPerQuestion;
  const tickInterval = setInterval(() => {
    remaining--;
    broadcast({ type: 'TIMER_TICK', remaining, total: state.quizConfig.secondsPerQuestion });
    if (remaining <= 0) { clearInterval(tickInterval); revealAnswer(); }
  }, 1000);
  state.questionTimer = tickInterval;
}

async function saveParticipantToSheets(p) {
  if (!CONFIG.GOOGLE_SHEET_WEBHOOK) return;
  try {
    const body = JSON.stringify({ action: 'ADD_PARTICIPANT', data: { ...p, timestamp: new Date().toISOString(), date: new Date().toLocaleDateString('en-IN') } });
    const u = new URL(CONFIG.GOOGLE_SHEET_WEBHOOK);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts);
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch(e) {}
}

async function saveResultsToSheets() {
  if (!CONFIG.GOOGLE_SHEET_WEBHOOK || !state.leaderboard.length) return;
  try {
    const results = state.leaderboard.map(p => ({ rank: p.rank, name: p.name, school: p.school, score: p.score, totalTimeTaken: p.totalTimeTaken, avgTimeTaken: Math.round(p.avgTimeTaken), correctAnswers: p.answers.filter(a => a?.correct).length, totalQuestions: state.currentQuestionIndex + 1, date: new Date().toLocaleDateString('en-IN'), timestamp: new Date().toISOString() }));
    const body = JSON.stringify({ action: 'SAVE_RESULTS', data: results });
    const u = new URL(CONFIG.GOOGLE_SHEET_WEBHOOK);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts);
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch(e) {}
}

// ─── WEBSOCKET HANDLER ────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  clients.set(ws, { role: 'unknown', participantId: null });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const meta = clients.get(ws);

    switch(msg.type) {
      case 'JOIN': {
        const id = `P_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
        const p = { id, name: msg.name?.trim()||'Anonymous', mobile: msg.mobile?.trim()||'', school: msg.school?.trim()||'', subject: msg.subject?.trim()||'', score: 0, answers: [], joinedAt: Date.now() };
        state.participants[id] = p;
        clients.set(ws, { role: 'participant', participantId: id });
        saveParticipantToSheets(p);
        sendTo(ws, { type: 'JOINED', participantId: id, phase: state.phase, quizConfig: state.quizConfig });
        broadcast({ type: 'PARTICIPANT_JOINED', participant: { id, name: p.name, school: p.school }, count: Object.keys(state.participants).length, participants: Object.values(state.participants).map(p => ({ id: p.id, name: p.name, school: p.school })) });
        console.log(`[JOIN] ${p.name} (${p.school})`);
        break;
      }
      case 'QUIZMASTER_CONNECT': {
        clients.set(ws, { role: 'quizmaster' });
        sendTo(ws, { type: 'QUIZMASTER_CONNECTED', state: { phase: state.phase, participants: Object.values(state.participants).map(p=>({id:p.id,name:p.name,school:p.school})), participantCount: Object.keys(state.participants).length, currentQuestionIndex: state.currentQuestionIndex, totalQuestions: state.quizConfig.totalQuestions, questions: state.questions.slice(0, state.quizConfig.totalQuestions), quizConfig: state.quizConfig } });
        break;
      }
      case 'LEADERBOARD_CONNECT': {
        clients.set(ws, { role: 'leaderboard' });
        sendTo(ws, { type: 'LEADERBOARD_CONNECTED', phase: state.phase, participants: Object.values(state.participants).map(p=>({id:p.id,name:p.name,school:p.school})), leaderboard: state.leaderboard, quizConfig: state.quizConfig });
        break;
      }
      case 'UPDATE_CONFIG': {
        if (meta.role !== 'quizmaster') break;
        state.quizConfig = { ...state.quizConfig, ...msg.config };
        broadcast({ type: 'CONFIG_UPDATED', quizConfig: state.quizConfig });
        break;
      }
      case 'LOAD_QUESTIONS': {
        if (meta.role !== 'quizmaster') break;
        if (msg.questions?.length) { state.questions = msg.questions; sendTo(ws, { type: 'QUESTIONS_LOADED', count: state.questions.length }); }
        break;
      }
      case 'START_QUIZ': {
        if (meta.role !== 'quizmaster') break;
        state.phase = 'QUESTION'; state.currentQuestionIndex = 0; state.answers = {};
        Object.values(state.participants).forEach(p => { p.score = 0; p.answers = []; });
        const q = state.questions[0]; state.currentQuestion = q; state.questionStartTime = Date.now(); state.answers[0] = {};
        broadcast({ type: 'QUESTION_START', questionIndex: 0, total: state.quizConfig.totalQuestions, question: { ...q, correct: undefined }, duration: state.quizConfig.secondsPerQuestion });
        startQuestionTimer();
        break;
      }
      case 'NEXT_QUESTION': {
        if (meta.role !== 'quizmaster') break;
        const next = state.currentQuestionIndex + 1;
        if (next >= state.quizConfig.totalQuestions || next >= state.questions.length) {
          state.phase = 'FINISHED';
          const lb = calculateLeaderboard();
          broadcast({ type: 'QUIZ_FINISHED', leaderboard: lb });
          saveResultsToSheets();
          break;
        }
        state.currentQuestionIndex = next; state.phase = 'QUESTION';
        const q = state.questions[next]; state.currentQuestion = q; state.questionStartTime = Date.now(); state.answers[next] = {};
        broadcast({ type: 'QUESTION_START', questionIndex: next, total: state.quizConfig.totalQuestions, question: { ...q, correct: undefined }, duration: state.quizConfig.secondsPerQuestion });
        startQuestionTimer();
        break;
      }
      case 'FORCE_REVEAL': { if (meta.role === 'quizmaster' && state.phase === 'QUESTION') revealAnswer(); break; }
      case 'RESET_QUIZ': {
        if (meta.role !== 'quizmaster') break;
        if (state.questionTimer) clearInterval(state.questionTimer);
        state = { ...state, phase: 'LOBBY', participants: {}, currentQuestionIndex: -1, currentQuestion: null, answers: {}, leaderboard: [], questionTimer: null };
        broadcast({ type: 'QUIZ_RESET' });
        break;
      }
      case 'SUBMIT_ANSWER': {
        if (meta.role !== 'participant' || state.phase !== 'QUESTION') break;
        const pid = meta.participantId; const qIdx = state.currentQuestionIndex;
        if (!state.answers[qIdx]) state.answers[qIdx] = {};
        if (state.answers[qIdx][pid]) break;
        const timeTaken = Date.now() - state.questionStartTime;
        state.answers[qIdx][pid] = { option: msg.option, timestamp: Date.now(), timeTaken };
        sendTo(ws, { type: 'ANSWER_RECEIVED', option: msg.option, timeTaken });
        broadcast({ type: 'ANSWER_COUNT_UPDATE', answered: Object.keys(state.answers[qIdx]).length, total: Object.keys(state.participants).length, questionIndex: qIdx });
        break;
      }
    }
  });

  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║        🎯 EduAILabs Quiz Server Running!              ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  Port: ${CONFIG.PORT}                                         ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  📱 Participant (mobile QR):                          ║`);
  console.log(`║     http://YOUR_IP:${CONFIG.PORT}/participant/             ║`);
  console.log(`║                                                        ║`);
  console.log(`║  🖥️  Quiz Master (laptop):                             ║`);
  console.log(`║     http://localhost:${CONFIG.PORT}/quizmaster/            ║`);
  console.log(`║                                                        ║`);
  console.log(`║  📺 Leaderboard (projector):                          ║`);
  console.log(`║     http://localhost:${CONFIG.PORT}/leaderboard/           ║`);
  console.log(`║                                                        ║`);
  console.log(`║  ❤️  Health:  http://localhost:${CONFIG.PORT}/health         ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
  console.log(`  💡 Set GOOGLE_SHEET_WEBHOOK=<url> for Sheets integration\n`);
});
