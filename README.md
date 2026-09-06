
# Player Portal — setup guide

A web app players log into with **Name + Player ID (PID) + Date of Birth**,
matched against your Google Sheet. Works on any phone browser, and can be
"installed" to the home screen like an app (no Play Store needed).

Right now it runs on **mock test data** so you can try it immediately.
Below is how to connect it to your real Google Sheet when ready.

---

## 1. Try it right now (test mode)

Open `index.html` (or the GitHub Pages link once deployed) and log in with:

| Name | PID | DOB |
|---|---|---|
| Ravi Kumar | TEST-001 | 2003-04-12 |
| Priya Menon | TEST-002 | 2001-11-30 |
| Test Empty | TEST-003 | 2000-01-01 |

`Test Empty` shows what a real player will see before you've added their
match/session dates — an empty state, not an error.

---

## 2. Host it on GitHub Pages

1. Create a new GitHub repo (public or private — Pages works for both on
   paid plans, public repos get it free).
2. Upload these files to the repo root: `index.html`, `manifest.json`,
   `sw.js`, `icon-192.png`, `icon-512.png`.
3. Repo → **Settings → Pages** → Source: `Deploy from a branch` → Branch:
   `main` / root.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`
   in a minute or two.
5. On a phone: open that link in the browser → menu → **"Add to Home
   Screen"**. It'll behave like an installed app (own icon, no browser bar).

That's the whole hosting step — no build tools, no signing, nothing else needed.

---

## 3. Connect it to your real Google Sheet

Your Apps Script already writes a PID when someone submits the Form. Add
the API alongside it:

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Add a new script file, paste in the contents of **`AppsScript-Code.gs`**
   (included here).
3. At the top of that file, edit the `CFG` block so `PLAYERS_SHEET_NAME`
   matches your actual tab name (the one your Form responses land in),
   and confirm/rename columns so there's a `Name`, `PID`, and `DOB` column
   (case doesn't matter, but those exact words should appear as headers).
4. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the URL ending in `/exec`.
6. In `index.html`, find the `CONFIG` block near the top of the `<script>`
   and set:
   ```js
   const CONFIG = {
     USE_REMOTE_API: true,
     API_URL: "https://script.google.com/macros/s/XXXXXXX/exec",
   };
   ```
7. Push that change to GitHub — Pages updates automatically within a minute.

From here on, editing the Google Sheet is the only thing you need to do —
no code changes required to add players, matches, or sessions.

---

## 4. Adding match/session dates later

Add a second tab named **`Schedule`** (or whatever you set
`SCHEDULE_SHEET_NAME` to) with these columns:

| PID | Type | Date | Opponent | Title | Time | Venue |
|---|---|---|---|---|---|---|
| ABC123 | Match | 2026-09-14 | Aditya Rao | | 4:30 PM | Court 2 |
| ABC123 | Session | 2026-09-08 | | Group A Practice | 5:00 PM | Training Court |

- `Type` is exactly `Match` or `Session`.
- For a Match, fill `Opponent`; for a Session, fill `Title`.
- Rows with a past `Date` are automatically hidden — only upcoming ones show.
- Until this tab exists, every real player just sees "no matches/sessions
  scheduled yet" — never an error.

---

## 5. Admin mode

On the login screen, tap **"Admin sign-in"** at the bottom. Default test
password is:

```
admin123
```

**Change this before sharing the app with anyone** — open `index.html`,
find the `CONFIG` block near the top of the `<script>`, and edit:

```js
ADMIN_PASSWORD: "admin123",
```

Once in admin mode you'll see every registered player (including test
users, marked `TEST`). Tap a player to open their schedule editor and
upload a `.xlsx` or `.csv` file with these exact column headers, in this
order, in row 1:

| Date | Time | Time to arrive | Location | How many players on field |
|---|---|---|---|---|
| 2026-09-14 | 4:30 PM | 4:00 PM | Court 2, Main Hall | 6 |

- **One file per player** — there's no roster/opponent column on purpose,
  so nobody can see who else is playing that day from the file alone.
- Uploading shows a **preview** first — nothing saves until you tap
  "Confirm & replace schedule." Confirming **replaces that player's
  entire match list** (it doesn't merge with what was there before).
- Dates that don't parse cleanly are flagged with ⚠ in the preview so you
  can fix the source file and re-upload, rather than silently guessing.
- **Right now this is stored in your browser only** (`localStorage`),
  which is why it's good for testing but won't show up on a different
  device or browser. See below for making it sync everywhere.

### Making admin uploads sync across devices later

Right now `getMatchesFor` / `saveMatchesFor` in `index.html` read and
write to the browser's local storage. To make admin uploads sync across
every device (so you can log into admin mode on your phone, tablet, or
laptop and see the same data), those two functions need to instead call
your Apps Script backend — the same way `authenticate()` already does.
This means adding two more actions to `AppsScript-Code.gs`
(`getMatches` / `saveMatches`, writing to a "Matches" sheet tab keyed by
PID) and pointing the app at them once `USE_REMOTE_API` is turned on.
This isn't wired up yet since you said you're still testing — flag it
to me whenever you're ready to move to it and I'll build that piece in.

---

## 6. About the APK

A true installable `.apk` needs Android build tooling (Android Studio,
a signing key, and typically a Play Store listing) that isn't available
in this environment. The PWA approach above gets you 95% of the same
outcome — home-screen icon, full-screen app feel, offline-tolerant — with
zero build pipeline. If you later want a real APK, the fastest path is
wrapping this exact web app with a tool like **PWABuilder**
(https://www.pwabuilder.com) — paste in your GitHub Pages URL and it
packages an APK for you automatically, since the manifest and service
worker here are already set up for it.
