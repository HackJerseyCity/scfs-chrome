(() => {
  const API_BASE = "https://scfs-api.hackjc.org/api/issues";

  function getIssueId() {
    const match = window.location.pathname.match(/\/issues\/(\d+)/);
    return match ? match[1] : null;
  }

  function createBanner() {
    const banner = document.createElement("div");
    banner.id = "scfs-banner";
    banner.innerHTML = `
      <span class="scfs-title">SCFS Scores</span>
      <div class="scfs-scores">
        <span class="scfs-loading">Loading scores…</span>
      </div>
      <button class="scfs-close" title="Dismiss">&times;</button>
    `;
    banner.querySelector(".scfs-close").addEventListener("click", () => {
      banner.remove();
      document.body.style.marginTop = "";
    });
    document.body.prepend(banner);
    document.body.style.marginTop = banner.offsetHeight + "px";
    return banner;
  }

  function renderScores(banner, data) {
    const scoresEl = banner.querySelector(".scfs-scores");

    function scoreCard(name, score) {
      if (!score) return "";
      const pct = Math.round(score.confidence * 100);
      return `
        <div class="scfs-score-card">
          <span class="scfs-label">${name}</span>
          <span class="scfs-badge ${score.label}">${score.label}</span>
          <span class="scfs-confidence">${pct}%</span>
          <div class="scfs-tooltip">${score.reasoning}</div>
        </div>
      `;
    }

    scoresEl.innerHTML =
      scoreCard("Interaction", data.interaction) +
      scoreCard("Outcome", data.outcome);

    document.body.style.marginTop = banner.offsetHeight + "px";
  }

  function renderError(banner, msg) {
    banner.querySelector(".scfs-scores").innerHTML =
      `<span class="scfs-error">${msg}</span>`;
  }

  async function init() {
    const issueId = getIssueId();
    if (!issueId) return;

    const banner = createBanner();

    try {
      const resp = await fetch(`${API_BASE}/${issueId}`);
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const data = await resp.json();

      if (!data.interaction && !data.outcome) {
        renderError(banner, "No scores available for this issue.");
        return;
      }

      renderScores(banner, data);
    } catch (err) {
      renderError(banner, `Failed to load scores: ${err.message}`);
    }
  }

  // Run on initial load
  init();

  // SeeClickFix is an SPA — watch for URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const existing = document.getElementById("scfs-banner");
      if (existing) {
        existing.remove();
        document.body.style.marginTop = "";
      }
      init();
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
