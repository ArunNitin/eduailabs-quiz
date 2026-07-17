/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           EduAILabs Quiz - Google Apps Script Backend           ║
 * ║                                                                  ║
 * ║  SETUP INSTRUCTIONS:                                             ║
 * ║  1. Open Google Sheets → Extensions → Apps Script               ║
 * ║  2. Paste this entire script                                     ║
 * ║  3. Click Deploy → New Deployment → Web App                     ║
 * ║  4. Set "Execute as" = Me, "Who has access" = Anyone            ║
 * ║  5. Copy the Web App URL                                         ║
 * ║  6. Set GOOGLE_SHEET_WEBHOOK env var in server.js to that URL   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * SHEETS STRUCTURE (auto-created):
 * - Sheet1 "Participants": All registered participants
 * - Sheet2 "Questions": Quiz questions with options & answers
 * - Sheet3 "Results": Final quiz results per session
 * - Sheet4 "Analytics": Auto-computed analytics
 */

// ─── SHEET NAMES ─────────────────────────────────────────────────────────────
const SHEET_PARTICIPANTS = 'Participants';
const SHEET_QUESTIONS = 'Questions';
const SHEET_RESULTS = 'Results';
const SHEET_ANALYTICS = 'Analytics';

// ─── MAIN WEB APP ENTRY POINT ─────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;

    switch (body.action) {
      case 'ADD_PARTICIPANT':
        result = addParticipant(body.data);
        break;
      case 'SAVE_RESULTS':
        result = saveResults(body.data);
        break;
      case 'GET_QUESTIONS':
        result = getQuestions();
        break;
      case 'SAVE_QUESTIONS':
        result = saveQuestions(body.data);
        break;
      default:
        result = { error: 'Unknown action: ' + body.action };
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const action = e.parameter.action || 'GET_QUESTIONS';
  
  if (action === 'GET_QUESTIONS') {
    const result = getQuestions();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'GET_ANALYTICS') {
    const result = getAnalytics();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: 'EduAILabs Quiz API Running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── INITIALIZE SHEETS ────────────────────────────────────────────────────────
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Participants Sheet
  let pSheet = ss.getSheetByName(SHEET_PARTICIPANTS);
  if (!pSheet) {
    pSheet = ss.insertSheet(SHEET_PARTICIPANTS);
    pSheet.getRange(1, 1, 1, 10).setValues([[
      'Participant ID', 'Name', 'Mobile', 'School/Organization', 
      'Subject', 'Join Date', 'Join Time', 'Session', 'Primary Key', 'Status'
    ]]);
    pSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    pSheet.setFrozenRows(1);
  }
  
  // Questions Sheet
  let qSheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!qSheet) {
    qSheet = ss.insertSheet(SHEET_QUESTIONS);
    qSheet.getRange(1, 1, 1, 9).setValues([[
      'Question ID', 'Question Text', 'Option A', 'Option B', 'Option C', 
      'Option D', 'Correct Option (0-3)', 'Explanation', 'Category'
    ]]);
    qSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#16213e').setFontColor('#ffffff');
    qSheet.setFrozenRows(1);
    
    // Add sample questions
    const sampleQ = [
      [1, 'What does AI stand for?', 'Automated Intelligence', 'Artificial Intelligence', 'Advanced Integration', 'Analog Interface', 1, 'AI stands for Artificial Intelligence', 'AI Basics'],
      [2, 'Which is a type of Machine Learning?', 'Supervised Learning', 'Directed Learning', 'Commanded Learning', 'Manual Learning', 0, 'Supervised Learning uses labeled training data', 'Machine Learning'],
      [3, 'What is a Neural Network inspired by?', 'Computer circuits', 'The human brain', 'Internet protocols', 'Database systems', 1, 'Neural networks mimic the human brain structure', 'Deep Learning'],
      [4, 'What does GPT stand for?', 'General Processing Technology', 'Generative Pre-trained Transformer', 'Graphic Processing Tool', 'Global Pattern Training', 1, 'GPT is the architecture behind large language models', 'LLMs'],
      [5, 'Which company created ChatGPT?', 'Google', 'Meta', 'OpenAI', 'Microsoft', 2, 'ChatGPT was created by OpenAI', 'AI Companies'],
    ];
    qSheet.getRange(2, 1, sampleQ.length, 9).setValues(sampleQ);
  }
  
  // Results Sheet
  let rSheet = ss.getSheetByName(SHEET_RESULTS);
  if (!rSheet) {
    rSheet = ss.insertSheet(SHEET_RESULTS);
    rSheet.getRange(1, 1, 1, 12).setValues([[
      'Rank', 'Name', 'School/Org', 'Score', 'Total Time (ms)', 
      'Avg Time/Q (ms)', 'Correct Answers', 'Total Questions',
      'Session Date', 'Timestamp', 'Session ID', 'Primary Key'
    ]]);
    rSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#0f3460').setFontColor('#ffffff');
    rSheet.setFrozenRows(1);
  }
  
  // Analytics Sheet
  let aSheet = ss.getSheetByName(SHEET_ANALYTICS);
  if (!aSheet) {
    aSheet = ss.insertSheet(SHEET_ANALYTICS);
    aSheet.getRange(1, 1, 1, 5).setValues([[
      'Metric', 'Value', 'Last Updated', 'Notes', 'Formula'
    ]]);
    aSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#533483').setFontColor('#ffffff');
  }

  return { message: 'Sheets initialized successfully' };
}

// ─── ADD PARTICIPANT ───────────────────────────────────────────────────────────
function addParticipant(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PARTICIPANTS);
  if (!sheet) { initializeSheets(); sheet = ss.getSheetByName(SHEET_PARTICIPANTS); }
  
  const now = new Date();
  const sessionId = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMdd');
  const primaryKey = `${sessionId}_${data.participantId}`;
  
  sheet.appendRow([
    data.participantId,
    data.name,
    data.mobile,
    data.school,
    data.subject,
    Utilities.formatDate(now, 'Asia/Kolkata', 'dd/MM/yyyy'),
    Utilities.formatDate(now, 'Asia/Kolkata', 'HH:mm:ss'),
    sessionId,
    primaryKey,
    'Active'
  ]);
  
  return { participantId: data.participantId, primaryKey };
}

// ─── SAVE RESULTS ─────────────────────────────────────────────────────────────
function saveResults(resultsArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_RESULTS);
  if (!sheet) { initializeSheets(); sheet = ss.getSheetByName(SHEET_RESULTS); }
  
  const now = new Date();
  const sessionId = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMddHHmm');
  
  const rows = resultsArray.map(r => [
    r.rank,
    r.name,
    r.school,
    r.score,
    r.totalTimeTaken,
    r.avgTimeTaken,
    r.correctAnswers,
    r.totalQuestions,
    r.date,
    r.timestamp,
    sessionId,
    `${sessionId}_${r.rank}`
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 12).setValues(rows);
  }
  
  // Update analytics
  updateAnalytics(resultsArray, sessionId);
  
  return { saved: rows.length, sessionId };
}

// ─── GET QUESTIONS ────────────────────────────────────────────────────────────
function getQuestions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sheet) { initializeSheets(); sheet = ss.getSheetByName(SHEET_QUESTIONS); }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { questions: [] };
  
  const questions = data.slice(1).filter(row => row[1]).map((row, i) => ({
    id: row[0] || (i + 1),
    question: row[1],
    options: [row[2], row[3], row[4], row[5]],
    correct: parseInt(row[6]) || 0,
    explanation: row[7] || '',
    category: row[8] || 'General',
  }));
  
  return { questions, count: questions.length };
}

// ─── SAVE QUESTIONS ───────────────────────────────────────────────────────────
function saveQuestions(questionsArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!sheet) { initializeSheets(); sheet = ss.getSheetByName(SHEET_QUESTIONS); }
  
  // Clear existing (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).clearContent();
  }
  
  const rows = questionsArray.map((q, i) => [
    q.id || (i + 1),
    q.question,
    q.options[0],
    q.options[1],
    q.options[2],
    q.options[3],
    q.correct,
    q.explanation || '',
    q.category || 'General'
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 9).setValues(rows);
  }
  
  return { saved: rows.length };
}

// ─── UPDATE ANALYTICS ─────────────────────────────────────────────────────────
function updateAnalytics(results, sessionId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ANALYTICS);
  if (!sheet) return;
  
  // Clear previous session analytics
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  }
  
  const now = new Date();
  const winner = results[0] || {};
  const avgScore = results.reduce((s, r) => s + r.score, 0) / (results.length || 1);
  const avgTime = results.reduce((s, r) => s + r.avgTimeTaken, 0) / (results.length || 1);
  
  const analytics = [
    ['Session ID', sessionId, now, 'Latest quiz session', ''],
    ['Total Participants', results.length, now, 'Who joined this session', '=COUNTA(Participants!A:A)-1'],
    ['Winner', winner.name || 'N/A', now, 'Top scorer', ''],
    ['Winner Score', winner.score || 0, now, 'Highest score achieved', ''],
    ['Average Score', Math.round(avgScore), now, 'Mean score across all participants', ''],
    ['Average Response Time', Math.round(avgTime) + 'ms', now, 'Mean time to answer per question', ''],
    ['Fastest Participant', results.sort((a,b) => a.avgTimeTaken - b.avgTimeTaken)[0]?.name || 'N/A', now, 'Quickest average response', ''],
    ['Total Sessions', '', now, 'All time sessions', '=COUNTUNIQUE(Results!K:K)-1'],
    ['All-time Participants', '', now, 'Unique participants ever', '=COUNTA(Participants!A:A)-1'],
  ];
  
  sheet.getRange(2, 1, analytics.length, 5).setValues(analytics);
}

// ─── AUTO-SETUP TRIGGER ───────────────────────────────────────────────────────
function setup() {
  initializeSheets();
  SpreadsheetApp.getUi().alert('✅ EduAILabs Quiz sheets initialized successfully!\n\nSheets created:\n• Participants\n• Questions\n• Results\n• Analytics\n\nNext: Deploy this script as a Web App and copy the URL to your server.js config.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎯 EduAILabs Quiz')
    .addItem('Initialize Sheets', 'setup')
    .addItem('Get Analytics', 'showAnalytics')
    .addToUi();
}

function showAnalytics() {
  const result = getAnalytics();
  SpreadsheetApp.getUi().alert(JSON.stringify(result, null, 2));
}

function getAnalytics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pSheet = ss.getSheetByName(SHEET_PARTICIPANTS);
  const rSheet = ss.getSheetByName(SHEET_RESULTS);
  
  return {
    totalParticipants: pSheet ? pSheet.getLastRow() - 1 : 0,
    totalSessions: rSheet ? rSheet.getLastRow() - 1 : 0,
  };
}
