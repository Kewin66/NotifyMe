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

  const snippet = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 800);

  const body = [
    `NotifyMe found your watched keywords on:`,
    `${watch.url}`,
    ``,
    `Matched keywords: ${matchedFilters.join(", ")}`,
    ``,
    `Page snippet:`,
    snippet,
    ``,
    `Checked at: ${new Date().toLocaleString()}`,
  ].join("\n");

  await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: emailjs.serviceId,
      template_id: emailjs.templateId,
      user_id: emailjs.publicKey,
      template_params: {
        to_email: watch.email,
        subject: `NotifyMe: match found on ${new URL(watch.url).hostname}`,
        message: body,
        watch_url: watch.url,
        matched_keywords: matchedFilters.join(", "),
        page_snippet: snippet,
      },
    }),
  });
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
