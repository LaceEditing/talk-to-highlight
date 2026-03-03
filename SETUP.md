# Read-Along Highlighter — Setup Guide

A web app that connects to a Google Doc, listens via your microphone as you read aloud,
and progressively highlights every word as you say it. Works in Google Chrome on any device.

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A Google account
- A modern browser (Chrome, Edge, Firefox, etc.)

---

## Step 1 — Create Google Cloud credentials (one-time, ~10 minutes)

### 1a. Create a project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top → **New Project**
3. Name it anything (e.g. "Read-Along App") → **Create**

### 1b. Enable APIs

1. In the left menu: **APIs & Services → Library**
2. Search for **Google Docs API** → click it → **Enable**
3. Go back to Library, search **Google Drive API** → **Enable**

### 1c. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User Type: **External** → **Create**
3. Fill in:
   - App name: `Read-Along Highlighter`
   - User support email: your Gmail address
   - Developer contact: your Gmail address
4. Click **Save and Continue** through all screens
5. On the **Test users** screen, click **Add users** and add the Gmail account of the person who will use the app
6. Finish the wizard

### 1d. Create an OAuth Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: anything
4. **Authorized JavaScript origins** — add:
   - `http://localhost:5173` (for local development)
   - Your Vercel URL once deployed (e.g. `https://read-along-abc123.vercel.app`)
5. Click **Create**
6. Copy the **Client ID** (looks like `123456789-abc....apps.googleusercontent.com`)

### 1e. Create an API Key (for the "Browse Drive" button)

1. **Credentials → Create Credentials → API Key**
2. Copy the key
3. (Optional but recommended) Click **Restrict Key**:
   - Application restrictions: **HTTP referrers**
   - Add `localhost:5173/*` and your Vercel URL
   - API restrictions: **Google Picker API**
4. **Save**

---

## Step 2 — Configure the app

1. In the project folder, copy the example env file:
   ```
   cp .env.example .env.local
   ```
2. Open `.env.local` and paste your credentials:
   ```
   VITE_GOOGLE_CLIENT_ID=your_client_id_here
   VITE_GOOGLE_API_KEY=your_api_key_here
   ```

---

## Step 3 — Run locally (for testing)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in **Google Chrome**.

---

## Step 4 — Deploy to Vercel (free hosting, HTTPS)

1. Install Vercel CLI: `npm install -g vercel`
2. From the project folder: `vercel`
3. Follow the prompts (accept defaults)
4. Once deployed, copy the URL (e.g. `https://read-along-abc123.vercel.app`)
5. Go back to Google Cloud Console → your OAuth Client ID → add the Vercel URL to **Authorized JavaScript origins** → Save
6. Redeploy with production env vars:
   ```
   vercel env add VITE_GOOGLE_CLIENT_ID production
   vercel env add VITE_GOOGLE_API_KEY production
   vercel --prod
   ```
7. Share the URL with the user — they just open it in Chrome and bookmark it

---

## How to use the app

1. Open the app URL in **Google Chrome**
2. Click **Sign in with Google** and sign in with your Google account
3. Choose your document:
   - **Paste a link**: Open your Google Doc, copy the URL from the address bar, paste it in
   - **Browse my Drive**: Opens a Google Drive file browser — click your document
4. Click **Start Reading Aloud**
5. Begin reading the document out loud — words highlight in yellow as you say them
6. If you pause and lose your place, look for the brightest gold word — that's the last word you said
7. Click **Pause** to stop; click **Start Reading Aloud** again to resume
8. Click **↺ Start Over** to reset all highlights

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Loading speech model…" takes a long time | The first load downloads a ~40 MB speech model — this is cached by the browser afterwards |
| "Microphone access denied" | Click the 🔒 icon in your browser's address bar → allow microphone for this site |
| "Could not load document" | Make sure the document is set to "Anyone with the link can view" OR that you're signed in with the account that owns the doc |
| Words highlight too slowly | Speak clearly and at a moderate pace; avoid long pauses mid-sentence |
| Words stop highlighting mid-document | Click Pause, then Start Reading Aloud again to restart the microphone |
| Highlighting jumps ahead | Click **↺ Start Over** to reset, then resume reading from the beginning |
| "Drive browser not ready" | Wait 3–5 seconds after the page loads, then try again, or use the Paste a link tab instead |

---

## Technical notes

- Speech recognition uses [Vosk](https://alphacephei.com/vosk/) — a fully offline speech model that runs in the browser via WebAssembly
- **No audio leaves the device** — all recognition happens locally, nothing is sent to any server
- The ~40 MB model is downloaded once and cached by the browser
- The document text is fetched once when you open it and stored in memory; no copy is saved locally
- The app never modifies your Google Doc
- Works in any modern browser (Chrome, Edge, Firefox) — not limited to Chrome
