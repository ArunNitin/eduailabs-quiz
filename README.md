# 🎯 EduAILabs Quiz System — Complete Setup Guide

## What You Have

This is a **real-time multiplayer quiz system** for your AI workshops with:

| Component | File | Opens On |
|-----------|------|----------|
| **Participant App** | `participant/index.html` | Mobile phones (via QR code) |
| **Quiz Master Panel** | `quizmaster/index.html` | Your laptop/desktop |
| **Leaderboard Screen** | `leaderboard/index.html` | Projector / TV screen |
| **WebSocket Server** | `backend/server-with-static.js` | Your laptop (Node.js) |
| **Google Sheets Script** | `backend/google-apps-script.js` | Google Apps Script |

---

## 🚀 Quick Start (Step by Step)

### Step 1: Install Node.js
Download from https://nodejs.org (version 18 or higher)

### Step 2: Install dependencies
```bash
cd eduailabs-quiz/backend
npm install
```

### Step 3: Start the server
```bash
node server-with-static.js
```

You will see:
```
╔══════════════════════════════════════════════════════╗
║        🎯 EduAILabs Quiz Server Running!              ║
╠══════════════════════════════════════════════════════╣
║  📱 Participant: http://YOUR_IP:8080/participant/     ║
║  🖥️  Quiz Master: http://localhost:8080/quizmaster/   ║
║  📺 Leaderboard: http://localhost:8080/leaderboard/   ║
╚══════════════════════════════════════════════════════╝
```

### Step 4: Find your laptop's IP address

**Windows:** Open Command Prompt → type `ipconfig` → look for IPv4 Address (e.g., 192.168.1.45)

**Mac/Linux:** Open Terminal → type `ifconfig | grep inet` or `ip addr`

Your IP will look like: `192.168.1.45`

### Step 5: Open all three screens

| Screen | URL | Device |
|--------|-----|--------|
| Quiz Master | `http://localhost:8080/quizmaster/` | Your laptop |
| Leaderboard | `http://localhost:8080/leaderboard/` | Connect projector, open full-screen |
| Participants | `http://192.168.1.45:8080/participant/` | Share via QR code below |

### Step 6: Generate QR Code for participants

Go to: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=http://192.168.1.45:8080/participant/

Replace `192.168.1.45` with your actual IP.
Display this QR code on your projector so participants can scan it!

---

## 🏫 Workshop Day Flow

```
1. Start server on your laptop
2. Open Leaderboard on projector (full screen → F11)
3. Open Quiz Master on your laptop
4. Display QR code → participants scan and register
5. Watch participant count rise on leaderboard screen
6. Set quiz config (questions count, timer seconds)
7. Click ▶ START QUIZ → questions appear on all phones simultaneously
8. Each question: 10 seconds timer (adjustable)
9. Click → NEXT QUESTION to proceed
10. Final leaderboard auto-displays on projector
```

---

## ⚙️ Quiz Configuration (Quiz Master Panel)

| Setting | Range | Default |
|---------|-------|---------|
| Total Questions | 1–50 | 10 |
| Seconds per Question | 5–120 | 10 |
| School Name | Text | Your School |
| Quiz Title | Text | AI Workshop Quiz |

---

## 📊 Google Sheets Integration

### Setup (one-time):

1. Create a new Google Sheet at https://sheets.google.com
2. Go to **Extensions → Apps Script**
3. Delete any existing code
4. Paste the entire content of `backend/google-apps-script.js`
5. Click **Save** (💾)
6. Run the `setup` function once (click ▶ Run → select `setup`)
7. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** and **Authorize** when prompted
9. Copy the Web App URL (looks like `https://script.google.com/macros/s/ABC.../exec`)

### Connect to Quiz System:

**Option A — Quiz Master Panel:**
Paste the URL in the "Google Apps Script URL" field and click "Load Questions from Sheet"

**Option B — Server Environment Variable:**
```bash
GOOGLE_SHEET_WEBHOOK=https://script.google.com/macros/s/YOUR_ID/exec node server-with-static.js
```

### What Gets Saved to Sheets:

**Participants Sheet:**
- Participant ID, Name, Mobile, School, Subject, Date, Time, Session ID, Primary Key

**Questions Sheet:**
- Question ID, Question Text, Options A-D, Correct Option, Explanation, Category

**Results Sheet:**
- Rank, Name, School, Score, Total Time, Avg Time, Correct Answers, Session Date, Timestamp

**Analytics Sheet:**
- Auto-computed: Total sessions, Total participants, Average scores, Fastest participant

---

## 📝 Adding/Editing Questions

### Method 1: Google Sheets (Recommended)
Edit the "Questions" sheet directly:
- Column A: Question ID (1, 2, 3...)
- Column B: Question text
- Column C: Option A
- Column D: Option B
- Column E: Option C
- Column F: Option D
- Column G: Correct option (0=A, 1=B, 2=C, 3=D)
- Column H: Explanation
- Column I: Category

### Method 2: Edit server code
Open `backend/server-with-static.js` and find `getDefaultQuestions()` to edit the built-in questions.

---

## 🎮 Scoring System

| Action | Points |
|--------|--------|
| Correct Answer | 100 points |
| Speed Bonus (fastest) | Up to 50 extra points |
| Wrong Answer | 0 points |
| No Answer (timeout) | 0 points |

**Tiebreaker:** If two participants have the same score, the one with the **faster total response time** wins.

---

## 🔧 Troubleshooting

**Participants can't connect:**
- Ensure all devices are on the **same WiFi network**
- Check your firewall allows port 8080
- Use your laptop's local IP (192.168.x.x), not localhost

**Questions not loading from Sheets:**
- Verify the Apps Script deployment is set to "Anyone" access
- Check the URL is the Web App URL (not the editor URL)
- Run the `setup()` function in Apps Script first

**Timer not syncing:**
- Refresh all browser tabs
- Check WebSocket connection indicator (green = connected)

**Server won't start:**
- Run `npm install` in the backend folder
- Ensure Node.js 18+ is installed: `node --version`

---

## 📁 File Structure

```
eduailabs-quiz/
├── backend/
│   ├── server-with-static.js    ← MAIN server (run this)
│   ├── server.js                ← WebSocket only (alternative)
│   ├── google-apps-script.js   ← Paste into Google Apps Script
│   └── package.json
├── participant/
│   └── index.html              ← Mobile participant app
├── quizmaster/
│   └── index.html              ← Quiz Master control panel
├── leaderboard/
│   └── index.html              ← Projector leaderboard screen
└── README.md                   ← This file
```

---

## 🎯 Pro Tips for Workshops

1. **Test everything 15 mins before** the workshop starts
2. **Use a mobile hotspot** if school WiFi is unreliable
3. **Full-screen the leaderboard** (F11) for maximum impact
4. **Keep 15–30 seconds** per question for beginners
5. **Use 10 seconds** for experienced participants
6. **Run 2 practice questions** at the start so people learn the interface
7. **Announce the winner** on the leaderboard screen for maximum excitement

---

*Built for EduAILabs.com AI Workshops*
*System: WebSocket + Node.js + Google Sheets*
