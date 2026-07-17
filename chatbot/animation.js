/* ============================================================
   animation.js
   Small, dependency-free animation + DOM helpers shared by ui.js.
   ============================================================ */

const CSCAnimations = (() => {

  /* Fade + slide a freshly-added message bubble into place */
  function animateIn(el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    requestAnimationFrame(() => {
      el.style.transition = "opacity .28s ease, transform .28s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }

  /* Smoothly scroll a container to its bottom */
  function scrollToBottom(container) {
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
  }

  /* Build a "typing…" indicator bubble (three animated dots) */
  function buildTypingIndicator() {
    const wrap = document.createElement("div");
    wrap.className = "csc-msg csc-msg-bot csc-typing";
    wrap.innerHTML = `
      <div class="csc-avatar csc-avatar-bot" aria-hidden="true">CS</div>
      <div class="csc-msgbubble csc-typing-bubble">
        <span class="csc-dot"></span><span class="csc-dot"></span><span class="csc-dot"></span>
      </div>
    `;
    return wrap;
  }

  /* Resolve after `ms` used to simulate a brief thinking pause */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* Single source of truth for HTML-escaping user-typed text before it
     goes into innerHTML anywhere (transcript bubbles, summary card,
     contact recap). Previously copy-pasted in three files. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return { animateIn, scrollToBottom, buildTypingIndicator, wait, escapeHtml };

})();