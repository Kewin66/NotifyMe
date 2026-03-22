const list = document.getElementById("watchList");

function statusDot(status) {
  const s = status || "pending";
  return `<span class="status-dot ${s}"></span>`;
}

function timeSince(iso) {
  if (!iso) return "never checked";
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

async function render() {
  const { watches = [] } = await chrome.storage.sync.get("watches");

  if (watches.length === 0) {
    list.innerHTML = '<p class="empty">No watches set up yet.<br>Click "+ Add Watch" to get started.</p>';
    return;
  }

  list.innerHTML = watches
    .map(
      (w) => `
    <div class="watch-item" data-id="${w.id}">
      ${statusDot(w.active ? w.lastStatus : "no-match")}
      <div class="watch-info">
        <span class="watch-url" title="${w.url}">${w.url}</span>
        <div class="watch-filters">Keywords: ${w.filters.join(", ")}</div>
        <div class="watch-meta">
          ${w.active ? `Checked ${timeSince(w.lastCheck)} · every ${w.interval}m` : "Paused"}
          ${w.lastStatus === "match" ? " · <b style='color:#16a34a'>Match!</b>" : ""}
        </div>
      </div>
      <button class="watch-toggle" data-id="${w.id}" title="${w.active ? "Pause" : "Resume"}">
        ${w.active ? "⏸" : "▶"}
      </button>
    </div>`
    )
    .join("");

  // Toggle active/paused
  document.querySelectorAll(".watch-toggle").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const { watches = [] } = await chrome.storage.sync.get("watches");
      const updated = watches.map((w) =>
        w.id === id ? { ...w, active: !w.active } : w
      );
      await chrome.storage.sync.set({ watches: updated });
      render();
    });
  });
}

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("addWatch").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

render();
