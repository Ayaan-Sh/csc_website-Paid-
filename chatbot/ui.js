/* ============================================================
   ui.js
   Everything that touches the DOM: building the widget shell,
   rendering messages, quick replies, the always-on text input,
   progress bar and escalation controls. Holds no conversation
   logic conversation.js decides *what* to say, this file only
   decides *how* it appears.
   ============================================================ */

const CSCUi = (() => {

  let els = {};
  let currentSubmit = null;

  /* ---------- A single, consistent icon family (inline line icons) ---------- */
  /* Every icon here shares the same stroke width / viewBox conventions
     so nothing in the header or action row mixes styles. */
  const ICONS = {
    chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.3M3 4v5h5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/></svg>`,
    submit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.1V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.1M22 2 11 13M16 21l3 3 5-5"/></svg>`
  };

  /* ---------- Build the widget shell once and cache references ---------- */

  function mount(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return null;

    root.innerHTML = `
      <button class="csc-bubble" id="cscBubble" aria-label="Open chat with Cyber Security Corporation" aria-expanded="false">
        <span class="csc-bubble-icon csc-bubble-icon-open">${ICONS.chat}</span>
        <span class="csc-bubble-icon csc-bubble-icon-close">${ICONS.close}</span>
        <span class="csc-bubble-badge" id="cscBubbleBadge">1</span>
      </button>

      <div class="csc-panel" id="cscPanel" role="dialog" aria-modal="true" aria-label="CSC Digital Case Officer" aria-hidden="true">
        <header class="csc-header">
          <div class="csc-header-info">
            <div class="csc-header-avatar">CS</div>
            <div>
              <p class="csc-header-title">CSC Digital Case Officer</p>
              <p class="csc-header-status"><span class="csc-status-dot"></span> Online usually replies instantly</p>
            </div>
          </div>
          <div class="csc-header-actions">
            <button class="csc-icon-btn" id="cscThemeToggle" aria-label="Toggle dark mode" title="Toggle dark mode">${ICONS.moon}</button>
            <button class="csc-icon-btn" id="cscResetBtn" aria-label="Start over" title="Start over">${ICONS.reset}</button>
            <button class="csc-icon-btn" id="cscCloseBtn" aria-label="Close chat" title="Close chat">${ICONS.close}</button>
          </div>
        </header>

        <div class="csc-progress-wrap" id="cscProgressWrap" hidden>
          <div class="csc-progress" id="cscProgress">
            <div class="csc-progress-fill" id="cscProgressFill"></div>
          </div>
          <span class="csc-progress-label" id="cscProgressLabel"></span>
        </div>

        <div class="csc-body" id="cscBody" aria-live="polite"></div>

        <div class="csc-quickreplies" id="cscQuickReplies"></div>

        <div class="csc-inputrow" id="cscInputRow">
          <input type="text" id="cscTextInput" class="csc-textinput" placeholder="Tell me what happened…" autocomplete="off" aria-label="Message" />
          <button type="button" class="csc-send-btn" id="cscSendBtn" aria-label="Send message">${ICONS.send}</button>
        </div>

        <p class="csc-disclaimer">This assistant collects case details only sit does not provide legal advice.</p>
      </div>
    `;

    els = {
      root,
      bubble: document.getElementById("cscBubble"),
      badge: document.getElementById("cscBubbleBadge"),
      panel: document.getElementById("cscPanel"),
      body: document.getElementById("cscBody"),
      quickReplies: document.getElementById("cscQuickReplies"),
      inputRow: document.getElementById("cscInputRow"),
      textInput: document.getElementById("cscTextInput"),
      sendBtn: document.getElementById("cscSendBtn"),
      themeToggle: document.getElementById("cscThemeToggle"),
      resetBtn: document.getElementById("cscResetBtn"),
      closeBtn: document.getElementById("cscCloseBtn"),
      progress: document.getElementById("cscProgress"),
      progressFill: document.getElementById("cscProgressFill"),
      progressWrap: document.getElementById("cscProgressWrap"),
      progressLabel: document.getElementById("cscProgressLabel")
    };

    // The text box is wired ONCE, here, and stays visible and active for
    // the whole conversation. conversation.js only ever changes *what
    // function runs* when the user submits (via showTextInput), never
    // whether the box itself is shown per the "always visible" rule.
    els.sendBtn.addEventListener("click", submitFromInput);
    els.textInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();   // never submit a page form, reload, or lose focus
      e.stopPropagation();
      submitFromInput();
    });
    els.textInput.addEventListener("input", () => {
      els.sendBtn.classList.toggle("csc-send-btn-active", els.textInput.value.trim().length > 0);
    });

    return els;
  }

  /* ---------- Open / close ---------- */

  function open() {
    els.panel.classList.add("open");
    els.panel.setAttribute("aria-hidden", "false");
    els.bubble.classList.add("open");
    els.bubble.setAttribute("aria-expanded", "true");
    els.badge.hidden = true;
    setTimeout(() => els.textInput.focus({ preventScroll: true }), 200);
  }

  function close() {
    els.panel.classList.remove("open");
    els.panel.setAttribute("aria-hidden", "true");
    els.bubble.classList.remove("open");
    els.bubble.setAttribute("aria-expanded", "false");
  }

  function isOpen() {
    return els.panel.classList.contains("open");
  }

  /* ---------- Messages ---------- */

  function timestamp() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const escapeHtml = CSCAnimations.escapeHtml;

  function addMessage(from, html) {
    const wrap = document.createElement("div");
    wrap.className = `csc-msg csc-msg-${from}`;
    wrap.innerHTML = from === "bot"
      ? `<div class="csc-avatar csc-avatar-bot" aria-hidden="true">CS</div>
         <div class="csc-msgbubble">${html}<span class="csc-time">${timestamp()}</span></div>`
      : `<div class="csc-msgbubble">${html}<span class="csc-time">${timestamp()}</span></div>
         <div class="csc-avatar csc-avatar-user" aria-hidden="true">You</div>`;

    els.body.appendChild(wrap);
    CSCAnimations.animateIn(wrap);
    CSCAnimations.scrollToBottom(els.body);
  }

  function addBotMessageWithTyping(text) {
    const typingEl = CSCAnimations.buildTypingIndicator();
    els.body.appendChild(typingEl);
    CSCAnimations.animateIn(typingEl);
    CSCAnimations.scrollToBottom(els.body);

    return CSCAnimations.wait(500 + Math.random() * 350).then(() => {
      typingEl.remove();
      addMessage("bot", text);
    });
  }

  /* User input is always free text, so it's always escaped before
     being dropped into the transcript. */
  function addUserMessage(text) {
    addMessage("user", escapeHtml(text));
  }

  function addHtmlBlock(html) {
    const wrap = document.createElement("div");
    wrap.className = "csc-msg csc-msg-bot csc-msg-block";
    wrap.innerHTML = `<div class="csc-avatar csc-avatar-bot" aria-hidden="true">CS</div><div class="csc-block">${html}</div>`;
    els.body.appendChild(wrap);
    CSCAnimations.animateIn(wrap);
    CSCAnimations.scrollToBottom(els.body);
  }

  function clearMessages() {
    els.body.innerHTML = "";
  }

  /* ---------- Quick replies (shown ALONGSIDE the text input, never instead of it) ---------- */

  function renderQuickReplies(options, onSelect) {
    els.quickReplies.innerHTML = "";
    if (!options || !options.length) return;

    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "csc-chip";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        clearQuickReplies();
        currentSubmit = null;
        onSelect(opt);
      });
      els.quickReplies.appendChild(btn);
    });
  }

  function clearQuickReplies() {
    els.quickReplies.innerHTML = "";
  }

  /* ---------- Free-text input (always visible; only the handler changes) ---------- */

  function showTextInput(onSubmit, placeholder) {
    els.textInput.value = "";
    els.textInput.disabled = false;
    els.textInput.placeholder = placeholder || "Type your message…";
    els.sendBtn.classList.remove("csc-send-btn-active");
    currentSubmit = onSubmit;
    els.textInput.focus({ preventScroll: true });
  }

  function submitFromInput() {
    const val = els.textInput.value.trim();
    if (!val || !currentSubmit) return;
    const fn = currentSubmit;
    currentSubmit = null;
    els.textInput.value = "";
    els.sendBtn.classList.remove("csc-send-btn-active");
    fn(val);
  }

  /* Used only while the summary/escalation screen is showing, so a
     stray Enter press doesn't resubmit anything. The box stays
     visible (per spec) it's just not wired to anything for a beat. */
  function disableInput(placeholder) {
    currentSubmit = null;
    if (placeholder) els.textInput.placeholder = placeholder;
  }

  /* ---------- Progress bar ---------- */

  function setProgress(current, total) {
    if (!total) {
      els.progressWrap.hidden = true;
      return;
    }
    els.progressWrap.hidden = false;
    const clampedCurrent = Math.min(current, total);
    const pct = Math.min(100, Math.round((clampedCurrent / total) * 100));
    els.progressFill.style.width = pct + "%";
    els.progressLabel.textContent = `Step ${Math.min(clampedCurrent + 1, total)} of ${total}`;
  }

  /* ---------- Theme ---------- */

  function setTheme(theme) {
    document.documentElement.setAttribute("data-csc-theme", theme);
    els.themeToggle.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
  }

  return {
    mount, open, close, isOpen,
    addBotMessageWithTyping, addUserMessage, addHtmlBlock, clearMessages,
    renderQuickReplies, clearQuickReplies,
    showTextInput, disableInput,
    setProgress, setTheme,
    icons: ICONS,
    get els() { return els; }
  };

})();