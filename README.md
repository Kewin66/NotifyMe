# NotifyMe

A Chrome browser extension that monitors any webpage and sends you an email alert the moment your keywords appear.

No server required. Works with any public URL.

---

## Features

- **Any URL** — monitor apartment listings, job boards, product pages, event registrations, anything
- **Keyword filters** — alert on one or more keywords per watch
- **Email alerts** — sent via EmailJS (free, no backend needed)
- **Scheduled checks** — configurable interval per watch (default 30 minutes)
- **Smart deduplication** — only alerts when content changes, no repeat spam
- **Pause / Resume** — temporarily disable a watch without deleting it
- **Multiple watches** — track as many URLs as you want

---

## Demo

Open `demo/index.html` in your browser for a step-by-step visual walkthrough of setup and configuration.

---

## Installation

### 1. Load the extension in Chrome

1. Clone or download this repo
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** → select the `NotifyMe` folder
5. Pin the extension from the puzzle-piece icon in the toolbar

### 2. Set up EmailJS (free)

NotifyMe sends email through [EmailJS](https://www.emailjs.com) — a free service that lets you send email directly from JavaScript without a backend.

| Step | What to do |
|------|-----------|
| 1 | Sign up at [emailjs.com](https://www.emailjs.com) |
| 2 | **Email Services** → Add Service → choose Gmail (or any provider) → copy the **Service ID** |
| 3 | **Email Templates** → Create Template → set up subject/body using the variables below → copy the **Template ID** |
| 4 | **Account** → API Keys → copy your **Public Key** |

#### Required template variables

Your EmailJS template must include these variables:

```
To:      {{to_email}}
Subject: {{subject}}
Body:    {{message}}
```

You can also use `{{watch_url}}`, `{{matched_keywords}}`, and `{{page_snippet}}` in your template body for richer emails.

### 3. Enter config in the extension

1. Click the NotifyMe icon → **⚙ Settings**
2. Paste your **Service ID**, **Template ID**, and **Public Key**
3. Click **Save Email Config**

---

## Adding a Watch

1. Open Settings (⚙ from the popup)
2. Fill in the **Add New Watch** form:

| Field | Example |
|-------|---------|
| URL to Monitor | `https://example.com/available-units` |
| Keywords | `soho, den, available` |
| Notify Email | `you@gmail.com` |
| Check Interval | `30` (minutes) |

3. Click **Add Watch**

The extension will check the page on your interval and email you as soon as any keyword is found — and only again if the content changes.

---

## Project Structure

```
NotifyMe/
├── manifest.json     # Chrome extension manifest (MV3)
├── background.js     # Service worker: scheduling, fetching, email
├── popup.html/css/js # Extension popup (status view)
├── options.html/css/js  # Settings page (manage watches + EmailJS config)
└── demo/
    └── index.html    # Interactive setup walkthrough
```

---

## How It Works

```
chrome.alarms  →  background.js fetches URL
                          ↓
                  strips HTML → keyword search
                          ↓
               match found + content changed?
                          ↓
                  EmailJS REST API → your inbox
```

State (last content fingerprint, last check time, status) is stored in `chrome.storage.sync` and synced across your Chrome devices.

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save watches and EmailJS config |
| `alarms` | Schedule periodic checks |
| `host_permissions: <all_urls>` | Fetch any URL the user wants to monitor |

---

## Dependencies

None. Pure HTML/CSS/JavaScript — no npm, no build step, no backend.
Email is sent via the [EmailJS REST API](https://www.emailjs.com/docs/rest-api/send/).
