/* ============================================================
   conversation.js
   The rule engine. Drives the conversation state machine using
   CSCAi for intent detection and empathetic phrasing, CSCFlows
   for question content, CSCUi for rendering, and CSCStorage for
   persistence.

   This is the file you'd touch to swap the rule-based CSCAi
   layer for a live Groq-powered assistant later — UI, storage,
   and flow data stay exactly as they are.
   ============================================================ */

const CSCConversation = (() => {

  const CONFIG = {
    phoneDisplay: "+91 7709 619 249",
    phoneHref: "tel:+917709619249",
    whatsappHref: "https://wa.me/917709619249",
    email: "support@cybersolution.in",
    contactFormUrl: "index.html#contact",
    caseFormUrl: "services.html#case-inquiry",
    web3formsEndpoint: "https://api.web3forms.com/submit",
    web3formsAccessKey: "9fc78025-01ab-4d17-b46f-b85331e09973"
  };

  const MAX_CLARIFY_ATTEMPTS = 2;

  /* Asked one at a time, right before a case is actually submitted,
     so the team has a way to reach the person back. */
  const CONTACT_FIELDS = [
    { key: "name", prompt: "Before I send this to our team, what's your full name?", placeholder: "Your full name…" },
    { key: "phone", prompt: "What's the best phone number to reach you on?", placeholder: "Phone number…" },
    { key: "email", prompt: "And your email address?", placeholder: "Email address…" }
  ];

  function validateContactField(key, value) {
    const trimmed = String(value || "").trim();
    if (key === "email") return /\S+@\S+\.\S+/.test(trimmed);
    if (key === "phone") return trimmed.replace(/\D/g, "").length >= 7;
    return trimmed.length > 1;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  let session = null;

  /* ---------- Boot ---------- */

  function init() {
    const mounted = CSCUi.mount("cscChatWidgetRoot");
    if (!mounted) return;

    const savedTheme = CSCStorage.getTheme() ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    CSCUi.setTheme(savedTheme);

    mounted.themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-csc-theme") === "dark" ? "light" : "dark";
      CSCUi.setTheme(next);
      CSCStorage.saveTheme(next);
    });

    mounted.bubble.addEventListener("click", () => {
      CSCUi.isOpen() ? CSCUi.close() : CSCUi.open();
    });
    mounted.closeBtn.addEventListener("click", CSCUi.close);
    mounted.resetBtn.addEventListener("click", () => {
      if (confirm("Start a new conversation? This clears the current one.")) restart();
    });

    session = CSCStorage.getSession() || CSCStorage.createEmptySession();

    if (session.messages.length) {
      replayTranscript();
    } else {
      greet();
    }
  }

  function persist() {
    CSCStorage.saveSession(session);
  }

  function restart() {
    CSCStorage.clearSession();
    session = CSCStorage.createEmptySession();
    CSCUi.clearMessages();
    CSCUi.setProgress(0, 0);
    greet();
  }

  /* ---------- Replay a saved transcript on reopen ---------- */

  function replayTranscript() {
    session.messages.forEach(m => {
      if (m.from === "bot") CSCUi.addHtmlBlock(m.text);
      else CSCUi.addUserMessage(m.text);
    });
    if (session.stage === "contactInfo") {
      resumeCurrentStep();
    } else if (session.completed) {
      CSCUi.setProgress(0, 0);
      showEscalation(session.lastSummary || null);
    } else {
      resumeCurrentStep();
    }
  }

  function record(from, text, extra) {
    session.messages.push(Object.assign({ from, text, timestamp: Date.now() }, extra || {}));
    persist();
  }

  function say(text) {
    record("bot", text);
    return CSCUi.addBotMessageWithTyping(text);
  }

  /* ---------- Opening screen: just a greeting, then the box is ready ---------- */

  function greet() {
    session.stage = "listening";
    persist();

    say("Hi 👋 I'm the CSC Digital Case Officer.")
      .then(() => say("Tell me what happened in your own words, or just pick what's closest below."))
      .then(() => renderCategoryOptions());
  }

  function resumeCurrentStep() {
    if (session.stage === "flow") {
      renderStepControls();
    } else if (session.stage === "categoryFallback" || session.stage === "listening") {
      renderCategoryOptions();
    } else if (session.stage === "contactInfo") {
      resumeContactCollection();
    } else {
      // 'clarifying' — the box is simply ready for more.
      CSCUi.showTextInput(handleFreeformMessage, "Tell me what happened…");
    }
  }

  /* ---------- Turning the user's own words into a flow (no category menu) ---------- */

  function handleFreeformMessage(text) {
    CSCUi.addUserMessage(text);
    record("user", text);

    const result = CSCAi.classifyIntent(text);

    if (result.incidentType) {
      session.clarifyAttempts = 0;
      beginFlow(result.incidentType);
      return;
    }

    session.clarifyAttempts = (session.clarifyAttempts || 0) + 1;
    persist();

    if (session.clarifyAttempts >= MAX_CLARIFY_ATTEMPTS) {
      offerCategoryFallback();
      return;
    }

    session.stage = "clarifying";
    persist();
    say("I'm sorry this happened.")
      .then(() => say("Could you tell me a little more about what happened?"))
      .then(() => CSCUi.showTextInput(handleFreeformMessage, "Type here…"));
  }

  /* Last resort only — used if free text genuinely isn't giving us
     enough to route the case after a couple of tries. */
  function offerCategoryFallback() {
    session.stage = "categoryFallback";
    persist();
    say("No problem, let's narrow this down together.")
      .then(() => say("Which of these is closest to what you're dealing with?"))
      .then(renderCategoryOptions);
  }

  /* Shared by the opening screen AND the fallback path — quick-select
     chips are always shown alongside the live text box, never instead
     of it, so the person can tap a category or just keep typing. */
  function renderCategoryOptions() {
    const options = CSCFlows.CATEGORIES.map(c => c.label);
    CSCUi.renderQuickReplies(options, (choice) => {
      CSCUi.addUserMessage(choice);
      record("user", choice);
      const category = CSCFlows.CATEGORIES.find(c => c.label === choice);
      session.clarifyAttempts = 0;
      beginFlow(category.defaultIncident);
    });
    CSCUi.showTextInput(handleFreeformMessage, "Or type here…");
  }

  /* ---------- Running a flow ---------- */

  function beginFlow(incidentType) {
    session.stage = "flow";
    session.flowKey = incidentType;
    session.stepIndex = 0;
    session.caseData = {};
    persist();

    say(CSCAi.empathyOpener())
      .then(() => say("I'll ask a few quick questions, one at a time, so this reaches the right person."))
      .then(() => askStep());
  }

  function askStep() {
    const steps = CSCFlows.getFlow(session.flowKey);
    const step = steps[session.stepIndex];

    if (!step) {
      finishFlow();
      return;
    }

    CSCUi.setProgress(session.stepIndex, steps.length);
    say(step.bot).then(() => renderStepControls());
  }

  function renderStepControls() {
    const steps = CSCFlows.getFlow(session.flowKey);
    const step = steps[session.stepIndex];
    if (!step) return;

    if (step.type === "quick-reply") {
      CSCUi.renderQuickReplies(step.options, (choice) => handleAnswer(step, choice));
    } else if (step.optional) {
      CSCUi.renderQuickReplies(["Skip this"], () => handleAnswer(step, "—"));
    } else {
      CSCUi.clearQuickReplies();
    }

    // The text box stays visible and live for every step — the person
    // can always type their own answer instead of tapping a chip.
    CSCUi.showTextInput(
      (value) => handleAnswer(step, value),
      step.type === "quick-reply" ? "Or type your own answer…" : "Type your answer…"
    );
  }

  function handleAnswer(step, value) {
    CSCUi.clearQuickReplies();
    CSCUi.addUserMessage(value);
    record("user", value);
    session.caseData[step.field] = value;
    session.stepIndex += 1;
    persist();

    const ackText = typeof step.ack === "function" ? step.ack(value) : null;
    if (ackText) {
      say(ackText).then(() => askStep());
    } else {
      askStep();
    }
  }

  /* ---------- Wrap-up ---------- */

  function finishFlow() {
    session.stage = "summary";
    session.completed = true;
    CSCUi.setProgress(0, 0);
    persist();

    const summary = CSCSummary.buildSummary(session.flowKey, session.caseData);
    session.lastSummary = summary;
    persist();

    say("Thank you, you've given me everything I need. Here's a summary of what I've recorded:")
      .then(() => {
        const html = CSCSummary.renderSummaryCard(summary);
        CSCUi.addHtmlBlock(html);
        record("bot", html, { isSummary: true });
      })
      .then(() => say("You're doing the right thing by seeking help. How would you like to proceed?"))
      .then(() => showEscalation(summary));
  }

  function showEscalation(summary) {
    const options = ["WhatsApp an expert", "Call now", "Book a consultation", "Submit this case"];

    CSCUi.renderQuickReplies(options, (choice) => {
      CSCUi.addUserMessage(choice);
      record("user", choice);
      CSCUi.clearQuickReplies();

      if (choice.includes("WhatsApp")) {
        window.open(CONFIG.whatsappHref, "_blank", "noopener");
        say("Opening WhatsApp, our team will pick up the conversation from there.")
          .then(() => CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…"));
      } else if (choice.includes("Call")) {
        say(`You can reach our expert team directly at <a href="${CONFIG.phoneHref}" class="csc-inline-link">${CONFIG.phoneDisplay}</a>. Tap the number to call, or note it down.`)
          .then(() => CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…"));
      } else if (choice.includes("Book")) {
        say(`You can book a consultation here: ${CONFIG.contactFormUrl}`).then(() => {
          window.location.href = CONFIG.contactFormUrl;
        });
      } else if (choice.includes("Submit")) {
        beginContactCollection();
      } else {
        CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…");
      }
    });

    // Even after the flow completes, free text still works — e.g. the
    // person wants to describe a second, separate incident.
    CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…");
  }

  /* ---------- Contact details (asked once, right before submitting) ---------- */

  function beginContactCollection() {
    if (!session.lastSummary) {
      say("There's no case summary to submit yet, let's go through a few questions first.").then(() =>
        CSCUi.showTextInput(handleFreeformMessage, "Tell me what happened…")
      );
      return;
    }

    session.stage = "contactInfo";
    session.contactInfo = session.contactInfo || {};
    persist();

    say("So our team can reach you about this, I just need a few details first.")
      .then(resumeContactCollection);
  }

  function resumeContactCollection() {
    session.contactInfo = session.contactInfo || {};
    const nextField = CONTACT_FIELDS.find(f => !session.contactInfo[f.key]);

    if (!nextField) {
      finalizeSubmission();
      return;
    }

    say(nextField.prompt).then(() => {
      CSCUi.showTextInput((value) => handleContactAnswer(nextField, value), nextField.placeholder);
    });
  }

  function handleContactAnswer(field, value) {
    CSCUi.addUserMessage(value);
    record("user", value);

    if (!validateContactField(field.key, value)) {
      const retryMsg = field.key === "email"
        ? "That doesn't look like a valid email — mind double-checking it?"
        : field.key === "phone"
        ? "That doesn't look like a complete phone number — mind double-checking it?"
        : "I didn't quite catch that could you type it again?";
      say(retryMsg).then(() => {
        CSCUi.showTextInput((v) => handleContactAnswer(field, v), field.placeholder);
      });
      return;
    }

    session.contactInfo[field.key] = String(value).trim();
    persist();
    resumeContactCollection();
  }

  function finalizeSubmission() {
    const info = session.contactInfo || {};
    const recap = `
      <div class="csc-summary-card">
        <h4>Your Details</h4>
        <div class="csc-summary-row"><span>Name</span><strong>${escapeHtml(info.name)}</strong></div>
        <div class="csc-summary-row"><span>Phone</span><strong>${escapeHtml(info.phone)}</strong></div>
        <div class="csc-summary-row"><span>Email</span><strong>${escapeHtml(info.email)}</strong></div>
      </div>
    `;
    CSCUi.addHtmlBlock(recap);
    record("bot", recap, { isContactRecap: true });

    say("Thanks that's everything I need.").then(() => {
      submitCase(session.lastSummary, info);
    });
  }

  /* ---------- Sending the case to the team ---------- */

  async function submitCase(summary, contactInfo) {
    if (!summary) {
      say("There's no case summary to submit yet, let's go through a few questions first.").then(() =>
        CSCUi.showTextInput(handleFreeformMessage, "Tell me what happened…")
      );
      return;
    }
    const info = contactInfo || {};
    say("Sending your case to our team now…");

    try {
      const body = new FormData();
      body.append("access_key", CONFIG.web3formsAccessKey);
      body.append("subject", `New case intake: ${summary.incidentType}`);
      body.append("from_name", info.name || "CSC Website Intake Assistant");
      body.append("name", info.name || "Not provided");
      body.append("email", info.email || "Not provided");
      body.append("phone", info.phone || "Not provided");
      body.append("message", CSCSummary.renderSummaryText(summary, info));

      const response = await fetch(CONFIG.web3formsEndpoint, { method: "POST", body });
      const result = await response.json();

      session.stage = "summary";
      persist();

      if (result.success) {
        say(`✅ Your case has been submitted. Our team will follow up at ${info.phone || "the number you gave"} within one business day sooner if it's urgent.`)
          .then(() => CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…"));
      } else {
        say("I couldn't submit that automatically. Please use the case form or call us directly so nothing is lost.")
          .then(() => CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…"));
      }
    } catch (err) {
      say("❌ Something went wrong sending that. Please call us directly, or use the case form on the Services page.")
        .then(() => CSCUi.showTextInput(handleFreeformMessage, "Or ask me anything else…"));
    }
  }

  return { init, restart };

})();