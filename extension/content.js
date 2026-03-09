// ─── Trackio Content Script ──────────────────────────────────
// Injected into Gmail to:
// 1. Detect compose windows and intercept Send clicks
// 2. Inject tracking pixels into email bodies
// 3. Show checkmark icons in Sent folder for opened emails
// 4. Prevent self-opens from being counted

(function () {
  "use strict";

  // ─── Constants ─────────────────────────────────────────────
  const TRACKIO_PREFIX = "[Trackio]";
  const COMPOSE_CHECK_INTERVAL = 500;
  const SENT_FOLDER_CHECK_INTERVAL = 5000;
  const PROCESSED_ATTR = "data-trackio-processed";
  const CHECKMARK_ATTR = "data-trackio-checkmark";

  // ─── State ─────────────────────────────────────────────────
  let settings = { apiBase: "http://localhost:3000", enabled: true };
  let senderEmail = null;
  let isInSentFolder = false;

  // ─── Initialize ────────────────────────────────────────────
  async function init() {
    log("Initializing...");

    // Load settings from background
    try {
      settings = await sendMessage({ type: "GET_SETTINGS" });
    } catch (e) {
      log("Failed to load settings, using defaults");
    }

    if (!settings.enabled) {
      log("Tracking is disabled");
      return;
    }

    // Wait for Gmail to fully load
    await waitForGmail();

    // Extract sender email
    senderEmail = extractSenderEmail();
    log("Sender email:", senderEmail);

    // Start observing for compose windows
    observeComposeWindows();

    // Start observing for Sent folder (checkmark feature)
    observeSentFolder();

    // Self-open prevention: Block tracking pixels in Sent folder view
    setupSelfOpenPrevention();

    log("Initialized successfully!");
  }

  // ─── Wait for Gmail ────────────────────────────────────────
  function waitForGmail() {
    return new Promise((resolve) => {
      const check = () => {
        // Gmail is loaded when the main content area exists
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
    // Method 1: From the account switcher / profile area
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

    // Method 2: From the Gmail data attribute
    const emailAttr = document.querySelector("[data-email]");
    if (emailAttr) return emailAttr.getAttribute("data-email");

    // Method 3: From page title or URL
    const titleMatch = document.title.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    if (titleMatch) return titleMatch[1];

    // Method 4: From the "From" dropdown in compose (extracted later)
    return null;
  }

  // ─── Observe Compose Windows ───────────────────────────────
  function observeComposeWindows() {
    // Use MutationObserver to detect new compose windows
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Gmail compose windows have class 'M9' or contain compose elements
          const composeWindows = [];

          if (node.classList && node.classList.contains("M9")) {
            composeWindows.push(node);
          }

          if (node.querySelectorAll) {
            composeWindows.push(...node.querySelectorAll(".M9"));
          }

          // Also check for inline compose (reply)
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

    // Also check for already-open compose windows
    document.querySelectorAll(".M9, .ip.iq").forEach(processComposeWindow);

    log("Compose window observer started");
  }

  // ─── Process a Compose Window ──────────────────────────────
  function processComposeWindow(composeEl) {
    if (!composeEl || composeEl.getAttribute(PROCESSED_ATTR)) return;
    composeEl.setAttribute(PROCESSED_ATTR, "true");

    log("New compose window detected");

    // Add a visual indicator that Trackio is active
    addTrackingIndicator(composeEl);

    // Find and intercept the Send button
    interceptSendButton(composeEl);
  }

  // ─── Add Tracking Indicator ────────────────────────────────
  function addTrackingIndicator(composeEl) {
    // Find the toolbar/action area of the compose window
    const toolbar = composeEl.querySelector(".btC") || composeEl.querySelector(".IZ");
    if (!toolbar) return;

    // Check if indicator already exists
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
    // Gmail Send button selectors (may vary)
    const findSendButton = () => {
      // Primary send button
      return (
        composeEl.querySelector('[data-tooltip*="Send"]') ||
        composeEl.querySelector('[aria-label*="Send"]') ||
        composeEl.querySelector(".T-I.J-J5-Ji.aoO") ||
        composeEl.querySelector('div[role="button"].T-I.J-J5-Ji')
      );
    };

    let sendButton = findSendButton();

    if (!sendButton) {
      // Retry a few times if button isn't ready
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

    // Capture the click event before Gmail processes it
    sendButton.addEventListener(
      "click",
      async function (e) {
        // Only intercept once per send
        if (composeEl.getAttribute("data-trackio-sending")) return;
        composeEl.setAttribute("data-trackio-sending", "true");

        // Prevent the default send temporarily
        e.stopImmediatePropagation();
        e.preventDefault();

        log("Send intercepted, injecting tracking pixel...");

        try {
          // Extract email details
          const recipient = extractRecipient(composeEl);
          const subject = extractSubject(composeEl);

          if (!recipient) {
            log("No recipient found, sending without tracking");
            triggerOriginalSend(composeEl);
            return;
          }

          // Get sender email if not already extracted
          const sender = senderEmail || extractSenderFromCompose(composeEl);

          // Register the email with the API
          const result = await sendMessage({
            type: "REGISTER_EMAIL",
            data: {
              recipient,
              subject: subject || "(No Subject)",
              senderEmail: sender || "unknown",
            },
          });

          if (result && result.success && result.id) {
            // Inject the tracking pixel
            injectTrackingPixel(composeEl, result.trackingUrl || result.id);
            log("Tracking pixel injected for:", recipient);
          } else {
            log("Failed to register email:", result?.error);
          }
        } catch (error) {
          log("Error during send interception:", error);
        }

        // Small delay to ensure pixel is in DOM, then trigger original send
        setTimeout(() => {
          triggerOriginalSend(composeEl);
        }, 100);
      },
      true // Use capture phase to run before Gmail's handler
    );
  }

  // ─── Extract Email Details ─────────────────────────────────
  function extractRecipient(composeEl) {
    // Try to get recipient from the "To" field
    const toField =
      composeEl.querySelector('input[name="to"]') ||
      composeEl.querySelector('[aria-label="To recipients"]') ||
      composeEl.querySelector(".agP.aFw");

    if (toField) {
      // Check for email chips (pills)
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

    // For reply compose, try to get from the thread
    const replyHeader = composeEl
      .closest(".h7")
      ?.querySelector('[email]');
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

    // For reply, get subject from thread
    const threadSubject = document.querySelector(
      'h2[data-thread-perm-id], .hP'
    );
    if (threadSubject) {
      return threadSubject.textContent?.trim();
    }

    return "";
  }

  function extractSenderFromCompose(composeEl) {
    // Check the "From" dropdown in compose
    const fromField = composeEl.querySelector('[name="from"]');
    if (fromField) return fromField.value;

    return senderEmail;
  }

  // ─── Inject Tracking Pixel ─────────────────────────────────
  function injectTrackingPixel(composeEl, trackingUrl) {
    // Find the email body (contenteditable div)
    const emailBody = composeEl.querySelector(
      '[contenteditable="true"][role="textbox"], .Am.Al.editable, [g_editable="true"]'
    );

    if (!emailBody) {
      log("Could not find email body to inject pixel");
      return;
    }

    // Build the full tracking URL if only ID was provided
    const fullUrl = trackingUrl.startsWith("http")
      ? trackingUrl
      : `${settings.apiBase}/api/track/${trackingUrl}`;

    // Create the tracking pixel image
    const pixel = document.createElement("img");
    pixel.src = fullUrl;
    pixel.width = 1;
    pixel.height = 1;
    pixel.style.cssText =
      "display:none!important;width:1px!important;height:1px!important;opacity:0!important;position:absolute!important;";
    pixel.alt = "";
    pixel.setAttribute("data-trackio-pixel", "true");

    // Append to the end of the email body
    emailBody.appendChild(pixel);
  }

  // ─── Trigger Original Send ─────────────────────────────────
  function triggerOriginalSend(composeEl) {
    // Use keyboard shortcut to send (Ctrl+Enter or Cmd+Enter)
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
      // Fallback: Try clicking the send button directly
      const sendBtn =
        composeEl.querySelector('[data-tooltip*="Send"]') ||
        composeEl.querySelector('[aria-label*="Send"]') ||
        composeEl.querySelector(".T-I.J-J5-Ji.aoO");

      if (sendBtn) {
        // Remove our interceptor temporarily
        composeEl.removeAttribute("data-trackio-sending");
        composeEl.removeAttribute(PROCESSED_ATTR);
        sendBtn.removeAttribute("data-trackio-intercepted");
        sendBtn.click();
      }
    }
  }

  // ─── Sent Folder: Checkmark Feature ────────────────────────
  function observeSentFolder() {
    // Periodically check if we're in the Sent folder and add checkmarks
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
      'tr.zA:not([' + CHECKMARK_ATTR + "])"
    );

    emailRows.forEach(async (row) => {
      row.setAttribute(CHECKMARK_ATTR, "checking");

      // Get email subject from the row
      const subjectEl = row.querySelector(".bog .bqe, .y2");
      const subject = subjectEl?.textContent?.trim();

      if (!subject) {
        row.setAttribute(CHECKMARK_ATTR, "no-subject");
        return;
      }

      // Check local storage for tracking data
      const trackingData = await getLocalTrackingData();
      const trackedEmail = Object.values(trackingData).find(
        (e) => e.subject === subject
      );

      if (trackedEmail) {
        // Add checkmark indicator
        addCheckmarkToRow(row, trackedEmail.opened);
        row.setAttribute(CHECKMARK_ATTR, "done");
      } else {
        row.setAttribute(CHECKMARK_ATTR, "not-tracked");
      }
    });
  }

  function addCheckmarkToRow(row, isOpened) {
    // Find a good place to add the checkmark
    const dateCell = row.querySelector(".xW.xY, .bq4");
    if (!dateCell) return;

    // Check if checkmark already exists
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

  // ─── Self-Open Prevention ──────────────────────────────────
  function setupSelfOpenPrevention() {
    // Block tracking pixel images from loading when viewing own sent emails
    // This prevents the sender's own views from being counted

    const observer = new MutationObserver((mutations) => {
      if (!isInSentFolder && !isViewingOwnEmail()) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Find and block tracking pixel images
          const images = node.querySelectorAll
            ? [
                ...node.querySelectorAll('img[data-trackio-pixel]'),
                ...node.querySelectorAll(
                  `img[src*="${settings.apiBase}/api/track/"]`
                ),
              ]
            : [];

          if (
            node.tagName === "IMG" &&
            (node.getAttribute("data-trackio-pixel") ||
              node.src?.includes(`${settings.apiBase}/api/track/`))
          ) {
            images.push(node);
          }

          images.forEach((img) => {
            // Remove the src to prevent loading
            img.removeAttribute("src");
            img.style.display = "none";
            log("Blocked self-open tracking pixel");
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function isViewingOwnEmail() {
    // Check if we're viewing a thread that we sent
    const fromLabels = document.querySelectorAll(".gD[email]");
    for (const label of fromLabels) {
      if (label.getAttribute("email") === senderEmail) {
        return true;
      }
    }
    return false;
  }

  // ─── Helpers ───────────────────────────────────────────────
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
  // Wait for the page to be ready, then initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Small delay to ensure Gmail has started its initialization
    setTimeout(init, 1500);
  }
})();
