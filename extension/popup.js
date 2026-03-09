// ─── Trackio Popup Script ────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const enableToggle = document.getElementById("enableToggle");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const trackedCount = document.getElementById("trackedCount");
  const openedCount = document.getElementById("openedCount");
  const dashboardLink = document.getElementById("dashboardLink");

  // Load saved settings (API base URL is internal, not user-editable)
  chrome.storage.sync.get(
    ["trackioApiBase", "trackioEnabled"],
    (result) => {
      const apiBase = result.trackioApiBase || "http://localhost:3000";
      const enabled = result.trackioEnabled !== false;

      enableToggle.checked = enabled;
      dashboardLink.href = `${apiBase}/dashboard`;

      updateStatus(enabled, apiBase);
    }
  );

  // Load tracked email stats from local storage
  chrome.storage.local.get(["trackioEmails"], (result) => {
    const emails = result.trackioEmails || {};
    const tracked = Object.keys(emails).length;
    const opened = Object.values(emails).filter((e) => e.opened).length;

    trackedCount.textContent = tracked.toString();
    openedCount.textContent = opened.toString();
  });

  // Toggle handler
  enableToggle.addEventListener("change", () => {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ trackioEnabled: enabled });

    chrome.storage.sync.get(["trackioApiBase"], (result) => {
      updateStatus(enabled, result.trackioApiBase || "http://localhost:3000");
    });
  });

  // Check API connection status
  async function updateStatus(enabled, apiBase) {
    if (!enabled) {
      statusDot.className = "status-dot";
      statusText.textContent = "Tracking disabled";
      return;
    }

    statusDot.className = "status-dot";
    statusText.textContent = "Connecting...";

    try {
      const response = await fetch(`${apiBase}/api/emails`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok || response.status === 401) {
        // 401 is expected if not logged in, but API is reachable
        statusDot.className = "status-dot active";
        statusText.textContent = "Connected to dashboard";
      } else {
        statusDot.className = "status-dot error";
        statusText.textContent = "API error (" + response.status + ")";
      }
    } catch (error) {
      statusDot.className = "status-dot error";
      statusText.textContent = "Cannot reach dashboard";
    }
  }
});
