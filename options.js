// ── Helpers ────────────────────────────────────────────────────────────────

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function flash(elId, msg = "Saved!") {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function timeSince(iso) {
  if (!iso) return "—";
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── EmailJS config ─────────────────────────────────────────────────────────

async function loadEmailjs() {
  const { emailjs = {} } = await chrome.storage.sync.get("emailjs");
  document.getElementById("ejsServiceId").value  = emailjs.serviceId  || "";
  document.getElementById("ejsTemplateId").value = emailjs.templateId || "";
  document.getElementById("ejsPublicKey").value  = emailjs.publicKey  || "";
  document.getElementById("testEmail").value     = emailjs.testEmail  || "";
}

document.getElementById("saveEmailjs").addEventListener("click", async () => {
  const emailjs = {
    serviceId:  document.getElementById("ejsServiceId").value.trim(),
    templateId: document.getElementById("ejsTemplateId").value.trim(),
    publicKey:  document.getElementById("ejsPublicKey").value.trim(),
    testEmail:  document.getElementById("testEmail").value.trim(),
  };
  await chrome.storage.sync.set({ emailjs });
  flash("emailjsSaved");
});

document.getElementById("sendTest").addEventListener("click", async () => {
  const { emailjs = {} } = await chrome.storage.sync.get("emailjs");
  const toEmail = document.getElementById("testEmail").value.trim();

  if (!emailjs.serviceId || !emailjs.templateId || !emailjs.publicKey) {
    alert("Please save your EmailJS config first.");
    return;
  }
  if (!toEmail) {
    alert("Enter a Test Email address above.");
    return;
  }

  const btn = document.getElementById("sendTest");
  btn.textContent = "Sending…";
  btn.disabled = true;

  const testWatch = { url: "https://example.com/test-page" };
  const matchedFilters = ["test keyword", "notifyme"];
  const checkedAt = new Date().toLocaleString();
  const matchTable = buildTestMatchTable(testWatch, matchedFilters, checkedAt);

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: emailjs.serviceId,
        template_id: emailjs.templateId,
        user_id: emailjs.publicKey,
        template_params: {
          to_email:         toEmail,
          subject:          "NotifyMe: Test Email",
          watch_url:        testWatch.url,
          matched_keywords: matchedFilters.join(", "),
          checked_at:       checkedAt,
          match_table:      matchTable,
        },
      }),
    });

    if (res.ok) {
      flash("emailjsSaved", "Test email sent!");
    } else {
      const text = await res.text();
      alert(`Failed to send: ${res.status} — ${text}`);
    }
  } catch (e) {
    alert(`Error: ${e.message}`);
  }

  btn.textContent = "Send Test Email";
  btn.disabled = false;
});

function buildTestMatchTable(watch, matchedFilters, checkedAt) {
  const sampleContexts = {
    "test keyword": "…this page contains a <mark style='background:#fef08a;padding:0 2px;border-radius:3px;'>test keyword</mark> to verify your NotifyMe email setup is working correctly…",
    "notifyme":     "…<mark style='background:#fef08a;padding:0 2px;border-radius:3px;'>NotifyMe</mark> is monitoring this page and will alert you when real keywords are found…",
  };

  const tableRows = matchedFilters.map((kw, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
      <td style="padding:10px 14px;border:1px solid #e2e8f0;white-space:nowrap;">
        <span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;">${kw}</span>
      </td>
      <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;line-height:1.6;">
        ${sampleContexts[kw] || `…sample context for <mark style='background:#fef08a;padding:0 2px;border-radius:3px;'>${kw}</mark>…`}
      </td>
    </tr>`).join("");

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;">
  <div style="background:#4f46e5;padding:20px 24px;border-radius:10px 10px 0 0;">
    <h2 style="margin:0;color:#ffffff;font-size:18px;">🔔 NotifyMe — Test Email</h2>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Your email configuration is working!</p>
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
    <tbody>${tableRows}</tbody>
  </table>
  <div style="background:#f8fafc;padding:12px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;">
    <a href="${watch.url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:9px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">View Page →</a>
  </div>
</div>`;
}

// ── Watch form ─────────────────────────────────────────────────────────────

const saveBtn    = document.getElementById("saveWatch");
const cancelBtn  = document.getElementById("cancelEdit");
const formTitle  = document.getElementById("formTitle");

function resetForm() {
  document.getElementById("editId").value = "";
  document.getElementById("watchUrl").value = "";
  document.getElementById("watchFilters").value = "";
  document.getElementById("watchEmail").value = "";
  document.getElementById("watchInterval").value = "30";
  formTitle.textContent = "Add New Watch";
  saveBtn.textContent = "Add Watch";
  cancelBtn.style.display = "none";
}

cancelBtn.addEventListener("click", resetForm);

saveBtn.addEventListener("click", async () => {
  const url      = document.getElementById("watchUrl").value.trim();
  const filters  = document.getElementById("watchFilters").value
    .split(",").map((f) => f.trim()).filter(Boolean);
  const email    = document.getElementById("watchEmail").value.trim();
  const interval = parseInt(document.getElementById("watchInterval").value) || 30;
  const editId   = document.getElementById("editId").value;

  if (!url || !filters.length || !email) {
    alert("Please fill in URL, at least one keyword, and an email.");
    return;
  }

  const { watches = [] } = await chrome.storage.sync.get("watches");

  if (editId) {
    const updated = watches.map((w) =>
      w.id === editId ? { ...w, url, filters, email, interval } : w
    );
    await chrome.storage.sync.set({ watches: updated });
  } else {
    const newWatch = {
      id: genId(),
      url,
      filters,
      email,
      interval,
      active: true,
      lastCheck: null,
      lastStatus: "pending",
      lastMatchFingerprint: null,
      lastMatchTime: null,
    };
    await chrome.storage.sync.set({ watches: [...watches, newWatch] });
  }

  flash("watchSaved", editId ? "Watch updated!" : "Watch added!");
  resetForm();
  renderWatches();
});

// ── Watch list ─────────────────────────────────────────────────────────────

async function renderWatches() {
  const { watches = [] } = await chrome.storage.sync.get("watches");
  const container = document.getElementById("watchTable");

  if (watches.length === 0) {
    container.innerHTML = '<p class="empty">No watches yet. Add one above.</p>';
    return;
  }

  const rows = watches.map((w) => {
    const statusLabel = !w.active ? "paused" : (w.lastStatus || "pending");
    return `
    <tr>
      <td class="url-cell" title="${w.url}"><a href="${w.url}" target="_blank">${w.url}</a></td>
      <td>${w.filters.join(", ")}</td>
      <td>${w.email}</td>
      <td>${w.interval}m</td>
      <td><span class="status-pill ${statusLabel}">${statusLabel}</span></td>
      <td>${timeSince(w.lastCheck)}</td>
      <td>
        <div class="btn-group">
          <button class="btn-edit"   data-action="edit"   data-id="${w.id}">Edit</button>
          <button class="btn-edit"   data-action="toggle" data-id="${w.id}">${w.active ? "Pause" : "Resume"}</button>
          <button class="btn-danger" data-action="delete" data-id="${w.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <table class="watch-table">
      <thead>
        <tr>
          <th>URL</th>
          <th>Keywords</th>
          <th>Email</th>
          <th>Interval</th>
          <th>Status</th>
          <th>Last Check</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  container.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, btn.dataset.id));
  });
}

async function handleAction(action, id) {
  const { watches = [] } = await chrome.storage.sync.get("watches");

  if (action === "delete") {
    if (!confirm("Delete this watch?")) return;
    await chrome.storage.sync.set({ watches: watches.filter((w) => w.id !== id) });

  } else if (action === "toggle") {
    await chrome.storage.sync.set({
      watches: watches.map((w) => (w.id === id ? { ...w, active: !w.active } : w)),
    });

  } else if (action === "edit") {
    const w = watches.find((w) => w.id === id);
    if (!w) return;
    document.getElementById("editId").value = w.id;
    document.getElementById("watchUrl").value = w.url;
    document.getElementById("watchFilters").value = w.filters.join(", ");
    document.getElementById("watchEmail").value = w.email;
    document.getElementById("watchInterval").value = w.interval;
    formTitle.textContent = "Edit Watch";
    saveBtn.textContent = "Update Watch";
    cancelBtn.style.display = "inline-block";
    document.getElementById("addSection").scrollIntoView({ behavior: "smooth" });
    return;
  }

  renderWatches();
}

// ── Init ───────────────────────────────────────────────────────────────────

loadEmailjs();
renderWatches();

// Refresh status every 10s while page is open
setInterval(renderWatches, 10000);
