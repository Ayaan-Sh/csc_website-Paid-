/* ============================================================
   summary.js
   Turns collected caseData into a structured, human-readable
   case summary, and works out urgency / priority / the service
   CSC should route the person to.
   ============================================================ */

const CSCSummary = (() => {

  const VICTIM_INCIDENTS = new Set([
    "UPI Fraud", "QR Code Scam", "Bank Fraud", "Credit Card Fraud",
    "Cryptocurrency Scam", "Online Shopping Fraud", "Instagram Hacked",
    "Facebook Hacked", "WhatsApp Hacked", "Email Hacked", "Ransomware",
    "Malware", "Data Breach", "Business Email Compromise",
    "Corporate Security Incident", "Identity Theft", "Cyber Bullying",
    "Sextortion", "Phishing"
  ]);

  const SERVICE_MAP = {
    "UPI Fraud": "Cyber Crime Investigation", "QR Code Scam": "Cyber Crime Investigation",
    "Bank Fraud": "Cyber Crime Investigation", "Credit Card Fraud": "Cyber Crime Investigation",
    "Cryptocurrency Scam": "Cyber Crime Investigation", "Online Shopping Fraud": "Cyber Crime Investigation",
    "Instagram Hacked": "Cyber Forensics", "Facebook Hacked": "Cyber Forensics",
    "WhatsApp Hacked": "Cyber Forensics", "Email Hacked": "Cyber Forensics",
    "Ransomware": "Cyber Forensics", "Malware": "Cyber Forensics",
    "Data Breach": "Cyber Forensics", "Business Email Compromise": "Cyber Crime Investigation",
    "Corporate Security Incident": "VAPT", "Identity Theft": "Cyber Crime Investigation",
    "Cyber Bullying": "Legal Drafting", "Sextortion": "Cyber Crime Investigation",
    "Phishing": "Cyber Crime Investigation", "Training Enquiry": "Cyber Training",
    "Cyber Law Consultation": "Cyber Law", "VAPT": "VAPT", "General Consultation": "Consulting"
  };

  /* Work out urgency from what was collected used for both the
     summary card and to decide whether to push the person toward
     calling immediately. */
  function computeUrgency(incidentType, caseData) {
    const recent = caseData.timeline === "Within the last 24 hours";
    const ongoing = caseData.stillOngoing === "Still happening / ongoing";
    const highRisk = ["Ransomware", "Sextortion", "Business Email Compromise", "Data Breach"].includes(incidentType);
    const bigLoss = caseData.amountLost === "Over ₹1,00,000";

    if (recent || ongoing || (highRisk && (recent || ongoing))) return "High";
    if (bigLoss || highRisk) return "Medium-High";
    return "Standard";
  }

  function computePriority(urgency) {
    if (urgency === "High") return "P1 respond immediately";
    if (urgency === "Medium-High") return "P2 respond same business day";
    return "P3 standard queue";
  }

  function nextSteps(urgency, isVictim) {
    if (!isVictim) {
      return "Our team will reach out to schedule a call and scope the requirement.";
    }
    if (urgency === "High") {
      return "Call the helpline directly evidence should be preserved and action taken without delay.";
    }
    return "A CSC investigator will review the case details and follow up within one business day.";
  }

  /* Build the full structured summary object */
  function buildSummary(incidentType, caseData) {
    const isVictim = VICTIM_INCIDENTS.has(incidentType);
    const urgency = isVictim ? computeUrgency(incidentType, caseData) : "Standard";
    const priority = computePriority(urgency);

    return {
      incidentType,
      amountLost: caseData.amountLost || "Not applicable",
      timeline: caseData.timeline || "Not specified",
      urgency,
      evidenceAvailable: caseData.evidenceAvailable || "Not specified",
      reportedToAuthorities: caseData.reportedToAuthorities || "Not specified",
      recommendedService: SERVICE_MAP[incidentType] || "General Consultation",
      priority,
      nextSteps: nextSteps(urgency, isVictim),
      raw: caseData
    };
  }

  /* Render the summary as a compact HTML card for the chat transcript */
  function renderSummaryCard(summary) {
    const rows = [
      ["Incident Type", summary.incidentType],
      ["Amount Lost", summary.amountLost],
      ["Timeline", summary.timeline],
      ["Urgency", summary.urgency],
      ["Evidence Available", summary.evidenceAvailable],
      ["Reported to Authorities", summary.reportedToAuthorities],
      ["Recommended Service", summary.recommendedService],
      ["Priority", summary.priority]
    ];

    const rowsHtml = rows.map(([label, value]) =>
      `<div class="csc-summary-row"><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`
    ).join("");

    return `
      <div class="csc-summary-card">
        <h4>Case Summary</h4>
        ${rowsHtml}
        <p class="csc-summary-next"><strong>Next step:</strong> ${escapeHtml(summary.nextSteps)}</p>
      </div>
    `;
  }

  /* Plain-text version used as the message body submitted to Web3Forms.
     contactInfo is optional (name/phone/email collected right before
     submission) so this still works if it's ever called without it. */
  function renderSummaryText(summary, contactInfo) {
    const info = contactInfo || {};
    return [
      `Name: ${info.name || "—"}`,
      `Phone: ${info.phone || "—"}`,
      `Email: ${info.email || "—"}`,
      "",
      `Incident Type: ${summary.incidentType}`,
      `Amount Lost: ${summary.amountLost}`,
      `Timeline: ${summary.timeline}`,
      `Urgency: ${summary.urgency}`,
      `Evidence Available: ${summary.evidenceAvailable}`,
      `Reported to Authorities: ${summary.reportedToAuthorities}`,
      `Recommended Service: ${summary.recommendedService}`,
      `Priority: ${summary.priority}`,
      `Additional Details: ${summary.raw.additionalDetails || "—"}`
    ].join("\n");
  }

  /* Shared escaper (animation.js) since caseData can contain free-typed
     user text that gets dropped straight into innerHTML via addHtmlBlock. */
  const escapeHtml = CSCAnimations.escapeHtml;

  return { buildSummary, renderSummaryCard, renderSummaryText };

})();