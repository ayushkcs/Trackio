// ─── Trackio Background Service Worker ───────────────────────
// Handles communication between content script and popup,
// manages extension state, and polls for real-time open notifications.

// Default API base URL (user configures via popup)
const DEFAULT_API_BASE = "http://localhost:3000";

// Notification polling interval (in minutes for chrome.alarms)
const POLL_ALARM_NAME = "trackio-poll-opens";
const POLL_INTERVAL_MINUTES = 0.5; // 30 seconds

// ─── Extension Install / Startup ─────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["trackioApiBase", "trackioEnabled"], (result) => {
    if (!result.trackioApiBase) {
      chrome.storage.sync.set({ trackioApiBase: DEFAULT_API_BASE });
    }
    if (result.trackioEnabled === undefined) {
      chrome.storage.sync.set({ trackioEnabled: true });
    }
  });

  // Start the polling alarm
  startPollingAlarm();

  console.log("[Trackio] Extension installed and initialized.");
});

// Also start alarm on service worker startup (in case it was suspended)
chrome.runtime.onStartup.addListener(() => {
  startPollingAlarm();
});

// ─── Alarm-based Polling ─────────────────────────────────────

function startPollingAlarm() {
  chrome.alarms.create(POLL_ALARM_NAME, {
    delayInMinutes: POLL_INTERVAL_MINUTES,
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
  console.log("[Trackio] Polling alarm started (every 30s).");
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== POLL_ALARM_NAME) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  await pollForNewOpens(settings);
});

// ─── Poll for New Opens ──────────────────────────────────────

async function pollForNewOpens(settings) {
  try {
    const trackingData = await getTrackingData();
    const emailIds = Object.keys(trackingData);

    if (emailIds.length === 0) return;

    const response = await fetch(`${settings.apiBase}/api/emails/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailIds }),
    });

    if (!response.ok) {
      console.warn("[Trackio] Poll API returned", response.status);
      return;
    }

    const statusMap = await response.json();
    let hasChanges = false;

    for (const [id, serverData] of Object.entries(statusMap)) {
      const local = trackingData[id];
      if (!local) continue;

      const prevOpenCount = local.openCount || 0;
      const newOpenCount = serverData.openCount || 0;

      if (newOpenCount > prevOpenCount) {
        hasChanges = true;
        const newOpens = newOpenCount - prevOpenCount;

        // Update local data
        trackingData[id] = {
          ...local,
          opened: newOpenCount > 0,
          openCount: newOpenCount,
          lastOpened: serverData.lastOpened,
        };

        // Show Chrome desktop notification
        showOpenNotification({
          emailId: id,
          recipient: serverData.recipient || local.recipient,
          subject: serverData.subject || local.subject,
          newOpens,
          totalOpens: newOpenCount,
        });
      }
    }

    if (hasChanges) {
      await chrome.storage.local.set({ trackioEmails: trackingData });
    }
  } catch (error) {
    console.error("[Trackio] Poll error:", error.message);
  }
}

// ─── Chrome Desktop Notifications ────────────────────────────

function showOpenNotification({ emailId, recipient, subject, newOpens, totalOpens }) {
  const notifId = `trackio-open-${emailId}-${Date.now()}`;

  const title = `📧 Email Opened${newOpens > 1 ? ` (${newOpens}×)` : ""}`;
  const message = `${recipient} opened "${truncate(subject, 50)}"`;
  const contextMessage = `Total opens: ${totalOpens}`;

  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    contextMessage,
    priority: 2,
    requireInteraction: false,
    silent: false,
  }, (createdId) => {
    if (chrome.runtime.lastError) {
      console.warn("[Trackio] Notification error:", chrome.runtime.lastError.message);
    } else {
      console.log("[Trackio] Notification shown:", createdId);
    }
  });

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    chrome.notifications.clear(notifId);
  }, 8000);
}

// Click notification → open dashboard
chrome.notifications.onClicked.addListener((notifId) => {
  if (!notifId.startsWith("trackio-")) return;

  chrome.storage.sync.get(["trackioApiBase"], (result) => {
    const apiBase = result.trackioApiBase || DEFAULT_API_BASE;
    chrome.tabs.create({ url: `${apiBase}/dashboard` });
  });

  chrome.notifications.clear(notifId);
});

// ─── Message Handling ────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REGISTER_EMAIL") {
    handleRegisterEmail(message.data).then(sendResponse);
    return true;
  }

  if (message.type === "CHECK_EMAIL_STATUS") {
    handleCheckEmailStatus(message.data).then(sendResponse);
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    chrome.storage.sync.get(
      ["trackioApiBase", "trackioEnabled"],
      (result) => {
        sendResponse({
          apiBase: result.trackioApiBase || DEFAULT_API_BASE,
          enabled: result.trackioEnabled !== false,
        });
      }
    );
    return true;
  }
});

// ─── Register Email ──────────────────────────────────────────

async function handleRegisterEmail(data) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return { success: false, error: "Tracking is disabled" };
    }

    const response = await fetch(`${settings.apiBase}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: data.recipient,
        subject: data.subject,
        senderEmail: data.senderEmail,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const result = await response.json();
    console.log("[Trackio] Email registered:", result.id);

    // Store the tracking info locally for the checkmark + notification features
    const trackingData = await getTrackingData();
    trackingData[result.id] = {
      recipient: data.recipient,
      subject: data.subject,
      timestamp: Date.now(),
      opened: false,
      openCount: 0,
    };
    await chrome.storage.local.set({ trackioEmails: trackingData });

    return { success: true, id: result.id, trackingUrl: result.trackingUrl };
  } catch (error) {
    console.error("[Trackio] Failed to register email:", error);
    return { success: false, error: error.message };
  }
}

// ─── Check Email Status ──────────────────────────────────────

async function handleCheckEmailStatus(data) {
  try {
    const settings = await getSettings();
    const response = await fetch(
      `${settings.apiBase}/api/emails?check=${data.emailId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Trackio] Failed to check email status:", error);
    return { success: false, error: error.message };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["trackioApiBase", "trackioEnabled"],
      (result) => {
        resolve({
          apiBase: result.trackioApiBase || DEFAULT_API_BASE,
          enabled: result.trackioEnabled !== false,
        });
      }
    );
  });
}

function getTrackingData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["trackioEmails"], (result) => {
      resolve(result.trackioEmails || {});
    });
  });
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}
