// ─── Trackio Content Script ──────────────────────────────────
// Injected into Gmail to:
// 1. Detect compose windows and intercept Send clicks
// 2. Inject tracking pixels into email bodies
// 3. Show checkmark icons in Sent folder for opened emails
// 4. Detect self-views and report them to the server

(function () {
  "use strict";

  // ─── Constants ─────────────────────────────────────────────
  const TRACKIO_PREFIX = "[Trackio]";
  const COMPOSE_SCAN_INTERVAL = 2000;
  const SENT_FOLDER_CHECK_INTERVAL = 5000;
  const PROCESSED_ATTR = "data-trackio-processed";
  const CHECKMARK_ATTR = "data-trackio-checkmark";
  const SELF_VIEW_DEBOUNCE_MS = 60_000;

  // ─── State ─────────────────────────────────────────────────
  let settings = { apiBase: "https://trackio.ayushk.blog", enabled: true };
  let senderEmail = null;
  let isInSentFolder = false;
  const selfViewTimestamps = {};

  // ─── Logging ───────────────────────────────────────────────
  function log(...args) {
    console.log(TRACKIO_PREFIX, ...args);
  }

  // ─── Initialize ────────────────────────────────────────────
  async function init() {
    log("Content script loaded, initializing...");

    try {
      settings = await sendMessage({ type: "GET_SETTINGS" });
      log("Settings loaded:", JSON.stringify(settings));
    } catch (e) {
      log("Failed to load settings, using defaults:", e.message || e);
    }

    if (!settings || typeof settings !== "object") {
      settings = { apiBase: "https://trackio.ayushk.blog", enabled: true };
      log("Settings invalid, reset to defaults");
    }

    if (!settings.enabled) {
      log("Tracking is disabled in settings");
      return;
    }

    log("Waiting for Gmail to load...");
    await waitForGmail();
    log("Gmail loaded");

    senderEmail = extractSenderEmail();
    log("Sender email:", senderEmail);

    observeComposeWindows();
    startComposeScanner();
    observeSentFolder();

    log("✓ Initialized successfully! Watching for compose windows.");
  }

  // ─── Wait for Gmail ────────────────────────────────────────
  function waitForGmail() {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (
          document.querySelector('div[role="navigation"]') ||
          document.querySelector('div[role="main"]') ||
          document.querySelector(".nH") ||
          document.querySelector('[gh="tl"]') ||
          document.querySelector('[data-tooltip="Inbox"]')
        ) {
          log("Gmail DOM ready after", attempts, "checks");
          resolve();
          return;
        }
        if (attempts > 60) {
          log("Gmail wait timed out, proceeding anyway");
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
    // Method 1: Google Account button
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

    // Method 2: data-email attribute
    const emailEl = document.querySelector(
      '[data-email]:not([data-email=""])'
    );
    if (emailEl) return emailEl.getAttribute("data-email");

    // Method 3: Gmail header area
    const headerEmail = document.querySelector(
      '.gb_d[aria-label*="@"], .gb_Jb'
    );
    if (headerEmail) {
      const text = headerEmail.textContent || headerEmail.getAttribute("aria-label") || "";
      const match = text.match(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
      );
      if (match) return match[1];
    }

    // Method 4: Page title
    const titleMatch = document.title.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    if (titleMatch) return titleMatch[1];

    return null;
  }

  // ─── Compose Window Detection ─────────────────────────────
  // Use MULTIPLE strategies to find compose windows

  function findAllComposeWindows() {
    const found = new Set();

    // Strategy 1: Gmail's .M9 class (compose dialog)
    document.querySelectorAll(".M9").forEach((el) => found.add(el));

    // Strategy 2: Inline reply compose (.ip.iq)
    document.querySelectorAll(".ip.iq").forEach((el) => found.add(el));

    // Strategy 3: Look for any container with a contenteditable body
    // AND a Send-like button — this is compose-window agnostic
    document
      .querySelectorAll('[role="dialog"], .dw, .nH .no')
      .forEach((el) => {
        const hasEditor = el.querySelector(
          '[contenteditable="true"][role="textbox"], .Am.Al.editable, [g_editable="true"]'
        );
        const hasSendBtn = findSendButtonIn(el);
        if (hasEditor && hasSendBtn) {
          found.add(el);
        }
      });

    // Strategy 4: Fullscreen compose (class may vary)
    document.querySelectorAll(".AD").forEach((el) => {
      const hasEditor = el.querySelector(
        '[contenteditable="true"][role="textbox"], .Am.Al.editable, [g_editable="true"]'
      );
      if (hasEditor) found.add(el);
    });

    return [...found];
  }

  function observeComposeWindows() {
    const observer = new MutationObserver(() => {
      scanForComposeWindows();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Immediate scan
    scanForComposeWindows();
    log("Compose window observer started");
  }

  // Periodic fallback scanner (catches anything the MutationObserver misses)
  function startComposeScanner() {
    setInterval(() => {
      scanForComposeWindows();
    }, COMPOSE_SCAN_INTERVAL);
  }

  function scanForComposeWindows() {
    const composeWindows = findAllComposeWindows();
    for (const composeEl of composeWindows) {
      processComposeWindow(composeEl);
    }
  }

  // ─── Process a Compose Window ──────────────────────────────
  function processComposeWindow(composeEl) {
    if (!composeEl || composeEl.getAttribute(PROCESSED_ATTR)) return;
    composeEl.setAttribute(PROCESSED_ATTR, "true");

    log("✓ New compose window detected");
    addTrackingIndicator(composeEl);
    interceptSendButton(composeEl);
  }

  // ─── Add Tracking Indicator ────────────────────────────────
  function addTrackingIndicator(composeEl) {
    const toolbar =
      composeEl.querySelector(".btC") ||
      composeEl.querySelector(".IZ") ||
      composeEl.querySelector(".bAK") ||
      composeEl.querySelector('[role="toolbar"]');

    if (!toolbar) {
      log("Could not find toolbar for tracking indicator");
      return;
    }

    if (toolbar.querySelector(".trackio-indicator")) return;

    const indicator = document.createElement("div");
    indicator.className = "trackio-indicator";
    indicator.innerHTML = `
      <span class="trackio-dot"></span>
      <span class="trackio-text">Trackio</span>
    `;
    indicator.title = "Trackio is tracking this email";
    toolbar.appendChild(indicator);
    log("Tracking indicator added to compose window");
  }

  // ─── Find Send Button ─────────────────────────────────────
  function findSendButtonIn(container) {
    return (
      container.querySelector('[data-tooltip*="Send"]') ||
      container.querySelector('[aria-label*="Send"]') ||
      container.querySelector('[data-tooltip*="send"]') ||
      container.querySelector('[aria-label*="send"]') ||
      container.querySelector(".T-I.J-J5-Ji.aoO") ||
      container.querySelector('div[role="button"].T-I.J-J5-Ji') ||
      // Broader: any role=button whose text says "Send"
      (() => {
        const buttons = container.querySelectorAll('[role="button"]');
        for (const btn of buttons) {
          const txt = (btn.textContent || "").trim();
          if (txt === "Send" || txt === "send") return btn;
        }
        return null;
      })()
    );
  }

  // ─── Intercept Send Button ─────────────────────────────────
  function interceptSendButton(composeEl) {
    let sendButton = findSendButtonIn(composeEl);

    if (!sendButton) {
      log("Send button not found immediately, retrying...");
      let retries = 0;
      const retryInterval = setInterval(() => {
        sendButton = findSendButtonIn(composeEl);
        if (sendButton || retries > 20) {
          clearInterval(retryInterval);
          if (sendButton) {
            attachSendInterceptor(composeEl, sendButton);
          } else {
            log("Could not find Send button after 20 retries");
          }
        }
        retries++;
      }, 500);
      return;
    }

    attachSendInterceptor(composeEl, sendButton);
  }

  // ─── Attach Send Interceptor ───────────────────────────────
  function attachSendInterceptor(composeEl, sendButton) {
    if (sendButton.getAttribute("data-trackio-intercepted")) return;
    sendButton.setAttribute("data-trackio-intercepted", "true");

    log("✓ Send button intercepted, ready to track");

    sendButton.addEventListener(
      "click",
      async function (e) {
        // On re-click (after triggerOriginalSend), let it through
        if (composeEl.getAttribute("data-trackio-sending")) {
          log("Re-click detected, letting through to Gmail");
          return; // don't prevent — let Gmail handle it
        }

        composeEl.setAttribute("data-trackio-sending", "true");
        e.stopImmediatePropagation();
        e.preventDefault();

        log("Send intercepted — registering email...");

        try {
          const recipient = extractRecipient(composeEl);
          const subject = extractSubject(composeEl);

          log("Extracted → to:", recipient, "subj:", subject);

          if (!recipient) {
            log("No recipient found, sending without tracking");
            triggerOriginalSend(composeEl, sendButton);
            return;
          }

          const sender =
            senderEmail || extractSenderFromCompose(composeEl);
          log("Sender:", sender);

          const result = await sendMessage({
            type: "REGISTER_EMAIL",
            data: {
              recipient,
              subject: subject || "(No Subject)",
              senderEmail: sender || "unknown",
            },
          });

          log("REGISTER_EMAIL result:", JSON.stringify(result));

          if (result && result.success && result.id) {
            injectTrackingPixel(
              composeEl,
              result.trackingUrl || result.id
            );
            log("✓ Tracking pixel injected for:", recipient);
          } else {
            log("✗ Failed to register email:", result?.error);
          }
        } catch (error) {
          log("✗ Error during send interception:", error.message || error);
        }

        // Now trigger the actual Gmail send
        setTimeout(() => {
          triggerOriginalSend(composeEl, sendButton);
        }, 150);
      },
      true // capture phase — fires before Gmail's handler
    );
  }

  // ─── Extract Email Details ─────────────────────────────────
  function extractRecipient(composeEl) {
    // Method 1: Recipient chips
    const chips = composeEl.querySelectorAll(
      '[data-hovercard-id], .vR .vN, [email], .afV'
    );
    if (chips.length > 0) {
      for (const chip of chips) {
        const email =
          chip.getAttribute("data-hovercard-id") ||
          chip.getAttribute("email") ||
          chip.textContent?.trim();
        if (email && email.includes("@")) return email;
      }
      // If chips exist but no @ found, return first chip text
      return (
        chips[0].getAttribute("data-hovercard-id") ||
        chips[0].getAttribute("email") ||
        chips[0].textContent?.trim()
      );
    }

    // Method 2: To input field
    const toField =
      composeEl.querySelector('input[name="to"]') ||
      composeEl.querySelector('[aria-label="To recipients"]') ||
      composeEl.querySelector('[aria-label="To"]') ||
      composeEl.querySelector(".agP.aFw") ||
      composeEl.querySelector('input[type="text"][tabindex]');

    if (toField && (toField.value || toField.textContent?.trim())) {
      return toField.value || toField.textContent?.trim();
    }

    // Method 3: Reply — find the original sender
    const replyHeader = composeEl
      .closest(".h7, .Bs, .nH")
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

    // Thread subject (for replies)
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

    log("Pixel URL:", fullUrl);

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
  // CRITICAL: We re-click the Send button. Our interceptor sees
  // data-trackio-sending is already set → returns immediately
  // without preventDefault → the click reaches Gmail's handler.
  function triggerOriginalSend(composeEl, sendBtnRef) {
    log("Triggering original send...");

    // The sendBtnRef is the same button we intercepted.
    // data-trackio-sending is already set on composeEl,
    // so our capture listener will short-circuit and let the
    // click propagate to Gmail's real handler.
    const sendBtn =
      sendBtnRef ||
      findSendButtonIn(composeEl);

    if (sendBtn) {
      log("Clicking Send button to dispatch to Gmail");
      sendBtn.click();
    } else {
      // Absolute last resort: try Ctrl+Enter
      log("No Send button found, trying Ctrl+Enter fallback");
      const emailBody = composeEl.querySelector(
        '[contenteditable="true"][role="textbox"], .Am.Al.editable, [g_editable="true"]'
      );
      if (emailBody) {
        emailBody.focus();
        emailBody.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            ctrlKey: true,
            bubbles: true,
          })
        );
      }
    }
  }

  // ─── Sent Folder: Checkmark + Self-View Detection ──────────
  function observeSentFolder() {
    setInterval(checkSentFolder, SENT_FOLDER_CHECK_INTERVAL);

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(checkSentFolder, 1000);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    setInterval(checkViewingOwnThread, SENT_FOLDER_CHECK_INTERVAL);
  }

  function checkSentFolder() {
    const sentNavItem = document.querySelector('[data-tooltip="Sent"]');
    const isSent =
      location.hash.includes("#sent") ||
      location.hash.includes("#search/in%3Asent") ||
      (sentNavItem && sentNavItem.classList.contains("asa"));

    isInSentFolder = isSent;
    if (!isSent) return;

    const emailRows = document.querySelectorAll(
      "tr.zA:not([" + CHECKMARK_ATTR + "])"
    );

    emailRows.forEach(async (row) => {
      row.setAttribute(CHECKMARK_ATTR, "checking");

      const subjectEl = row.querySelector(".bog .bqe, .y2, .bqe");
      const subject = subjectEl?.textContent?.trim();

      if (!subject) {
        row.setAttribute(CHECKMARK_ATTR, "no-subject");
        return;
      }

      const trackingData = await getLocalTrackingData();
      const matchEntry = findTrackedEmailBySubject(trackingData, subject);

      if (matchEntry) {
        const [emailId, trackedEmail] = matchEntry;
        reportSelfViewIfNeeded(emailId, trackedEmail);
        addCheckmarkToRow(row, trackedEmail.opened);
        row.setAttribute(CHECKMARK_ATTR, "done");
      } else {
        row.setAttribute(CHECKMARK_ATTR, "not-tracked");
      }
    });
  }

  function checkViewingOwnThread() {
    if (isInSentFolder) return;
    if (!isViewingOwnEmail()) return;

    const subjectEl = document.querySelector(
      "h2[data-thread-perm-id], .hP"
    );
    const subject = subjectEl?.textContent?.trim();
    if (!subject) return;

    getLocalTrackingData().then((trackingData) => {
      const matchEntry = findTrackedEmailBySubject(trackingData, subject);
      if (matchEntry) {
        const [emailId, trackedEmail] = matchEntry;
        reportSelfViewIfNeeded(emailId, trackedEmail);
      }
    });
  }

  // ─── Self-View Reporting ───────────────────────────────────
  function reportSelfViewIfNeeded(emailId, trackedEmail) {
    if (!trackedEmail.senderToken) return;

    const lastReported = selfViewTimestamps[emailId] || 0;
    if (Date.now() - lastReported < SELF_VIEW_DEBOUNCE_MS) return;

    selfViewTimestamps[emailId] = Date.now();
    log("Reporting self-view for:", emailId);

    sendMessage({
      type: "REPORT_SELF_VIEW",
      data: { emailId, senderToken: trackedEmail.senderToken },
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
      if (label.getAttribute("email") === senderEmail) return true;
    }
    return false;
  }

  function findTrackedEmailBySubject(trackingData, subject) {
    const normalised = subject.toLowerCase();
    for (const [id, entry] of Object.entries(trackingData)) {
      if (entry.subject && entry.subject.toLowerCase() === normalised) {
        return [id, entry];
      }
    }
    return null;
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime?.id) {
          reject(new Error("Extension context invalidated"));
          return;
        }
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
