/* ============================================================
   aiLayer.js
   CSCAi — turns a person's own free-typed words into one of the
   incident types defined in flows.js, and supplies a short
   empathetic opening line once a flow begins.

   Purely rule-based (keyword matching) right now, no network
   calls, no API key. conversation.js only ever talks to this
   file through classifyIntent() and empathyOpener(), so this is
   the one file you'd swap out later for a live AI call (e.g.
   Groq) — UI, storage, and flows would stay exactly as they are.
   ============================================================ */

const CSCAi = (() => {

  /* Ordered from most specific to least specific — first match
     with the highest keyword score wins. */
  const INTENT_KEYWORDS = [
    { incidentType: "QR Code Scam", keywords: ["qr code", "scanned a qr", "scan qr", "qr scam"] },
    { incidentType: "UPI Fraud", keywords: ["upi", "phonepe", "google pay", "gpay", "paytm", "upi id", "sent money by mistake"] },
    { incidentType: "Credit Card Fraud", keywords: ["credit card", "debit card", "card swiped", "card cloned", "card skimmed"] },
    { incidentType: "Cryptocurrency Scam", keywords: ["crypto", "bitcoin", "binance", "usdt", "trading app scam", "investment scheme"] },
    { incidentType: "Online Shopping Fraud", keywords: ["online shopping", "fake website", "ordered online", "seller scam", "flipkart", "amazon", "never delivered"] },
    { incidentType: "Bank Fraud", keywords: ["bank account", "otp", "debited", "unauthorized transaction", "netbanking", "bank fraud", "money deducted"] },

    { incidentType: "Instagram Hacked", keywords: ["instagram", "insta account", "insta got hacked"] },
    { incidentType: "Facebook Hacked", keywords: ["facebook", "fb account", "fb got hacked"] },
    { incidentType: "WhatsApp Hacked", keywords: ["whatsapp"] },
    { incidentType: "Email Hacked", keywords: ["email hacked", "gmail hacked", "outlook hacked", "my email"] },

    { incidentType: "Ransomware", keywords: ["ransomware", "encrypted my files", "files encrypted", "ransom note", "locked files"] },
    { incidentType: "Malware", keywords: ["malware", "virus", "trojan", "infected"] },
    { incidentType: "Data Breach", keywords: ["data breach", "leaked data", "database leaked", "customer data leaked", "data leak"] },
    { incidentType: "Business Email Compromise", keywords: ["invoice fraud", "ceo fraud", "business email", "vendor email", "fake invoice"] },
    { incidentType: "Corporate Security Incident", keywords: ["company hacked", "our systems", "network breach", "office systems", "our servers"] },

    { incidentType: "Sextortion", keywords: ["sextortion", "blackmail", "nude", "obscene photo", "morphed photo", "threatening to leak"] },
    { incidentType: "Cyber Bullying", keywords: ["bullying", "harassment", "trolling", "abusive messages", "being harassed"] },
    { incidentType: "Identity Theft", keywords: ["identity theft", "aadhaar misuse", "pan misuse", "fake id made", "someone used my identity", "impersonating me"] },
    { incidentType: "Phishing", keywords: ["phishing", "fake link", "clicked a link", "suspicious link"] },

    { incidentType: "Training Enquiry", keywords: ["training", "workshop", "certification course", "conduct a session"] },
    { incidentType: "Cyber Law Consultation", keywords: ["legal advice", "legal consultation", "lawyer", "cyber law", "legal notice"] },
    { incidentType: "VAPT", keywords: ["vapt", "penetration test", "pentest", "vulnerability assessment", "security audit"] },
    { incidentType: "General Consultation", keywords: ["consultation", "need advice", "need guidance", "want to consult"] }
  ];

  const EMPATHY_OPENERS = [
    "I'm really sorry this happened to you.",
    "That sounds stressful thank you for telling me.",
    "I understand this is worrying. Let's get this sorted.",
    "Thanks for sharing that it takes courage to reach out.",
    "That's a lot to deal with. I'm here to help you through it."
  ];

  const NEGATION_WORDS = ["not", "no", "never", "n't", "didn't", "wasn't", "isn't", "haven't"];

  /* True if a negation word appears in the ~4 words immediately before
     the keyword match, e.g. "I did NOT lose money" shouldn't score
     toward a financial-fraud flow. Cheap heuristic, not real NLP. */
  function isNegated(text, matchIndex) {
    const windowStart = Math.max(0, matchIndex - 30);
    const before = text.slice(windowStart, matchIndex).trim().split(/\s+/).slice(-4);
    return before.some(word => NEGATION_WORDS.some(neg => word.includes(neg)));
  }

  /* Score every intent by its matching keywords, weighting more specific
     (multi-word) phrases higher than generic single-word ones, and
     skipping matches that are directly negated. Returns the best match
     (or null if nothing scores). */
  function classifyIntent(rawText) {
    const text = String(rawText || "").toLowerCase();

    let best = null;
    let bestScore = 0;

    INTENT_KEYWORDS.forEach(entry => {
      const score = entry.keywords.reduce((total, kw) => {
        const idx = text.indexOf(kw);
        if (idx === -1 || isNegated(text, idx)) return total;
        // Multi-word phrases ("qr code") are more specific than single
        // words ("whatsapp"), so they should outweigh them on ties.
        const specificity = kw.trim().split(/\s+/).length;
        return total + specificity;
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        best = entry.incidentType;
      }
    });

    return { incidentType: bestScore > 0 ? best : null };
  }

  function empathyOpener() {
    return EMPATHY_OPENERS[Math.floor(Math.random() * EMPATHY_OPENERS.length)];
  }

  return { classifyIntent, empathyOpener };

})();