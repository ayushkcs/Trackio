// ─── Trackio Content Script ──────────────────────────────────
// Injected into Gmail to:
// 1. Detect compose windows and intercept Send clicks
// 2. Inject tracking pixels into email bodies
// 3. Show checkmark icons in Sent folder for opened emails
// 4. Detect self-views and report them to the server
//    (compose-time blocked by declarativeNetRequest in background.js;
//     sent-folder / thread views handled here)

(function () {
  "use strict";

  // ─── Constants ─────────────────────────────────────────────
  const TRACKIO_PREFIX = "[Trackio]";
  const COMPOSE_CHECK_INTERVAL = 500;
  const SENT_FOLDER_CHECK_INTERVAL = 5000;
  const PROCESSED_ATTR = "data-trackio-processed";
  const CHECKMARK_ATTR = "data-trackio-checkmark";

  // Debounce: don't re-report the same email within this window
  const SELF_VIEW_DEBOUNCE_MS = 60_000; // 1 minute

  // ─── State ─────────────────────────────────────────────────
  let settings = { apiBase: "http://localhost:3000", enabled: true };
  let senderEmail = null;
  let isInSentFolder = false;

  // Tracks when we last reported a self-view for each email ID
  // to avoid flooding the server with duplicate reports
  const selfViewTimestamps = {};

  // ─── Initialize ────────────────────────────────────────────
  async function init() {
    log("Initializing...");

    try {
      settings = await sendMessage({ type: "GET_SETTINGS" });
    } catch (e) {
      log("Failed to load settings, using defaults");
    }

    if (!settings.enabled) {
      log("Tracking is disabled");
      return;
    }

    await waitForGmail();

    senderEmail = extractSenderEmail();
    log("Sender email:", senderEmail);

    observeComposeWindows();
    observeSentFolder();

    log("Initialized successfully!");
  }

  // ─── Wait for Gmail ────────────────────────────────────────
  function waitForGmail() {
    return new Promise((resolve) => {
      const check = () => {
        if (
          document.querySelector('div[role="main"]') ||
          document.querySelector(".nH") ||
          document.querySelector('[gh="tl"]')
        ) {
          resolve();
          return;
        }
        setTimeout(check, 500);
      };
      check();
    });
  }

  // ─── Extract Sender Email ──────────────────────────────────
  function extractSenderEmail() {
    const accountBtn = document.querySelector(
      'a[aria-label*="Google Account"]'
    );
    if (accountBtn) {
      const label = accountBtn.getAttribute("aria-label") || "";
      const match = label.match(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
      );
      if (match) return match[1];
    }

    const emailAttr = document.querySelector("[data-email]");
    if (emailAttr) return emailAttr.getAttribute("data-email");

    const titleMatch = document.title.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    if (titleMatch) return titleMatch[1];

    return null;
  }

  // ─── Observe Compose Windows ───────────────────────────────
  function observeComposeWindows() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const composeWindows = [];

          if (node.classList && node.classList.contains("M9")) {
            composeWindows.push(node);
          }

          if (node.querySelectorAll) {
            composeWindows.push(...node.querySelectorAll(".M9"));
          }

          const inlineCompose = node.querySelectorAll
            ? node.querySelectorAll(".ip.iq")
            : [];
          composeWindows.push(...inlineCompose);

          for (const compose of composeWindows) {
            processComposeWindow(compose);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.querySelectorAll(".M9, .ip.iq").forEach(processComposeWindow);
    log("Compose window observer started");
  }

  // ─── Process a Compose Window ──────────────────────────────
  function processComposeWindow(composeEl) {
    if (!composeEl || composeEl.getAttribute(PROCESSED_ATTR)) return;
    composeEl.setAttribute(PROCESSED_ATTR, "true");

    log("New compose window detected");
    addTrackingIndicator(composeEl);
    interceptSendButton(composeEl);
  }

  // ─── Add Tracking Indicator ────────────────────────────────
  function addTrackingIndicator(composeEl) {
    const toolbar =
      composeEl.querySelector(".btC") || composeEl.querySelector(".IZ");
    if (!toolbar) return;

    if (toolbar.querySelector(".trackio-indicator")) return;

    const indicator = document.createElement("div");
    indicator.className = "trackio-indicator";
    indicator.innerHTML = `
      <span class="trackio-dot"></span>
      <span class="trackio-text">Trackio</span>
    `;
    indicator.title = "Trackio is tracking this email";
    toolbar.appendChild(indicator);
  }

  // ─── Intercept Send Button ─────────────────────────────────
  function interceptSendButton(composeEl) {
    const findSendButton = () => {
      return (
        composeEl.querySelector('[data-tooltip*="Send"]') ||
        composeEl.querySelector('[aria-label*="Send"]') ||
        composeEl.querySelector(".T-I.J-J5-Ji.aoO") ||
        composeEl.querySelector('div[role="button"].T-I.J-J5-Ji')
      );
    };

    let sendButton = findSendButton();

    if (!sendButton) {
      let retries = 0;
      const retryInterval = setInterval(() => {
        sendButton = findSendButton();
        if (sendButton || retries > 10) {
          clearInterval(retryInterval);
          if (sendButton) {
            attachSendInterceptor(composeEl, sendButton);
          } else {
            log("Could not find Send button after retries");
          }
        }
        retries++;
      }, COMPOSE_CHECK_INTERVAL);
      return;
    }

    attachSendInterceptor(composeEl, sendButton);
  }

  // ─── Attach Send Interceptor ───────────────────────────────
  function attachSendInterceptor(composeEl, sendButton) {
    if (sendButton.getAttribute("data-trackio-intercepted")) return;
    sendButton.setAttribute("data-trackio-intercepted", "true");

    log("Send button intercepted");

    sendButton.addEventListener(
      "click",
      async function (e) {
        if (composeEl.getAttribute("data-trackio-sending")) return;
        composeEl.setAttribute("data-trackio-sending", "true");

        e.stopImmediatePropagation();
        e.preventDefault();

        log("Send intercepted, injecting tracking pixel...");

        try {
          const recipient = extractRecipient(composeEl);
          const subject = extractSubject(composeEl);

          if (!recipient) {
            log("No recipient found, sending without tracking");
            triggerOriginalSend(composeEl);
            return;
          }

          const sender =
            senderEmail || extractSenderFromCompose(composeEl);

          const result = await sendMessage({
            type: "REGISTER_EMAIL",
            data: {
              recipient,
              subject: subject || "(No Subject)",
              senderEmail: sender || "unknown",
            },
          });

          if (result && result.success && result.id) {
            injectTrackingPixel(
              composeEl,
              result.trackingUrl || result.id
            );
            log("Tracking pixel injected for:", recipient);
          } else {
            log("Failed to register email:", result?.error);
          }
        } catch (error) {
          log("Error during send interception:", error);
        }

        setTimeout(() => {
          triggerOriginalSend(composeEl);
        }, 100);
      },
      true
    );
  }

  // ─── Extract Email Details ─────────────────────────────────
  function extractRecipient(composeEl) {
    const toField =
      composeEl.querySelector('input[name="to"]') ||
      composeEl.querySelector('[aria-label="To recipients"]') ||
      composeEl.querySelector(".agP.aFw");

    if (toField) {
      const chips = composeEl.querySelectorAll(
        '[data-hovercard-id], .vR .vN, [email]'
      );
      if (chips.length > 0) {
        const firstChip = chips[0];
        return (
          firstChip.getAttribute("data-hovercard-id") ||
          firstChip.getAttribute("email") ||
          firstChip.textContent?.trim()
        );
      }

      return toField.value || toField.textContent?.trim();
    }

    const replyHeader = composeEl
      .closest(".h7")
      ?.querySelector("[email]");
    if (replyHeader) {
      return replyHeader.getAttribute("email");
    }

    return null;
  }

  function extractSubject(composeEl) {
    const subjectInput =
      composeEl.querySelector('input[name="subjectbox"]') ||
      composeEl.querySelector('[aria-label="Subject"]');

    if (subjectInput) {
      return subjectInput.value;
    }

    const threadSubject = document.querySelector(
      'h2[data-thread-perm-id], .hP'
    );
    if (threadSubject) {
      return threadSubject.textContent?.trim();
    }

    return "";
  }

  function extractSenderFromCompose(composeEl) {
    const fromField = composeEl.querySelector('[name="from"]');
    if (fromField) return fromField.value;
    return senderEmail;
  }

  // ─── Inject Tracking Pixel ─────────────────────────────────
  function injectTrackingPixel(composeEl, trackingUrl) {
    const emailBody = composeEl.querySelector(
      '[contenteditable="true"][role="textbox"], .Am.Al.editable, [g_editable="true"]'
    );

    if (!emailBody) {
      log("Could not find email body to inject pixel");
      return;
    }

    const fullUrl = trackingUrl.startsWith("http")
      ? trackingUrl
      : `${settings.apiBase}/api/track/${trackingUrl}`;

    // NOTE: The browser will try to fetch this image immediately, but
    // the declarativeNetRequest rule in background.js BLOCKS image
    // requests to our /api/track/ from mail.google.com.
    // So no self-open is recorded.  The <img src="…"> HTML remains
    // in the compose body and Gmail includes it in the sent email.
    const pixel = document.createElement("img");
    pixel.src = fullUrl;
    pixel.width = 1;
    pixel.height = 1;
    pixel.style.cssText =
      "display:none!important;width:1px!important;height:1px!important;opacity:0!important;position:absolute!important;";
    pixel.alt = "";
    pixel.setAttribute("data-trackio-pixel", "true");

    emailBody.appendChild(pixel);
  }

  // ─── Trigger Original Send ─────────────────────────────────
  function triggerOriginalSend(composeEl) {
    const emailBody = composeEl.querySelector(
      '[contenteditable="true"][role="textbox"], .Am.Al.editable, [g_editable="true"]'
    );

    if (emailBody) {
      emailBody.focus();
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      emailBody.dispatchEvent(event);
    } else {
      const sendBtn =
        composeEl.querySelector('[data-tooltip*="Send"]') ||
        composeEl.querySelector('[aria-label*="Send"]') ||
        composeEl.querySelector(".T-I.J-J5-Ji.aoO");

      if (sendBtn) {
        composeEl.removeAttribute("data-trackio-sending");
        composeEl.removeAttribute(PROCESSED_ATTR);
        sendBtn.removeAttribute("data-trackio-intercepted");
        sendBtn.click();
      }
    }
  }

  // ─── Sent Folder: Checkmark + Self-View Detection ──────────
  function observeSentFolder() {
    // Periodically check for Sent folder and report self-views
    setInterval(() => {
      checkSentFolder();
    }, SENT_FOLDER_CHECK_INTERVAL);

    // Also observe URL changes (Gmail is a SPA)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(checkSentFolder, 1000);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    // Also detect when viewing a single thread the user authored
    setInterval(checkViewingOwnThread, SENT_FOLDER_CHECK_INTERVAL);
  }

  function checkSentFolder() {
    // Check if we're in the Sent folder
    const sentNavItem = document.querySelector('[data-tooltip="Sent"]');
    const isSent =
      location.hash.includes("#sent") ||
      location.hash.includes("#search/in%3Asent") ||
      (sentNavItem && sentNavItem.classList.contains("asa"));

    isInSentFolder = isSent;

    if (!isSent) return;

    // Find email rows in the list
    const emailRows = document.querySelectorAll(
      "tr.zA:not([" + CHECKMARK_ATTR + "])"
    );

    emailRows.forEach(async (row) => {
      row.setAttribute(CHECKMARK_ATTR, "checking");

      const subjectEl = row.querySelector(".bog .bqe, .y2");
      const subject = subjectEl?.textContent?.trim();

      if (!subject) {
        row.setAttribute(CHECKMARK_ATTR, "no-subject");
        return;
      }

      const trackingData = await getLocalTrackingData();
      const matchEntry = findTrackedEmailBySubject(trackingData, subject);

      if (matchEntry) {
        const [emailId, trackedEmail] = matchEntry;

        // ── Self-view reporting ──────────────────────────
        // This row is a tracked email we sent — report the
        // self-view so the server can compensate the pixel hit
        // that Gmail's proxy made when rendering this row.
        reportSelfViewIfNeeded(emailId, trackedEmail);

        addCheckmarkToRow(row, trackedEmail.opened);
        row.setAttribute(CHECKMARK_ATTR, "done");
      } else {
        row.setAttribute(CHECKMARK_ATTR, "not-tracked");
      }
    });
  }

  /**
   * Detect when the user is viewing a full email thread they authored.
   * Gmail renders the thread inline; if it's the user's own email,
   * the proxy may have refetched the pixel.
   */
  function checkViewingOwnThread() {
    if (isInSentFolder) return; // already handled by checkSentFolder

    // Check if we're inside a thread view that the user sent
    if (!isViewingOwnEmail()) return;

    // Get the thread subject
    const subjectEl = document.querySelector(
      "h2[data-thread-perm-id], .hP"
    );
    const subject = subjectEl?.textContent?.trim();
    if (!subject) return;

    // Look up in local tracking data
    getLocalTrackingData().then((trackingData) => {
      const matchEntry = findTrackedEmailBySubject(trackingData, subject);
      if (matchEntry) {
        const [emailId, trackedEmail] = matchEntry;
        reportSelfViewIfNeeded(emailId, trackedEmail);
      }
    });
  }

  // ─── Self-View Reporting ───────────────────────────────────

  /**
   * Report a self-view to the server if we haven't recently done so
   * for this email.  Uses a per-email debounce to avoid flooding.
   */
  function reportSelfViewIfNeeded(emailId, trackedEmail) {
    // Skip if no senderToken (old emails before this feature)
    if (!trackedEmail.senderToken) return;

    // Skip if already reported and debounce window hasn't passed
    const lastReported = selfViewTimestamps[emailId] || 0;
    if (Date.now() - lastReported < SELF_VIEW_DEBOUNCE_MS) return;

    selfViewTimestamps[emailId] = Date.now();

    log("Reporting self-view for:", emailId);

    sendMessage({
      type: "REPORT_SELF_VIEW",
      data: {
        emailId,
        senderToken: trackedEmail.senderToken,
      },
    }).catch((err) => {
      log("Self-view report failed:", err);
    });
  }

  // ─── Checkmark UI ──────────────────────────────────────────

  function addCheckmarkToRow(row, isOpened) {
    const dateCell = row.querySelector(".xW.xY, .bq4");
    if (!dateCell) return;

    if (dateCell.querySelector(".trackio-checkmark")) return;

    const checkmark = document.createElement("span");
    checkmark.className = `trackio-checkmark ${
      isOpened ? "trackio-opened" : "trackio-sent"
    }`;
    checkmark.innerHTML = isOpened
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-9.5 9.5L10 17"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    checkmark.title = isOpened
      ? "✓ Email has been opened"
      : "✓ Email sent (not yet opened)";

    dateCell.prepend(checkmark);
  }

  // ─── Helpers ───────────────────────────────────────────────

  function isViewingOwnEmail() {
    const fromLabels = document.querySelectorAll(".gD[email]");
    for (const label of fromLabels) {
      if (label.getAttribute("email") === senderEmail) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find a tracked email entry whose subject matches (case-insensitive).
   * Returns [emailId, trackedEmail] or null.
   */
  function findTrackedEmailBySubject(trackingData, subject) {
    const normalised = subject.toLowerCase();
    for (const [id, entry] of Object.entries(trackingData)) {
      if (entry.subject && entry.subject.toLowerCase() === normalised) {
        return [id, entry];
      }
    }
    return null;
  }

  function log(...args) {
    console.log(TRACKIO_PREFIX, ...args);
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function getLocalTrackingData() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["trackioEmails"], (result) => {
          resolve(result.trackioEmails || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  // ─── Start ─────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 1500);
  }
})();
