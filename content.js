(() => {
  const API_BASE = "https://scfs-api.hackjc.org/api/issues";

  // Cache fetched scores so we don't re-fetch on DOM mutations
  const scoreCache = new Map();

  async function fetchScores(issueId) {
    if (scoreCache.has(issueId)) return scoreCache.get(issueId);

    const promise = fetch(`${API_BASE}/${issueId}`)
      .then((resp) => {
        if (!resp.ok) throw new Error(`${resp.status}`);
        return resp.json();
      })
      .catch((err) => ({ error: err.message }));

    scoreCache.set(issueId, promise);
    return promise;
  }

  // ── Single issue page (banner) ──

  function getIssueIdFromUrl() {
    // Matches /issues/12345 or /issues/map/12345
    const match = window.location.pathname.match(/\/issues\/(?:map\/)?(\d+)/);
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

  function badgeHtml(label, score) {
    if (!score) return "";
    const pct = Math.round(score.confidence * 100);
    return `
      <div class="scfs-score-card">
        <span class="scfs-label">${label}</span>
        <span class="scfs-badge ${score.label}">${score.label}</span>
        <span class="scfs-confidence">${pct}%</span>
        <div class="scfs-tooltip">${score.reasoning}</div>
      </div>
    `;
  }

  function renderBannerScores(banner, data) {
    const scoresEl = banner.querySelector(".scfs-scores");
    scoresEl.innerHTML =
      badgeHtml("Interaction", data.interaction) +
      badgeHtml("Outcome", data.outcome);
    document.body.style.marginTop = banner.offsetHeight + "px";
  }

  function renderBannerError(banner, msg) {
    banner.querySelector(".scfs-scores").innerHTML =
      `<span class="scfs-error">${msg}</span>`;
  }

  async function initSingleIssue() {
    const issueId = getIssueIdFromUrl();
    if (!issueId) return;

    const banner = createBanner();
    try {
      const data = await fetchScores(issueId);
      if (data.error) throw new Error(data.error);
      if (!data.interaction && !data.outcome) {
        renderBannerError(banner, "No scores available for this issue.");
        return;
      }
      renderBannerScores(banner, data);
    } catch (err) {
      renderBannerError(banner, `Failed to load scores: ${err.message}`);
    }
  }

  // ── Map/list view (inline card badges) ──

  function isMapPage() {
    return /\/issues\/map/.test(window.location.pathname);
  }

  function extractIssueIdFromHref(href) {
    const match = href.match(/\/issues\/(?:map\/)?(\d+)/);
    return match ? match[1] : null;
  }

  function findUnprocessedCards() {
    const links = document.querySelectorAll(
      'a[href*="/issues/"][href*="/issues/map/"], a[href*="/issues/map/"]'
    );
    const cards = [];

    links.forEach((link) => {
      const section = link.closest("section");
      if (!section || section.dataset.scfsProcessed) return;

      const issueId = extractIssueIdFromHref(link.getAttribute("href"));
      if (!issueId) return;

      section.dataset.scfsProcessed = "true";
      cards.push({ section, issueId });
    });

    return cards;
  }

  // ── Progress bar & filter bar ──

  let progressBar = null;
  let progressTotal = 0;
  let progressDone = 0;
  let cardPanel = null;

  // Filter state: which labels are visible (all on by default)
  const filters = { positive: true, negative: true, unknown: true };

  function getCardPanel(cards) {
    if (cardPanel) return cardPanel;
    const firstSection = cards[0]?.section;
    if (!firstSection) return null;
    cardPanel = firstSection.parentElement;
    return cardPanel;
  }

  function getOrCreateProgressBar(cards) {
    const panel = getCardPanel(cards);
    if (!panel) return null;

    let container = panel.querySelector(".scfs-progress");
    if (!container) {
      container = document.createElement("div");
      container.className = "scfs-progress";
      container.innerHTML = `
        <div class="scfs-progress-bar">
          <div class="scfs-progress-fill"></div>
        </div>
        <span class="scfs-progress-text"></span>
      `;
      panel.prepend(container);
    }

    container.classList.remove("scfs-progress-done");
    return container;
  }

  function getOrCreateFilterBar() {
    if (!cardPanel) return;
    let bar = cardPanel.querySelector(".scfs-filters");
    if (bar) return;

    bar = document.createElement("div");
    bar.className = "scfs-filters";
    bar.innerHTML = `
      <span class="scfs-filters-label">Filter:</span>
      <button class="scfs-filter-btn scfs-filter-negative active" data-filter="negative">Negative</button>
      <button class="scfs-filter-btn scfs-filter-positive active" data-filter="positive">Positive</button>
      <button class="scfs-filter-btn scfs-filter-unknown active" data-filter="unknown">Unscored</button>
    `;

    bar.querySelectorAll(".scfs-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.filter;
        filters[key] = !filters[key];
        btn.classList.toggle("active", filters[key]);
        applyFilters();
      });
    });

    // Insert after progress bar if it exists, otherwise prepend
    const progress = cardPanel.querySelector(".scfs-progress");
    if (progress) {
      progress.after(bar);
    } else {
      cardPanel.prepend(bar);
    }
  }

  function applyFilters() {
    if (!cardPanel) return;
    cardPanel.querySelectorAll("section[data-scfs-processed]").forEach((section) => {
      const sentiment = section.dataset.scfsSentiment;
      if (!sentiment) return; // not scored yet
      const visible = filters[sentiment];
      section.style.display = visible ? "" : "none";
    });
  }

  function updateProgress() {
    if (!progressBar) return;
    const pct = progressTotal === 0 ? 0 : (progressDone / progressTotal) * 100;
    const fill = progressBar.querySelector(".scfs-progress-fill");
    const text = progressBar.querySelector(".scfs-progress-text");
    fill.style.width = `${pct}%`;
    text.textContent = `Scoring ${progressDone}/${progressTotal}`;

    if (progressDone >= progressTotal) {
      text.textContent = `${progressTotal} issues scored`;
      setTimeout(() => {
        progressBar.classList.add("scfs-progress-done");
      }, 800);
    }
  }

  async function annotateCard(section, issueId) {
    // Create a placeholder row
    const row = document.createElement("div");
    row.className = "scfs-card-scores";
    row.innerHTML = '<span class="scfs-card-loading">Loading scores…</span>';
    section.appendChild(row);

    try {
      const data = await fetchScores(issueId);

      progressDone++;
      updateProgress();

      if (data.error) {
        section.dataset.scfsSentiment = "unknown";
        row.innerHTML = `<span class="scfs-card-error">Score unavailable</span>`;
        applyFilters();
        return;
      }
      if (!data.interaction && !data.outcome) {
        section.dataset.scfsSentiment = "unknown";
        row.innerHTML = `<span class="scfs-card-error">No scores</span>`;
        applyFilters();
        return;
      }

      // Tag section with overall sentiment (negative if either is negative)
      const labels = [data.interaction?.label, data.outcome?.label].filter(Boolean);
      if (labels.includes("negative")) {
        section.dataset.scfsSentiment = "negative";
      } else if (labels.includes("positive")) {
        section.dataset.scfsSentiment = "positive";
      } else {
        section.dataset.scfsSentiment = "unknown";
      }
      applyFilters();

      row.innerHTML = "";

      function inlineBadge(label, score) {
        if (!score) return "";
        const pct = Math.round(score.confidence * 100);
        return `
          <div class="scfs-card-badge-wrap scfs-card-${score.label}" title="${score.reasoning}">
            <span class="scfs-card-label">${label}</span>
            <span class="scfs-badge ${score.label}">${score.label}</span>
            <span class="scfs-card-conf">${pct}%</span>
          </div>
        `;
      }

      row.innerHTML =
        inlineBadge("Interaction", data.interaction) +
        inlineBadge("Outcome", data.outcome);
    } catch {
      progressDone++;
      updateProgress();
      section.dataset.scfsSentiment = "unknown";
      row.innerHTML = `<span class="scfs-card-error">Score unavailable</span>`;
      applyFilters();
    }
  }

  function processCards() {
    const cards = findUnprocessedCards();
    if (cards.length === 0) return;

    // Set up progress tracking & filter bar
    progressTotal += cards.length;
    progressBar = getOrCreateProgressBar(cards);
    updateProgress();
    getOrCreateFilterBar();

    // Fire all requests in parallel
    cards.forEach(({ section, issueId }) => annotateCard(section, issueId));
  }

  // ── Orchestration ──

  function init() {
    // Always try the banner if there's an issue ID in the URL
    initSingleIssue();
    // Also process cards if on the map page
    if (isMapPage()) {
      processCards();
    }
  }

  // Run on initial load
  init();

  // SPA navigation + dynamic card loading
  let lastUrl = location.href;
  new MutationObserver(() => {
    const urlChanged = location.href !== lastUrl;

    if (urlChanged) {
      lastUrl = location.href;
      const existing = document.getElementById("scfs-banner");
      if (existing) {
        existing.remove();
        document.body.style.marginTop = "";
      }
      // Reset progress & filters for new page
      progressBar = null;
      progressTotal = 0;
      progressDone = 0;
      cardPanel = null;
      // Re-run for new URL — banner if issue selected, cards if map
      initSingleIssue();
    }

    if (isMapPage()) {
      // Cards may appear dynamically as the map moves
      processCards();
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
