// ─── Trackio Background Service Worker ───────────────────────
// Handles communication between content script and popup,
// manages extension state, polls for real-time open notifications,
// and blocks compose-time self-opens via declarativeNetRequest.

// Default API base URL
const DEFAULT_API_BASE = "https://trackio.ayushk.blog";

// Notification polling interval (in minutes for chrome.alarms)
const POLL_ALARM_NAME = "trackio-poll-opens";
const POLL_INTERVAL_MINUTES = 0.5; // 30 seconds

// declarativeNetRequest rule ID for blocking compose-time pixel loads
const SELF_OPEN_BLOCK_RULE_ID = 1;

// ─── Extension Install / Startup ─────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.sync.get(["trackioApiBase", "trackioEnabled"], (result) => {
    // Always normalise the stored URL (strips trailing slashes from
    // previous installs that stored "https://…/")
    const apiBase = (result.trackioApiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
    chrome.storage.sync.set({ trackioApiBase: apiBase });

    if (result.trackioEnabled === undefined) {
      chrome.storage.sync.set({ trackioEnabled: true });
    }
  });

  startPollingAlarm();
  await setupSelfOpenBlockingRule();

  console.log("[Trackio] Extension installed and initialized.");
});

chrome.runtime.onStartup.addListener(async () => {
  startPollingAlarm();
  await setupSelfOpenBlockingRule();
});

// ─── declarativeNetRequest: Block Compose-Time Self-Opens ────
//
// When the extension injects an <img src="our-api/track/123"> into
// the Gmail compose body, the browser immediately tries to fetch it.
// That request originates from mail.google.com and is a direct
// hit to our server → a false "open" is recorded.
//
// This rule BLOCKS such image requests from Gmail, preventing the
// compose-time self-open entirely.  The <img src="…"> HTML is still
// in the compose body, so Gmail includes it in the sent email and
// the recipient's proxy will fetch it normally.
// ──────────────────────────────────────────────────────────────

async function setupSelfOpenBlockingRule() {
  try {
    const settings = await getSettings();
    let apiHost;
    try {
      const url = new URL(settings.apiBase);
      apiHost = url.host; // e.g. "trackio.ayushk.blog" or "localhost:3000"
    } catch {
      apiHost = "localhost:3000";
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [SELF_OPEN_BLOCK_RULE_ID],
      addRules: [
        {
          id: SELF_OPEN_BLOCK_RULE_ID,
          priority: 1,
          action: { type: "block" },
          condition: {
            // Match any tracking pixel URL on our API
            urlFilter: `||${apiHost}/api/track/`,
            // Only block when the request originates from Gmail
            initiatorDomains: ["mail.google.com"],
            resourceTypes: ["image"],
          },
        },
      ],
    });

    console.log(
      "[Trackio] Self-open blocking rule active for:",
      apiHost
    );
  } catch (error) {
    console.error("[Trackio] Failed to set blocking rule:", error);
  }
}

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

        trackingData[id] = {
          ...local,
          opened: newOpenCount > 0,
          openCount: newOpenCount,
          lastOpened: serverData.lastOpened,
        };

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

function showOpenNotification({
  emailId,
  recipient,
  subject,
  newOpens,
  totalOpens,
}) {
  const notifId = `trackio-open-${emailId}-${Date.now()}`;

  const title = `📧 Email Opened${newOpens > 1 ? ` (${newOpens}×)` : ""}`;
  const message = `${recipient} opened "${truncate(subject, 50)}"`;
  const contextMessage = `Total opens: ${totalOpens}`;

  chrome.notifications.create(
    notifId,
    {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
      contextMessage,
      priority: 2,
      requireInteraction: false,
      silent: false,
    },
    (createdId) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[Trackio] Notification error:",
          chrome.runtime.lastError.message
        );
      } else {
        console.log("[Trackio] Notification shown:", createdId);
      }
    }
  );

  setTimeout(() => {
    chrome.notifications.clear(notifId);
  }, 8000);
}

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

  if (message.type === "REPORT_SELF_VIEW") {
    handleReportSelfView(message.data).then(sendResponse);
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

    // Store the tracking info locally — includes senderToken for self-view reports
    const trackingData = await getTrackingData();
    trackingData[result.id] = {
      recipient: data.recipient,
      subject: data.subject,
      senderEmail: data.senderEmail,
      timestamp: Date.now(),
      opened: false,
      openCount: 0,
      senderToken: result.senderToken, // ← stored for self-view auth
      selfViewReported: false,
    };
    await chrome.storage.local.set({ trackioEmails: trackingData });

    return { success: true, id: result.id, trackingUrl: result.trackingUrl };
  } catch (error) {
    console.error("[Trackio] Failed to register email:", error);
    return { success: false, error: error.message };
  }
}

// ─── Report Self-View ────────────────────────────────────────
//
// Called by content.js when it detects the user is viewing their own
// sent email.  We call the server to mark the most recent open
// event as a self-open so it doesn't count on the dashboard.
// ──────────────────────────────────────────────────────────────

async function handleReportSelfView(data) {
  const { emailId, senderToken } = data;

  if (!emailId || !senderToken) {
    return { success: false, error: "Missing emailId or senderToken" };
  }

  try {
    const settings = await getSettings();
    const response = await fetch(
      `${settings.apiBase}/api/track/${emailId}/self-view`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderToken }),
      }
    );

    const result = await response.json();

    if (response.ok && result.compensated) {
      console.log("[Trackio] Self-view compensated for email:", emailId);

      // Mark as reported in local storage so we don't double-report
      const trackingData = await getTrackingData();
      if (trackingData[emailId]) {
        trackingData[emailId].selfViewReported = true;
        await chrome.storage.local.set({ trackioEmails: trackingData });
      }
    }

    return { success: response.ok, ...result };
  } catch (error) {
    console.error("[Trackio] Self-view report error:", error);
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
        // Strip trailing slashes to avoid double-slash URLs like
        // "https://trackio.ayushk.blog//api/..."
        const raw = result.trackioApiBase || DEFAULT_API_BASE;
        const apiBase = raw.replace(/\/+$/, "");

        resolve({
          apiBase,
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
