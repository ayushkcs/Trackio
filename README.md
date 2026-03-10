# 📧 Trackio

Trackio is a lightweight, open-source email tracking system built with a **Chrome Extension** and a **Next.js dashboard**. 

It injects an invisible tracking pixel into your Gmail compose window and notifies you the moment someone opens your email — with open counts, timestamps, and detailed analytics.

![Home Page](assets/home_page.png)


## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Directory Structure](#-directory-structure)
- [How It Works](#-how-it-works)
- [Download & Setup the Extension](#-download--setup-the-extension)
- [Clone, Setup & Run Locally](#-clone-setup--run-locally)
- [Contributing](#-contributing)


## ✨ Features

![features](assets/features.png)

| Feature                        | Description                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Real-time open tracking**    | Know the instant someone reads your email.                                                                |
| **Open count & timestamps**    | See how many times an email was opened and when.                                                          |
| **Chrome Extension for Gmail** | Seamlessly integrates into Gmail's compose window with zero friction.                                     |
| **Tracking indicator**         | A small orange "Trackio" badge appears in your compose toolbar so you know tracking is active.            |
| **Sent folder checkmarks**     | ✓ gray (sent, not opened) and ✓✓ orange (opened) icons appear next to tracked emails in your Sent folder. |
| **Desktop notifications**      | Get a Chrome notification when someone opens your email.                                                  |
| **Self-open prevention**       | Smart multi-layer system ensures your own views don't count as opens.                                     |
| **Beautiful dashboard**        | Clean, modern UI to view all tracked emails, stats, open rates, and history.                              |
| **Google SSO**                 | Sign in with your Google account in one click.                                                            |
| **Persistent sessions**        | Stay logged in until you explicitly sign out.                                                             |
| **Vercel Analytics**           | Built-in page view and visitor tracking.                                                                  |
| **Fully open source**          | Inspect, fork, and contribute.                                                                            |

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend / Dashboard** | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| **Backend / API** | Next.js API Routes (serverless on Vercel) |
| **Database** | PostgreSQL (Neon) via Prisma ORM 7 |
| **Authentication** | NextAuth.js v5 (Google SSO) with Prisma Adapter |
| **Chrome Extension** | Manifest V3, Vanilla JS |
| **Deployment** | Vercel (web), GitHub (extension ZIP) |
| **Analytics** | Vercel Analytics |

## 📁 Directory Structure

The project is a monorepo with two main directories:

```
Trackio/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json       # Extension config, permissions, content scripts
│   ├── background.js       # Service worker — API calls, polling, notifications,
│   │                       #   declarativeNetRequest self-open blocking
│   ├── content.js          # Injected into Gmail — compose detection, send
│   │                       #   interception, pixel injection, checkmarks
│   ├── popup.html/js/css   # Extension popup — toggle, stats, connection status
│   ├── styles.css          # Injected CSS for Gmail (indicator, checkmarks)
│   └── icons/              # Extension icons (16, 32, 48, 128px)
│
├── web/                    # Next.js Web Application
│   ├── app/
│   │   ├── page.tsx        # Landing page
│   │   ├── login/page.tsx  # Google SSO login page
│   │   ├── dashboard/      # Dashboard (server + client components)
│   │   ├── layout.tsx      # Root layout (providers, analytics, toaster)
│   │   ├── globals.css     # Global styles (system fonts, Tailwind)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   # NextAuth API
│   │       ├── emails/route.ts               # Register & fetch tracked emails
│   │       ├── emails/check/route.ts         # Bulk status check (polling)
│   │       ├── track/[id]/route.ts           # Tracking pixel endpoint
│   │       └── track/[id]/self-view/route.ts # Self-view compensation
│   ├── lib/
│   │   ├── auth.ts         # NextAuth config (Google provider, Prisma adapter)
│   │   ├── prisma.ts       # Prisma client singleton (Neon adapter)
│   │   ├── cors.ts         # CORS helpers for extension ↔ API
│   │   └── utils.ts        # Utility functions
│   ├── components/         # UI components (shadcn/ui + custom)
│   ├── prisma/
│   │   └── schema.prisma   # Database schema (User, Email, OpenEvent, etc.)
│   ├── middleware.ts        # Route protection
│   └── package.json        # Dependencies & scripts
│
├── trackio_extension.zip   # Pre-packaged extension for download
└── README.md
```

### `extension/` — Chrome Extension

- The extension runs entirely in the browser. It uses a **content script** (`content.js`) injected into Gmail to detect compose windows, intercept the Send button, inject a 1×1 tracking pixel, and display open status checkmarks in the Sent folder. 
  
- The **background service worker** (`background.js`) handles all API communication, polls for open events, sends desktop notifications, and uses `declarativeNetRequest` to block compose-time self-opens.

### `web/` — Next.js Dashboard & API

- The web app serves two purposes: (1) a public-facing **landing page** and **dashboard** for viewing tracked email analytics, and (2) a set of **API routes** that the extension communicates with — registering emails, serving tracking pixels, checking open status, and handling self-view compensation. 

- Authentication is handled via Google SSO (NextAuth.js) and data is stored in a PostgreSQL database (Neon) using Prisma ORM.

## 🔄 How It Works

![Architecture](assets/architecture.png)


**High-level flow:**

1. **User composes an email in Gmail** → The content script detects the compose window and intercepts the Send button.

2. **Send is clicked** → The extension registers the email with the Trackio API (`POST /api/emails`), which returns a unique tracking ID and pixel URL.

3. **Pixel is injected** → A 1×1 transparent GIF `<img>` tag is appended to the email body. A `declarativeNetRequest` rule blocks Gmail from loading it during compose (preventing self-opens).

4. **Email is sent** → Gmail sends the email with the pixel embedded in the HTML body.

5. **Recipient opens the email** → Their email client (or its image proxy) fetches the pixel from `GET /api/track/{id}`. The server records an `OpenEvent`, increments the open count, and marks the email as "opened".

6. **Extension polls for updates** → Every 30 seconds, the background service worker checks for new opens via `POST /api/emails/check` and shows a Chrome desktop notification if there are new opens.

7. **Dashboard reflects data** → The web dashboard fetches tracked emails from `GET /api/emails` and displays stats, open counts, and last-opened timestamps.

8. **Self-open prevention** → If the user views their own sent email, the extension reports a self-view to `POST /api/track/{id}/self-view` with a `senderToken`, and the server marks that open event as a self-open (excluded from counts).

## 📥 Download & Setup the Extension

> ⚠️ I don't currently have a Google Developer license to publish extensions on the Chrome Web Store. So you'll need to **manually load the extension** as an unpacked package. It takes less than a minute!

### Step 1: Download the ZIP

Download the extension ZIP file from GitHub:

👉 [**Download trackio_extension.zip**](https://github.com/ayushkcs/Trackio/blob/main/trackio_extension.zip)

Click the **"Download raw file"** button (↓) on the GitHub page.

![download](assets/step1.png)

### Step 2: Extract the ZIP

- **Windows**: Right-click the ZIP → "Extract All" → Choose a folder (e.g., `Desktop/trackio_extension`).

- **Mac**: Double-click the ZIP file. It'll create a folder automatically.

- **Linux**: `unzip trackio_extension.zip -d trackio_extension`

### Step 3: Load into Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Enable **"Developer mode"** (toggle in the top-right corner).
3. Click **"Load unpacked"**.
4. Select the **extracted folder** (the one containing `manifest.json`, NOT the ZIP file).
5. Trackio should now appear in your extensions list with the orange icon.

![Load into Chrome](assets/step2.png)

### Step 4: Pin the Extension

Click the **puzzle piece** icon (🧩) in Chrome's toolbar → Find "Trackio" → Click the **pin** icon so it's always visible.

![Pin](/assets/step3.png)

### Step 5: Start Tracking

1. Open [Gmail](https://mail.google.com).
2. Compose a new email — you should see the orange **"Trackio"** badge in the compose toolbar.
3. Send the email as usual.
4. Open the extension popup to see your tracked stats, or visit the [Trackio Dashboard](https://trackio.ayushk.blog/dashboard).

![Extension](assets/extension.png)

## 💻 Clone, Setup & Run Locally

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **Google Cloud Console** project with OAuth 2.0 credentials
- **PostgreSQL** database (or use [Neon](https://neon.tech) for free)

### 1. Clone the Repository

```bash
git clone https://github.com/ayushkcs/Trackio.git
cd Trackio
```

### 2. Setup the Web App

```bash
cd web
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `web/` directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# NextAuth
AUTH_SECRET="your-random-secret-string"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# App URL (no trailing slash)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**To get Google OAuth credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or use an existing one).
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
4. Set Application type to **Web application**.
5. Add `http://localhost:3000` to **Authorized JavaScript origins**.
6. Add `http://localhost:3000/api/auth/callback/google` to **Authorized redirect URIs**.
7. Copy the Client ID and Client Secret into your `.env`.

### 4. Setup the Database

```bash
npx prisma db push
```

This creates all the necessary tables in your database.

### 5. Start the Dev Server

```bash
npm run dev
```

The app will be running at [http://localhost:3000](http://localhost:3000).

### 6. Load the Extension Locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **"Load unpacked"** → Select the `extension/` folder from the cloned repo.
4. The extension will connect to `http://localhost:3000` by default for local development.

### 7. Test It

1. Sign in with Google at [http://localhost:3000](http://localhost:3000).
2. Open [Gmail](https://mail.google.com) and send a tracked email.
3. Check the dashboard at [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

## 🤝 Contributing

Contributions are welcome! Whether it's a bug fix, feature request, or documentation improvement — feel free to open an issue or submit a pull request.

1. **Fork** this repository.
2. **Create a branch**: `git checkout -b feature/my-awesome-feature`
3. **Commit your changes**: `git commit -m "feat: add my awesome feature"`
4. **Push**: `git push origin feature/my-awesome-feature`
5. **Open a Pull Request** and describe your changes.

Please keep your PRs focused and follow the existing code style.

---

<p align="center">
  Built by <strong><a href="https://ayushkb.blog">Ayush</a></strong> ✦ <a href="https://www.linkedin.com/in/ayushkcs/">LinkedIn</a> ✦ <a href="https://x.com/ayushkcs/">X</a> ✦ <a href="mailto:kayush2k02@gmail.com">Email</a>
</p>
