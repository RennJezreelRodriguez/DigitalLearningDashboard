let corpusData = {
  Tagalog: [],
  Waray: []
};

let dictionaryData = {};
let statsData = {};
let citiesRawData = { Tagalog: [], Waray: [] };

let state = {
  corpus: "Tagalog",
  searchTerm: "basa",
  section: "home",
  activeMetric: null,
  freqSelectedWords: ["basa", "tubig", "ako"],
  mapScope: "ph",
  mapLang: "all"
};

async function loadCSV(filename) {
  try {
    const response = await fetch(filename);
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    
    const englishBlacklist = new Set(["in", "of", "the", "and", "to", "a", "is", "for", "on", "with", "as", "by", "at", "from", "new", "species"]);

    let results = [];
    parsed.data.forEach(row => {
      const keys = Object.keys(row);
      const wordKey = keys.find(k => k.toLowerCase().includes('word') || k.toLowerCase().includes('salita') || k === '0');
      const freqKey = keys.find(k => k.toLowerCase().includes('freq') || k.toLowerCase().includes('dalas') || k === '1');
      
      const word = (row[wordKey] || row[keys[0]] || "").toString().trim().toLowerCase();
      const freq = parseInt(row[freqKey] || row[keys[1]] || "0", 10);
      
      const isPunctuationOrSymbol = /^[.,;:!?()\[\]{}"'\-\s]+$/.test(word);
      const isEnglish = englishBlacklist.has(word);
      const isSingleCharArtifact = word.length <= 1;

      if (word && !isNaN(freq) && !isPunctuationOrSymbol && !isEnglish && !isSingleCharArtifact) {
        results.push({ word, freq });
      }
    });
    return results;
  } catch (err) {
    console.error("May error sa pag-load ng " + filename, err);
    return [];
  }
}

async function loadDictionary() {
  try {
    const response = await fetch("./dictionary.json");
    dictionaryData = await response.json();

    const selectEl = document.getElementById("target-word-select");
    if (selectEl) {
      selectEl.innerHTML = "";
      Object.keys(dictionaryData).sort().forEach(word => {
        const option = document.createElement("option");
        option.value = word;
        option.textContent = word;
        if (word === state.searchTerm) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Hindi ma-load ang dictionary.json", err);
  }
}

async function loadStats() {
  try {
    const response = await fetch("./Data/stats.json");
    statsData = await response.json();
    
    if (statsData.Tagalog && statsData.Waray) {
      const tglPillSub = document.getElementById("pill-tgl-count");
      const warPillSub = document.getElementById("pill-war-count");
      if (tglPillSub) tglPillSub.textContent = `${statsData.Tagalog.tokens.toLocaleString()} tokens`;
      if (warPillSub) warPillSub.textContent = `${statsData.Waray.tokens.toLocaleString()} tokens`;
    }
  } catch (err) {
    console.error("Hindi ma-load ang stats.json", err);
    statsData = {};
  }
}

async function loadCities() {
  try {
    const response = await fetch("./Data/cities.json");
    citiesRawData = await response.json();
    renderMapSection();
  } catch (err) {
    console.error("Hindi ma-load ang cities.json, gamit ang default coordinates", err);
    renderMapSection();
  }
}

async function init() {
  document.getElementById("status-text").textContent = "Nilo-load ang mga CSV files, diksyunaryo, at estadistika...";

  const [tgl, war] = await Promise.all([
    loadCSV("./Data/wordlist_tgl_wikipedia_2021_20260904060133.csv"),
    loadCSV("./Data/wordlist_war_wikipedia_2021_20260904060844.csv"),
    loadDictionary(),
    loadStats(),
    loadCities()
  ]);

  corpusData.Tagalog = tgl;
  corpusData.Waray = war;

  document.getElementById("status-text").textContent = `Tagalog (${tgl.length} salita) at Waray (${war.length} salita) ay handa na!`;

  populateVocabDatalist();
  renderMetrics();
  renderActiveSection();
}

/* ===================== METRIC CARDS ===================== */

function renderMetrics() {
  const s = statsData[state.corpus];
  const tokensEl = document.getElementById("metric-tokens");
  const typesEl = document.getElementById("metric-types");
  const ttrEl = document.getElementById("metric-ttr");
  const sentEl = document.getElementById("metric-sentences");

  if (!s) {
    tokensEl.textContent = "N/A";
    typesEl.textContent = "N/A";
    ttrEl.textContent = "N/A";
    sentEl.textContent = "N/A";
    return;
  }

  tokensEl.textContent = s.tokens.toLocaleString();
  typesEl.textContent = s.types.toLocaleString();
  ttrEl.textContent = s.ttr;

  const estimatedSentences = s.sentences !== null ? s.sentences : Math.round(s.tokens / 16);
  sentEl.textContent = estimatedSentences.toLocaleString();

  if (state.activeMetric) {
    renderMetricDetail(state.activeMetric);
  }
}

function renderMetricDetail(metric) {
  const detailEl = document.getElementById("metric-detail");
  const s = statsData[state.corpus];
  if (!s) {
    detailEl.style.display = "none";
    return;
  }

  const estimatedSentences = s.sentences !== null ? s.sentences : Math.round(s.tokens / 16);

  const explanations = {
    tokens: `<b>Kabuuang Token:</b> ${s.tokens.toLocaleString()} — kabuuang bilang ng salita sa ${state.corpus} corpus.`,
    types: `<b>Natatanging Salita (Types):</b> ${s.types.toLocaleString()} — bilang ng iba't ibang natatanging salita sa ${state.corpus} corpus.`,
    ttr: `<b>Type-Token Ratio:</b> ${s.ttr} — ratio ng types sa tokens. Mas mataas na TTR ay nagpapahiwatig ng mas malaking leksikal na baryasyon.`,
    sentences: `<b>Pangungusap:</b> Tinatayang ${estimatedSentences.toLocaleString()} na pangungusap sa nasabing korpus (batay sa average na haba ng pangungusap).`
  };

  detailEl.innerHTML = explanations[metric] || "";
  detailEl.style.display = "block";
}

function setupMetricCards() {
  document.querySelectorAll(".metric-card").forEach(card => {
    card.addEventListener("click", () => {
      const metric = card.getAttribute("data-metric");
      document.querySelectorAll(".metric-card").forEach(c => c.classList.remove("active-metric"));

      if (state.activeMetric === metric) {
        state.activeMetric = null;
        document.getElementById("metric-detail").style.display = "none";
      } else {
        state.activeMetric = metric;
        card.classList.add("active-metric");
        renderMetricDetail(metric);
      }
    });
  });
}

/* ===================== SECTION SWITCHING ===================== */

function renderActiveSection() {
  if (state.section === "home") renderHome();
  else if (state.section === "colloc") renderColloc();
  else if (state.section === "freq") renderFreqSection();
  else if (state.section === "nlp") renderNlp();
  else if (state.section === "map") renderMapSection();
}

function switchSection(sectionName) {
  state.section = sectionName;

  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.getElementById("section-" + sectionName).classList.add("active");

  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[data-section="${sectionName}"]`).classList.add("active");

  document.getElementById("search-container").style.display = sectionName === "colloc" ? "flex" : "none";

  renderActiveSection();

  if (sectionName === "map") {
    setTimeout(() => {
      renderMapSection();
    }, 150);
  }
}

/* ===================== SEKSYON: HOME ===================== */

function renderHome() {
  const wordCloudEl = document.getElementById("home-word-cloud");
  if (!wordCloudEl) return;

  const dataset = corpusData[state.corpus];
  if (!dataset || dataset.length === 0) return;

  // Define language-specific markers to prevent cross-contamination
  let markerWords = [];
  if (state.corpus === "Tagalog") {
    markerWords = ["ng", "sa", "ang", "na", "mga", "at", "ay", "si", "ni", "kay"];
  } else {
    markerWords = ["han", "an", "ha", "san", "nga", "ug", "iti", "hi", "ni", "ha", "ngaun"];
  }

  const displayItems = markerWords.map(w => {
    const found = dataset.find(item => item.word === w);
    return found || { word: w, freq: 0 };
  }).filter(item => item.freq > 0);

  displayItems.sort((a, b) => b.freq - a.freq);
  const maxFreq = displayItems[0]?.freq || 1;

  wordCloudEl.innerHTML = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Dalas ng mga pangunahing marker sa korpus ng <b>${state.corpus}</b>:</div>
      ${displayItems.map(item => {
        const percentage = Math.round((item.freq / maxFreq) * 100);
        return `
          <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
            <span style="width: 70px; font-weight: 600; text-align: right; color: var(--text-main);">${item.word}</span>
            <div style="flex: 1; background: var(--border-color); border-radius: 4px; height: 18px; overflow: hidden; position: relative;">
              <div style="background: var(--accent); width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
            </div>
            <span style="width: 70px; color: var(--text-muted); font-size: 11px;">${item.freq.toLocaleString()}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ===================== SEKSYON 1: KOLOKASYON ===================== */

function renderColloc() {
  const term = state.searchTerm.toLowerCase();
  const tglMatch = corpusData.Tagalog.find(item => item.word === term) || { word: term, freq: 0 };
  const warMatch = corpusData.Waray.find(item => item.word === term) || { word: term, freq: 0 };

  document.getElementById("colloc-target-display").textContent = state.searchTerm;
  document.getElementById("colloc-meta-info").textContent = `${state.corpus} • Tgl Freq: ${tglMatch.freq} | War Freq: ${warMatch.freq}`;

  const defEntry = dictionaryData[term] || {
    tagalog: "Walang tiyak na kahulugan sa diksyunaryo.",
    waray: "Walang tiyak na kahulugan sa diksyunaryo."
  };

  const detailListEl = document.getElementById("colloc-detail-list");
  if (detailListEl) {
    detailListEl.innerHTML = `
      <div class="insight-box">
        <b>Kahulugan mula sa Diksyunaryo:</b><br>
        • <b>Tagalog:</b> ${defEntry.tagalog}<br>
        • <b>Waray:</b> ${defEntry.waray}
      </div>
      <div class="colloc-row"><span>Tagalog Frequency:</span> <span class="colloc-count">${tglMatch.freq.toLocaleString()}</span></div>
      <div class="colloc-row"><span>Waray Frequency:</span> <span class="colloc-count">${warMatch.freq.toLocaleString()}</span></div>
    `;
  }
}

/* ===================== SEKSYON 2: DALAS NG SALITA ===================== */

function populateVocabDatalist() {
  const datalist = document.getElementById("vocab-datalist");
  if (!datalist) return;
  
  const allWords = new Set();
  corpusData.Tagalog.forEach(i => allWords.add(i.word));
  corpusData.Waray.forEach(i => allWords.add(i.word));

  datalist.innerHTML = "";
  Array.from(allWords).slice(0, 500).forEach(word => {
    const opt = document.createElement("option");
    opt.value = word;
    datalist.appendChild(opt);
  });
}

function renderFreqSection() {
  const chipsEl = document.getElementById("freq-chips");
  const chartEl = document.getElementById("freq-chart");
  const tableEl = document.getElementById("freq-table");

  if (!chipsEl || !chartEl || !tableEl) return;

  chipsEl.innerHTML = state.freqSelectedWords.map(word => `
    <span style="display: inline-flex; align-items: center; gap: 6px; background: var(--accent-light); padding: 4px 10px; border-radius: 20px; font-size: 12px; border: 1px solid var(--border-color);">
      ${word} <button onclick="removeFreqWord('${word}')" style="background: none; border: none; cursor: pointer; font-weight: bold; color: var(--primary);">×</button>
    </span>
  `).join("");

  chartEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; padding: 10px 0;">
      ${state.freqSelectedWords.map(word => {
        const tgl = corpusData.Tagalog.find(i => i.word === word)?.freq || 0;
        const war = corpusData.Waray.find(i => i.word === word)?.freq || 0;
        return `
          <div style="font-size: 12px;">
            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-main);">${word}</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="width: 50px; font-size: 11px; color: var(--text-muted);">Tagalog</span>
              <div style="flex: 1; background: var(--border-color); height: 12px; border-radius: 4px; overflow: hidden;">
                <div style="background: var(--secondary-blue); width: ${Math.min(100, (tgl/100))}%; height: 100%;"></div>
              </div>
              <span style="width: 50px; font-size: 11px;">${tgl}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
              <span style="width: 50px; font-size: 11px; color: var(--text-muted);">Waray</span>
              <div style="flex: 1; background: var(--border-color); height: 12px; border-radius: 4px; overflow: hidden;">
                <div style="background: var(--accent-gold-deep); width: ${Math.min(100, (war/100))}%; height: 100%;"></div>
              </div>
              <span style="width: 50px; font-size: 11px;">${war}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  tableEl.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--primary);">
          <th style="padding: 8px;">Salita</th>
          <th style="padding: 8px;">Tagalog Freq</th>
          <th style="padding: 8px;">Waray Freq</th>
          <th style="padding: 8px;">Dominante</th>
        </tr>
      </thead>
      <tbody>
        ${state.freqSelectedWords.map(word => {
          const tgl = corpusData.Tagalog.find(i => i.word === word)?.freq || 0;
          const war = corpusData.Waray.find(i => i.word === word)?.freq || 0;
          const dominant = tgl > war ? "Tagalog" : (war > tgl ? "Waray" : "Magkatumbas");
          return `
            <tr style="border-bottom: 1px dashed var(--border-color);">
              <td style="padding: 8px; font-weight: 600;">${word}</td>
              <td style="padding: 8px;">${tgl.toLocaleString()}</td>
              <td style="padding: 8px;">${war.toLocaleString()}</td>
              <td style="padding: 8px; color: var(--accent);">${dominant}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

window.removeFreqWord = function(word) {
  state.freqSelectedWords = state.freqSelectedWords.filter(w => w !== word);
  renderFreqSection();
};

/* ===================== SEKSYON 3: NLP ===================== */

function renderNlp() {
  // Static informative layout handled in HTML
}

/* ===================== SEKSYON 4: MAPA (PLOTLY INTEGRATION) ===================== */

function renderMapSection() {
  const chipsContainer = document.getElementById("map-cities-chips");
  if (!chipsContainer) return;

  const masterLocations = [
    { name: 'Metro Manila', lat: 14.5995, lon: 120.9842, lang: 'Tagalog', pop: 'Kalakhang Maynila' },
    { name: 'Batangas', lat: 13.9397, lon: 121.0572, lang: 'Tagalog', pop: 'Rehiyon IV-A' },
    { name: 'Laguna', lat: 14.1000, lon: 121.3790, lang: 'Tagalog', pop: 'Rehiyon IV-A' },
    { name: 'Quezon', lat: 14.0298, lon: 121.5654, lang: 'Tagalog', pop: 'Rehiyon IV-A' },
    { name: 'Bulacan', lat: 14.8000, lon: 120.8800, lang: 'Tagalog', pop: 'Gitnang Luzon' },
    { name: 'Tacloban City', lat: 11.2434, lon: 125.0016, lang: 'Waray', pop: 'Silangang Bisaya' },
    { name: 'Catbalogan', lat: 12.0710, lon: 124.8817, lang: 'Waray', pop: 'Samar' },
    { name: 'Borongan', lat: 11.7758, lon: 125.4353, lang: 'Waray', pop: 'Eastern Samar' },
    { name: 'Palo, Leyte', lat: 11.1561, lon: 125.0044, lang: 'Waray', pop: 'Leyte' }
  ];

  let filteredLocations = masterLocations.filter(loc => {
    if (state.mapLang === 'all') return true;
    return loc.lang === state.mapLang;
  });

  let centerCoord, latRange, lonRange;
  if (state.mapScope === 'luzon') {
    centerCoord = { lat: 14.1, lon: 121.0 };
    latRange = [11.0, 18.0];
    lonRange = [118.0, 124.0];
  } else {
    centerCoord = { lat: 12.8, lon: 122.5 };
    latRange = [4.5, 21.5];
    lonRange = [115.0, 128.5]; // Balanced horizontal bounds for centered layout
  }

  const tagalogLocs = filteredLocations.filter(l => l.lang === 'Tagalog');
  const warayLocs = filteredLocations.filter(l => l.lang === 'Waray');

  let traces = [];

  if (tagalogLocs.length > 0) {
    traces.push({
      type: 'scattergeo',
      mode: 'markers+text',
      name: 'Tagalog',
      lat: tagalogLocs.map(l => l.lat),
      lon: tagalogLocs.map(l => l.lon),
      text: tagalogLocs.map(l => l.name),
      textposition: 'top right',
      marker: { size: 10, color: '#38bdf8' }
    });
  }

  if (warayLocs.length > 0) {
    traces.push({
      type: 'scattergeo',
      mode: 'markers+text',
      name: 'Waray',
      lat: warayLocs.map(l => l.lat),
      lon: warayLocs.map(l => l.lon),
      text: warayLocs.map(l => l.name),
      textposition: 'top right',
      marker: { size: 10, color: '#f43f5e' }
    });
  }

  const layout = {
    geo: {
      resolution: 50,
      projection: {
        type: 'mercator'
      },
      center: centerCoord,
      showland: true,
      landcolor: '#1e293b',
      subunitcolor: '#334155',
      countrycolor: '#334155',
      coastlinecolor: '#475569',
      bgcolor: 'rgba(0,0,0,0)',
      lataxis: { range: latRange },
      lonaxis: { range: lonRange }
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 10, r: 20, b: 10, l: 20 },
    showlegend: false
  };

  const config = { responsive: true, displayModeBar: false };

  if (document.getElementById('plotly-map-container')) {
    Plotly.react('plotly-map-container', traces, layout, config);
  }

  chipsContainer.innerHTML = filteredLocations.map(item => `
    <span style="background: var(--input-bg); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 6px; font-size: 11px; color: var(--text-main);">
      📍 <strong>${item.name}</strong> <span style="color: var(--text-muted);">(${item.lang})</span>
    </span>
  `).join("");
}

/* ===================== EVENT WIRING & VOYANT EMBED TOGGLES ===================== */

document.addEventListener("DOMContentLoaded", () => {
  const targetSelect = document.getElementById("target-word-select");
  const navButtons = document.querySelectorAll(".tab-btn[data-section]");
  const freqAddBtn = document.getElementById("freq-add-btn");
  const freqSearchInput = document.getElementById("freq-search-input");
  
  const btnWeb = document.getElementById("btn-colloc-web");
  const btnCirrus = document.getElementById("btn-colloc-cirrus");

  const corpusPills = document.querySelectorAll(".corpus-pill");
  corpusPills.forEach(pill => {
    pill.addEventListener("click", () => {
      const selectedCorpus = pill.getAttribute("data-corpus");
      state.corpus = selectedCorpus;

      corpusPills.forEach(p => {
        if (p.getAttribute("data-corpus") === selectedCorpus) {
          p.style.background = "var(--accent)";
          p.style.color = "#fff";
          p.style.borderColor = "var(--accent)";
        } else {
          p.style.background = "var(--input-bg)";
          p.style.color = "var(--text-main)";
          p.style.borderColor = "var(--border-color)";
        }
      });

      renderMetrics();
      renderActiveSection();
    });
  });

  const scopeBtns = document.querySelectorAll(".map-scope-btn");
  scopeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      scopeBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.color = "var(--text-main)";
        b.style.fontWeight = "400";
      });
      btn.style.background = "var(--accent)";
      btn.style.color = "#fff";
      btn.style.fontWeight = "600";
      state.mapScope = btn.getAttribute("data-scope");
      renderMapSection();
    });
  });

  const langBtns = document.querySelectorAll(".map-lang-btn");
  langBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      langBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.color = "var(--text-main)";
        b.style.fontWeight = "400";
      });
      btn.style.background = "var(--accent)";
      btn.style.color = "#fff";
      btn.style.fontWeight = "600";
      state.mapLang = btn.getAttribute("data-lang");
      renderMapSection();
    });
  });

  if (targetSelect) {
    targetSelect.addEventListener("change", (e) => {
      state.searchTerm = e.target.value.trim();
      renderColloc();
    });
  }

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchSection(btn.getAttribute("data-section"));
    });
  });

  if (freqAddBtn && freqSearchInput) {
    freqAddBtn.addEventListener("click", () => {
      const val = freqSearchInput.value.trim().toLowerCase();
      if (val && !state.freqSelectedWords.includes(val)) {
        state.freqSelectedWords.push(val);
        freqSearchInput.value = "";
        renderFreqSection();
      }
    });
  }

  if (btnWeb && btnCirrus) {
    btnWeb.addEventListener("click", () => {
      btnWeb.classList.add("active");
      btnCirrus.classList.remove("active");
      
      btnWeb.style.background = "#fff";
      btnWeb.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      btnCirrus.style.background = "transparent";
      btnCirrus.style.boxShadow = "none";

      const container = document.getElementById("colloc-network-container");
      if (container) {
        container.innerHTML = `
          <iframe style="width: 100%; max-width: 600px; height: 424px; border: none;" src="https://beta.voyant-tools.org/tool/Links/?query=nga&query=ng&query=sa&corpus=ed21914c9fec873f081bec11b5a7d358"></iframe>
        `;
      }
    });

    btnCirrus.addEventListener("click", () => {
      btnCirrus.classList.add("active");
      btnWeb.classList.remove("active");
      
      btnCirrus.style.background = "#fff";
      btnCirrus.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      btnWeb.style.background = "transparent";
      btnWeb.style.boxShadow = "none";

      const container = document.getElementById("colloc-network-container");
      if (container) {
        container.innerHTML = `
          <iframe style="width: 100%; max-width: 600px; height: 424px; border: none;" src="https://beta.voyant-tools.org/tool/Cirrus/?corpus=ed21914c9fec873f081bec11b5a7d358"></iframe>
        `;
      }
    });
  }

  const btnStacked = document.getElementById("btn-trend-stacked");
  const btnBar = document.getElementById("btn-trend-bar");

  if (btnStacked && btnBar) {
    btnStacked.addEventListener("click", () => {
      btnStacked.classList.add("active");
      btnBar.classList.remove("active");
      
      btnStacked.style.background = "#fff";
      btnStacked.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      btnBar.style.background = "transparent";
      btnBar.style.boxShadow = "none";

      const container = document.getElementById("relative-freq-container");
      if (container) {
        container.innerHTML = `
          <iframe style="width: 100%; max-width: 600px; height: 424px; border: none;" src="https://beta.voyant-tools.org/tool/Trends/?query=nga&query=ng&query=sa&query=han&query=mga&chartType=stacked&corpus=ed21914c9fec873f081bec11b5a7d358"></iframe>
        `;
      }
    });

    btnBar.addEventListener("click", () => {
      btnBar.classList.add("active");
      btnStacked.classList.remove("active");
      
      btnBar.style.background = "#fff";
      btnBar.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      btnStacked.style.background = "transparent";
      btnStacked.style.boxShadow = "none";

      const container = document.getElementById("relative-freq-container");
      if (container) {
        container.innerHTML = `
          <iframe style="width: 100%; max-width: 600px; height: 424px; border: none;" src="https://beta.voyant-tools.org/tool/Trends/?query=nga&query=ng&query=sa&query=han&query=mga&chartType=bar&corpus=ed21914c9fec873f081bec11b5a7d358"></iframe>
        `;
      }
    });
  }

  setupMetricCards();
  init();
});