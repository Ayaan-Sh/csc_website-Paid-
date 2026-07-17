/* ============================================================
   storage.js
   Handles all persistence for the CSC Digital Case Officer.
   Everything lives in localStorage no backend required.
   Nothing in this file knows about conversation logic or the DOM.
   ============================================================ */

const CSCStorage = (() => {

  const SESSION_KEY = "csc_chat_session_v2";
  const THEME_KEY = "csc_chat_theme";

  /* Case details can include sensitive things (Aadhaar/PAN numbers,
     account access, contact info). Don't let an abandoned session with
     that data sit in localStorage forever on a shared/public machine. */
  const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

  /* ---- Session (conversation transcript + collected case data) ---- */

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);
      const lastActivity = session.lastActivityAt || session.createdAt || 0;

      if (!lastActivity || Date.now() - lastActivity > SESSION_TTL_MS) {
        clearSession();
        return null;
      }

      return session;
    } catch (err) {
      console.warn("CSCStorage: could not read session", err);
      return null;
    }
  }

  function saveSession(session) {
    try {
      if (!session.createdAt) session.createdAt = Date.now();
      session.lastActivityAt = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn("CSCStorage: could not save session", err);
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {
      console.warn("CSCStorage: could not clear session", err);
    }
  }

  function createEmptySession() {
    return {
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      messages: [],        // { from: 'bot'|'user', text, timestamp }
      caseData: {},         // structured answers collected during the flow
      contactInfo: {},        // name / phone / email, collected just before submission
      flowKey: null,          // which incident flow is active
      stepIndex: 0,             // current position within that flow
      stage: "listening",         // 'listening' | 'clarifying' | 'categoryFallback' | 'flow' | 'summary' | 'contactInfo'
      clarifyAttempts: 0,
      completed: false,
      lastSummary: null
    };
  }

  /* ---- Theme (light / dark) ---- */

  function getTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      console.warn("CSCStorage: could not save theme", err);
    }
  }

  return {
    getSession,
    saveSession,
    clearSession,
    createEmptySession,
    getTheme,
    saveTheme
  };

})();