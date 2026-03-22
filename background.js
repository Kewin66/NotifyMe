const ALARM_PREFIX = "notifyme_watch_";

// ── Bootstrap ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleAllAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduleAllAlarms();
});

// Re-schedule when storage changes (user added/edited/deleted a watch)
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "sync" && changes.watches) {
    await scheduleAllAlarms();
  }
});

// ── Alarms ─────────────────────────────────────────────────────────────────

async function scheduleAllAlarms() {
  const { watches = [] } = await chrome.storage.sync.get("watches");

  // Clear all existing NotifyMe alarms
  const existing = await chrome.alarms.getAll();
  for (const alarm of existing) {
    if (alarm.name.startsWith(ALARM_PREFIX)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  // Create one alarm per active watch
  for (const watch of watches) {
    if (!watch.active) continue;
    chrome.alarms.create(`${ALARM_PREFIX}${watch.id}`, {
      delayInMinutes: 0.1,               // first check ~6 seconds after schedule
      periodInMinutes: watch.interval,
    });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const watchId = alarm.name.slice(ALARM_PREFIX.length);
  const { watches = [] } = await chrome.storage.sync.get("watches");
  const watch = watches.find((w) => w.id === watchId);
  if (watch && watch.active) {
    await checkWatch(watch);
  }
});

// ── Core check logic ───────────────────────────────────────────────────────

async function checkWatch(watch) {
  let status = "no-match";
  let errorMsg = null;

  try {
    const res = await fetch(watch.url, { cache: "no-store" });
    const html = await res.text();

    // Strip tags for cleaner keyword matching
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase();

    const matchedFilters = watch.filters.filter((f) =>
      text.includes(f.toLowerCase().trim())
    );

    if (matchedFilters.length > 0) {
      status = "match";

      // Only alert if content fingerprint changed (avoid duplicate emails)
      const fingerprint = simpleHash(matchedFilters.join("|") + text.slice(0, 500));
      if (fingerprint !== watch.lastMatchFingerprint) {
        await sendEmail(watch, matchedFilters, html);
        await updateWatch(watch.id, {
          lastMatchFingerprint: fingerprint,
          lastMatchTime: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    status = "error";
    errorMsg = e.message;
  }

  await updateWatch(watch.id, {
    lastCheck: new Date().toISOString(),
    lastStatus: status,
    ...(errorMsg ? { lastError: errorMsg } : {}),
  });
}

// ── Email via EmailJS REST API ─────────────────────────────────────────────

async function sendEmail(watch, matchedFilters, html) {
  const { emailjs } = await chrome.storage.sync.get("emailjs");
  if (!emailjs?.serviceId || !emailjs?.templateId || !emailjs?.publicKey) {
    console.warn("NotifyMe: EmailJS not configured.");
    return;
  }

  const pageText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const checkedAt = new Date().toLocaleString();

  const matchTable = buildMatchTable(watch, matchedFilters, pageText, checkedAt);

  await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: emailjs.serviceId,
      template_id: emailjs.templateId,
      user_id: emailjs.publicKey,
      template_params: {
        to_email:         watch.email,
        subject:          `NotifyMe: match found on ${new URL(watch.url).hostname}`,
        watch_url:        watch.url,
        matched_keywords: matchedFilters.join(", "),
        checked_at:       checkedAt,
        match_table:      matchTable,
      },
    }),
  });
}

// ── Build HTML match table ─────────────────────────────────────────────────

function buildMatchTable(watch, matchedFilters, pageText, checkedAt) {
  const textLower = pageText.toLowerCase();

  // For each keyword, find up to 3 occurrences and extract surrounding context
  const rows = [];
  for (const keyword of matchedFilters) {
    const kw = keyword.toLowerCase().trim();
    let searchFrom = 0;
    let count = 0;

    while (count < 3) {
      const idx = textLower.indexOf(kw, searchFrom);
      if (idx === -1) break;

      const start = Math.max(0, idx - 120);
      const end   = Math.min(pageText.length, idx + kw.length + 120);
      let context = pageText.slice(start, end).trim();

      // Highlight the keyword in the context
      const re = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      context = context.replace(re, `<mark style="background:#fef08a;padding:0 2px;border-radius:3px;">$1</mark>`);

      rows.push({ keyword, context });
      searchFrom = idx + kw.length;
      count++;
    }
  }

  const tableRows = rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
      <td style="padding:10px 14px;border:1px solid #e2e8f0;white-space:nowrap;">
        <span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;">
          ${r.keyword}
        </span>
      </td>
      <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;line-height:1.6;">
        …${r.context}…
      </td>
    </tr>`).join("");

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;">

  <div style="background:#4f46e5;padding:20px 24px;border-radius:10px 10px 0 0;">
    <h2 style="margin:0;color:#ffffff;font-size:18px;">🔔 NotifyMe Alert</h2>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Keywords detected on a watched page</p>
  </div>

  <div style="background:#f8fafc;padding:16px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>
        <td style="padding:4px 0;color:#64748b;width:120px;">URL</td>
        <td style="padding:4px 0;"><a href="${watch.url}" style="color:#4f46e5;">${watch.url}</a></td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#64748b;">Keywords</td>
        <td style="padding:4px 0;color:#1e293b;font-weight:600;">${matchedFilters.join(", ")}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#64748b;">Checked at</td>
        <td style="padding:4px 0;color:#1e293b;">${checkedAt}</td>
      </tr>
    </table>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:10px 14px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Keyword</th>
        <th style="padding:10px 14px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Context on Page</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div style="background:#f8fafc;padding:12px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;">
    <a href="${watch.url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:9px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
      View Page →
    </a>
  </div>

</div>`;
}

// ── Storage helpers ────────────────────────────────────────────────────────

async function updateWatch(id, patch) {
  const { watches = [] } = await chrome.storage.sync.get("watches");
  const updated = watches.map((w) => (w.id === id ? { ...w, ...patch } : w));
  await chrome.storage.sync.set({ watches: updated });
}

// Simple string hash for change detection
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}
