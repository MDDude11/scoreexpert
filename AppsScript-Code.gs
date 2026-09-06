/**
 * PLAYER PORTAL — Apps Script Web App API
 * ----------------------------------------
 * Paste this into the Apps Script project bound to your Google Sheet
 * (the one your Form responses + generated PIDs land in), alongside
 * your existing PID-generation script. It does NOT replace that script.
 *
 * SETUP
 * 1. Open your Sheet -> Extensions -> Apps Script.
 * 2. Create a new file (or add to an existing one) and paste this in.
 * 3. Edit the CONFIG block below to match your actual sheet/column names.
 * 4. Deploy -> New deployment -> type: "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the deployment URL (ends in /exec) into CONFIG.API_URL in
 *    index.html, and set USE_REMOTE_API = true.
 *
 * SHEET STRUCTURE EXPECTED
 * ------------------------
 * Tab 1 ("Players" by default): one row per player, with columns:
 *    Name | PID | DOB  (DOB as a real Date, or text like "2003-04-12")
 *
 * Tab 2 ("Schedule" by default, OPTIONAL — add this later): one row
 * per upcoming match/session, with columns:
 *    PID | Type | Date | Opponent | Title | Time | Venue
 *    - Type is "Match" or "Session".
 *    - For a Match: fill Opponent, Time, Venue (Title can be blank).
 *    - For a Session: fill Title, Time, Venue (Opponent can be blank).
 * If this tab doesn't exist yet, the API just returns empty lists —
 * exactly the "show empty for now" behavior you wanted for real PIDs.
 */

const CFG = {
  PLAYERS_SHEET_NAME: "Players",     // <-- change to your actual tab name
  SCHEDULE_SHEET_NAME: "Schedule",   // <-- change to your actual tab name (optional, can not exist yet)
  PLAYERS_HEADER_ROW: 1,             // row number containing column headers
  SCHEDULE_HEADER_ROW: 1,
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "login") {
      return jsonResponse(handleLogin(e.parameter));
    }
    return jsonResponse({ ok: false, reason: "Unknown action." });
  } catch (err) {
    return jsonResponse({ ok: false, reason: "Server error: " + err.message });
  }
}

function handleLogin(params) {
  const name = (params.name || "").trim();
  const pid = (params.pid || "").trim();
  const dob = (params.dob || "").trim(); // expected format: YYYY-MM-DD

  if (!name || !pid || !dob) {
    return { ok: false, reason: "Missing name, PID, or date of birth." };
  }

  const players = readPlayers_();
  const match = players.find(p =>
    normalize_(p.name) === normalize_(name) &&
    normalize_(p.pid) === normalize_(pid) &&
    p.dobIso === dob
  );

  if (!match) {
    return { ok: false, reason: "No player found matching that name, player ID, and date of birth." };
  }

  const schedule = readSchedule_(match.pid);

  return {
    ok: true,
    player: {
      name: match.name,
      pid: match.pid,
      matches: schedule.matches,
      sessions: schedule.sessions,
    },
  };
}

/** Reads the Players tab into a normalized array. */
function readPlayers_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.PLAYERS_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet tab "${CFG.PLAYERS_SHEET_NAME}" not found.`);

  const values = sheet.getDataRange().getValues();
  const headerIdx = CFG.PLAYERS_HEADER_ROW - 1;
  const headers = values[headerIdx].map(h => String(h).trim().toLowerCase());

  const colName = headers.indexOf("name");
  const colPid = headers.indexOf("pid");
  const colDob = headers.indexOf("dob");

  if (colName === -1 || colPid === -1 || colDob === -1) {
    throw new Error('Players sheet must have "Name", "PID", and "DOB" columns.');
  }

  const rows = values.slice(headerIdx + 1);
  return rows
    .filter(r => r[colPid] !== "" && r[colPid] != null)
    .map(r => ({
      name: String(r[colName] || "").trim(),
      pid: String(r[colPid] || "").trim(),
      dobIso: toIsoDate_(r[colDob]),
    }));
}

/** Reads the Schedule tab (if present) for a specific PID. Returns empty lists if the tab doesn't exist. */
function readSchedule_(pid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SCHEDULE_SHEET_NAME);
  if (!sheet) return { matches: [], sessions: [] };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { matches: [], sessions: [] };

  const headerIdx = CFG.SCHEDULE_HEADER_ROW - 1;
  const headers = values[headerIdx].map(h => String(h).trim().toLowerCase());

  const colPid = headers.indexOf("pid");
  const colType = headers.indexOf("type");
  const colDate = headers.indexOf("date");
  const colOpponent = headers.indexOf("opponent");
  const colTitle = headers.indexOf("title");
  const colTime = headers.indexOf("time");
  const colVenue = headers.indexOf("venue");

  const rows = values.slice(headerIdx + 1).filter(r => String(r[colPid] || "").trim() === pid);

  const matches = [];
  const sessions = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  rows.forEach(r => {
    const dateIso = toIsoDate_(r[colDate]);
    if (!dateIso) return;
    const rowDate = new Date(dateIso);
    if (rowDate < today) return; // only upcoming

    const type = String(r[colType] || "").trim().toLowerCase();
    const time = String(r[colTime] || "").trim();
    const venue = String(r[colVenue] || "").trim();

    if (type === "match") {
      matches.push({
        date: dateIso,
        opponent: String(r[colOpponent] || "").trim(),
        time,
        venue,
      });
    } else if (type === "session") {
      sessions.push({
        date: dateIso,
        title: String(r[colTitle] || "").trim() || "Training Session",
        time,
        venue,
      });
    }
  });

  return { matches, sessions };
}

function toIsoDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    // Convert using the spreadsheet's timezone to avoid off-by-one-day issues.
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const str = String(value).trim();
  // Accept already-ISO text values too.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return null;
}

function normalize_(s) {
  return String(s || "").trim().toLowerCase();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
