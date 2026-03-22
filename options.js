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
}

document.getElementById("saveEmailjs").addEventListener("click", async () => {
  const emailjs = {
    serviceId:  document.getElementById("ejsServiceId").value.trim(),
    templateId: document.getElementById("ejsTemplateId").value.trim(),
    publicKey:  document.getElementById("ejsPublicKey").value.trim(),
  };
  await chrome.storage.sync.set({ emailjs });
  flash("emailjsSaved");
});

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
