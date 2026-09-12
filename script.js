let corpusData = {
  Tagalog: [],
  Waray: []
};

let dictionaryData = {};

let state = {
  corpus: "Tagalog",
  searchTerm: "basa"
};

/* Static reference data for the Language Info card */
const langInfo = {
  Tagalog: {
    heading: "Tagalog — Central Philippine Tagalog subgroup",
    branch: "Malayo-Polynesian",
    subgroup: "Central Philippine",
    region: "Katagalugan, Luzon",
    population: "28,000,000+ (L1)",
    households: "10,522,507"
  },
  Waray: {
    heading: "Waray-Waray — Bisayan subgroup",
    branch: "Malayo-Polynesian",
    subgroup: "Bisayan",
    region: "Silangang Visayas",
    population: "~2,600,000",
    households: "698,745"
  }
};

function updateLanguageInfo() {
  const info = langInfo[state.corpus];
  if (!info) return;
  document.getElementById("lang-heading").textContent = info.heading;
  document.getElementById("lang-branch").textContent = info.branch;
  document.getElementById("lang-subgroup").textContent = info.subgroup;
  document.getElementById("lang-region").textContent = info.region;
  document.getElementById("lang-population").textContent = info.population;
  document.getElementById("lang-households").textContent = info.households;
}

/* Parses "Mga Tagalog Collocates: hayop, gubat, usa" -> ["hayop","gubat","usa"] */
function parseCollocates(str) {
  if (!str) return [];
  const idx = str.indexOf(":");
  const listPart = idx >= 0 ? str.slice(idx + 1) : str;
  return listPart.split(",").map(w => w.trim()).filter(Boolean).slice(0, 6);
}

/* Builds an inline SVG network graph: center word branching into
   Tagalog collocates (left, blue) and Waray collocates (right, gold) */
function buildCoocSVG(centerWord, tglList, warList) {
  const width = 760, height = 320;
  const cx = width / 2, cy = height / 2;
  const centerR = 52;
  const nodeR = 40;
  const leftX = 130, rightX = width - 130;
  const topMargin = 34, bottomMargin = 34;

  function positions(count, x) {
    if (count <= 0) return [];
    if (count === 1) return [{ x, y: cy }];
    const usable = height - topMargin - bottomMargin;
    const step = usable / (count - 1);
    const arr = [];
    for (let i = 0; i < count; i++) arr.push({ x, y: topMargin + step * i });
    return arr;
  }

  function node(x, y, r, fill, textColor, label) {
    const fontSize = label.length > 8 ? 9.5 : 11;
    const maxTextWidth = r * 1.6;
    const approxWidth = label.length * (fontSize * 0.62);
    const lengthAttr = approxWidth > maxTextWidth
      ? ` textLength="${maxTextWidth.toFixed(0)}" lengthAdjust="spacingAndGlyphs"`
      : "";
    return `<g>
      <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#1B120F" stroke-opacity="0.15" stroke-width="2"/>
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" font-size="${fontSize}" font-weight="700" font-family="Inter, sans-serif"${lengthAttr}>${label}</text>
    </g>`;
  }

  const tglPos = positions(tglList.length, leftX);
  const warPos = positions(warList.length, rightX);

  let lines = "";
  tglPos.forEach(p => {
    lines += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="var(--secondary-blue)" stroke-width="1.5" opacity="0.4"/>`;
  });
  warPos.forEach(p => {
    lines += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="var(--accent-gold-deep)" stroke-width="1.5" opacity="0.5"/>`;
  });

  let nodes = "";
  tglPos.forEach((p, i) => { nodes += node(p.x, p.y, nodeR, "var(--secondary-blue)", "#FFF7EC", tglList[i]); });
  warPos.forEach((p, i) => { nodes += node(p.x, p.y, nodeR, "var(--accent-gold-deep)", "var(--primary-dark)", warList[i]); });

  const centerNode = node(cx, cy, centerR, "var(--primary)", "#FFF7EC", centerWord.toUpperCase());

  const tglCaptionX = tglPos.length ? leftX : leftX;
  const warCaptionX = warPos.length ? rightX : rightX;

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${tglCaptionX}" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="var(--secondary-blue)" font-family="Inter, sans-serif">TAGALOG</text>
    <text x="${warCaptionX}" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent-gold-deep)" font-family="Inter, sans-serif">WARAY</text>
    ${lines}
    ${nodes}
    ${centerNode}
  </svg>`;
}

async function loadCSV(filename) {
  try {
    const response = await fetch(filename);
    const text = await response.text();
    const lines = text.split("\n");
    let parsed = [];

    for (let i = 1; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      let parts = line.includes("\t") ? line.split("\t") : line.split(",");
      if (parts.length >= 2) {
        let word = parts[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
        let freq = parseInt(parts[1].replace(/^["']|["']$/g, "").trim(), 10);

        const isPureWord = /^[a-zà-ÿñ]+$/i.test(word);

        if (word && !isNaN(freq) && isPureWord) {
          parsed.push({ word, freq });
        }
      }
    }
    return parsed;
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
    const nlpSelectEl = document.getElementById("nlp-word-select");
    const sortedWords = Object.keys(dictionaryData).sort();

    if (selectEl) {
      selectEl.innerHTML = "";
      sortedWords.forEach(word => {
        const option = document.createElement("option");
        option.value = word;
        option.textContent = word;
        if (word === state.searchTerm) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
    }

    if (nlpSelectEl) {
      nlpSelectEl.innerHTML = "";
      sortedWords.forEach(word => {
        const option = document.createElement("option");
        option.value = word;
        option.textContent = word;
        if (word === state.searchTerm) {
          option.selected = true;
        }
        nlpSelectEl.appendChild(option);
      });
    }

    updateAffixDropdown();
  } catch (err) {
    console.error("Hindi ma-load ang dictionary.json", err);
  }
}

async function init() {
  document.getElementById("status-text").textContent = "Nilo-load ang mga CSV datasets at diksyunaryo...";

  const [tgl, war] = await Promise.all([
    loadCSV("./Data/wordlist_tgl_wikipedia_2021_20260904060133.csv"),
    loadCSV("./Data/wordlist_war_wikipedia_2021_20260904060844.csv"),
    loadDictionary()
  ]);

  corpusData.Tagalog = tgl;
  corpusData.Waray = war;

  document.getElementById("status-text").textContent = `Tagalog (${tgl.length} salita) at Waray (${war.length} salita) ay handa na!`;
  updateDashboard();
}

/* Panel 1: Data Insight — word frequency bar chart with selection highlight */
function renderDataInsight() {
  const dataset = corpusData[state.corpus];
  const wordCloudEl = document.getElementById("word-cloud");
  const insightEl = document.getElementById("freq-insight");
  if (!dataset || dataset.length === 0 || !wordCloudEl || !insightEl) return;

  document.getElementById("freq-heading").textContent = `Graphical Trend: Frequency Bar Chart (${state.corpus})`;
  document.getElementById("freq-subtext").textContent = `Mga salitang may mataas na frequency markers`;

  const topItems = dataset.slice(0, 10);
  const maxFreq = topItems[0]?.freq || 1;

  wordCloudEl.innerHTML = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Paghahambing ng dalas (Frequency per corpus):</div>
      ${topItems.map(item => {
        const percentage = Math.round((item.freq / maxFreq) * 100);
        const isSelected = item.word.toLowerCase() === state.searchTerm.toLowerCase();
        
        const barColor = isSelected ? "var(--primary)" : "var(--accent-gold-deep)";
        const fontWeight = isSelected ? "700" : "600";
        const textColor = isSelected ? "var(--primary-dark)" : "var(--text-main)";
        const borderHighlight = isSelected ? "2px solid var(--primary)" : "1px solid transparent";

        return `
          <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; border: ${borderHighlight}; padding: 2px 4px; border-radius: 4px; background: ${isSelected ? 'var(--accent-light)' : 'transparent'};">
            <span style="width: 70px; font-weight: ${fontWeight}; text-align: right; color: ${textColor};">${item.word}</span>
            <div style="flex: 1; background: var(--border-color); border-radius: 4px; height: 18px; overflow: hidden; position: relative;">
              <div style="background: ${barColor}; width: ${percentage}%; height: 100%; border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
            <span style="width: 70px; color: var(--text-muted); font-size: 11px;">${item.freq.toLocaleString()}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  insightEl.innerHTML = `
    <div class="insight-box" style="margin-top: 14px; margin-bottom: 10px; font-size: 13px;">
      <b>Estrukturang Pagsusuri:</b> Ang bar chart na ito ay nagpapakita ng mga pangunahing pananda sa ${state.corpus} corpus. Ang salitang <b style="color: var(--primary);">${state.searchTerm}</b> ay naka-highlight kung kabilang ito sa nangungunang sampu.
    </div>
    <div class="colloc-row"><span>Kabuuang Malinis na Salita:</span> <span class="colloc-count">${dataset.length.toLocaleString()}</span></div>
  `;
}

/* Panel 2: Interactive Word Co-occurrence Map — driven by state.searchTerm */
function renderCooc() {
  const graphEl = document.getElementById("cooc-graph");
  const legendEl = document.getElementById("cooc-legend");
  if (!graphEl || !legendEl) return;

  document.getElementById("cooc-heading").textContent = `Interactive Word Co-occurrence Map: "${state.searchTerm}"`;
  document.getElementById("cooc-subtext").textContent = `Paghahambing ng mga kasamang salita (collocates) ng parehong salita sa Tagalog at Waray.`;

  const term = state.searchTerm.toLowerCase();
  const entry = dictionaryData[term];
  const tglList = parseCollocates(entry?.tagalog);
  const warList = parseCollocates(entry?.waray);

  if (!entry || (tglList.length === 0 && warList.length === 0)) {
    graphEl.innerHTML = `<div class="cooc-empty">Walang na-record na collocation data para sa salitang "<b style="color: var(--text-main);">${state.searchTerm}</b>". Pumili ng ibang salita sa dropdown.</div>`;
    legendEl.innerHTML = `
      <div class="insight-box" style="margin-bottom: 10px; font-size: 13px;">
        Walang datos na makikita para sa salitang ito. Subukan ang isa pa mula sa listahan.
      </div>
    `;
  } else {
    graphEl.innerHTML = `<div class="cooc-wrap">${buildCoocSVG(state.searchTerm, tglList, warList)}</div>`;
    legendEl.innerHTML = `
      <div class="insight-box" style="margin-bottom: 10px; font-size: 13px; line-height: 1.5;">
        Ang gitnang bilog ay ang piniling salita. Ang mga bilog sa <b style="color: var(--secondary-blue);">kaliwa</b> ay mga Tagalog collocate nito, at ang mga bilog sa <b style="color: var(--accent-gold-deep);">kanan</b> ay mga Waray collocate nito.
      </div>
      <div class="colloc-row"><span>Tagalog Collocates:</span> <span class="colloc-count" style="color: var(--secondary-blue);">${tglList.length}</span></div>
      <div class="colloc-row"><span>Waray Collocates:</span> <span class="colloc-count" style="color: var(--accent-gold-deep);">${warList.length}</span></div>
    `;
  }
}

function updateAffixDropdown() {
  const affixSelect = document.getElementById("nlp-affix-select");
  if (!affixSelect) return;

  const standardAffixes = [
    { id: "nag-", label: "nag- (Aktibong Aspekto / Actor-focus)" },
    { id: "um-", label: "um- (Pawatas / Naganap na)" },
    { id: "-in", label: "-in (Pokus sa Layon / Object-focus)" },
    { id: "-an", label: "-an (Lugar / Direksyunal)" },
    { id: "-on", label: "-on (Kaparehong hulapi sa Waray)" }
  ];

  affixSelect.innerHTML = standardAffixes.map(a => 
    `<option value="${a.id}">${a.label}</option>`
  ).join("");
}

/* Panel 3: Dynamic Affix Selection & Contextual Meaning Breakdown */
function renderNLP() {
  const wordSelect = document.getElementById("nlp-word-select");
  const affixSelect = document.getElementById("nlp-affix-select");
  const contentEl = document.getElementById("nlp-explanation-content");
  if (!wordSelect || !contentEl) return;

  const currentWord = wordSelect.value || state.searchTerm;
  const currentAffix = affixSelect ? affixSelect.value || "nag-" : "nag-";
  const entry = dictionaryData[currentWord];

  if (!entry) {
    contentEl.innerHTML = `<div class="cooc-empty">Walang nakitang paliwanag para sa salitang ito.</div>`;
    return;
  }

  let tagalogDesc = "";
  let warayDesc = "";

  switch(currentAffix) {
    case "nag-":
      tagalogDesc = `Sa Tagalog, ang unlaping <b>nag-</b> sa salitang "${currentWord}" ay nagpapahiwatig ng kilos na ginagawa o ginawa na (actor-focus). Halimbawa: nag${currentWord}.`;
      warayDesc = `Sa Waray, ang katumbas nito ay nagpapakita rin ng tuloy-tuloy na pagkilos o pagganap gamit ang ugat.`;
      break;
    case "um-":
      tagalogDesc = `Ang infiks o unlaping <b>um-</b> ay tumutukoy sa payak na kilos o pawatas na pokus sa aktor sa Tagalog.`;
      warayDesc = `Sa diyalektong Waray, ang mga pandiwa ay kadalasang gumagamit ng sariling sistema ng unlapi tulad ng nag- sa halip na purong um-.`;
      break;
    case "-in":
      tagalogDesc = `Ang hulaping <b>-in</b> sa Tagalog ay nagpapakita ng object-focus (layon ng pandiwa).`;
      warayDesc = `Sa Waray, ang katumbas na hulapi para dito ay kadalasang <b>-on</b> (hal. ${currentWord}on).`;
      break;
    case "-an":
      tagalogDesc = `Ang hulaping <b>-an</b> ay nagpapahiwatig ng lokasyon o direksyon kung saan nagaganap ang kilos ng salitang "${currentWord}".`;
      warayDesc = `Sa Waray, ginagamit din ang hulaping <b>-an</b> o sa pamamagitan ng paglalagay ng panlaping pang-lokasyon.`;
      break;
    case "-on":
      tagalogDesc = `Hindi gaanong ginagamit bilang direktang hulapi sa Tagalog; kadalasang pinapalitan ng <b>-in</b>.`;
      warayDesc = `Isang pangunahing hulapi sa Waray (object-focus suffix) na nagasaayos ng layon o direksyon ng salitang "${currentWord}".`;
      break;
    default:
      tagalogDesc = `Pagsusuri ng panlapi sa Tagalog para sa salitang "${currentWord}".`;
      warayDesc = `Pagsusuri ng panlapi sa Waray para sa salitang "${currentWord}".`;
  }

  contentEl.innerHTML = `
    <div style="background: var(--accent-light); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 13px; border-left: 3px solid var(--accent-gold-deep);">
      <b>Salitang-Ugat:</b> <span style="color: var(--primary-dark); font-weight: 700;">${currentWord.toUpperCase()}</span> | 
      <b>Napiling Panlapi:</b> <span style="color: var(--primary); font-weight: 700;">${currentAffix}</span>
    </div>
    <div class="dialect-compare-grid">
      <div class="dialect-card tagalog">
        <div class="dialect-card-title">Gamit sa Tagalog (${currentAffix})</div>
        <div class="dialect-card-body">${tagalogDesc}</div>
      </div>
      <div class="dialect-card waray">
        <div class="dialect-card-title">Gamit sa Waray (${currentAffix})</div>
        <div class="dialect-card-body">${warayDesc}</div>
      </div>
    </div>
  `;
}

function updateDashboard() {
  updateLanguageInfo();
  renderDataInsight();
  renderCooc();
  renderNLP();
}

document.addEventListener("DOMContentLoaded", () => {
  const corpusSelect = document.getElementById("corpus-select");
  const targetSelect = document.getElementById("target-word-select");
  const nlpSelect = document.getElementById("nlp-word-select");
  const nlpAffixSelect = document.getElementById("nlp-affix-select");
  const showDataBtn = document.getElementById("show-data-btn");
  const homeBtn = document.getElementById("home-btn");
  const homeView = document.getElementById("home-view");
  const dashboardView = document.getElementById("dashboard-view");

  if (showDataBtn && homeView && dashboardView) {
    showDataBtn.addEventListener("click", () => {
      homeView.classList.remove("active");
      dashboardView.classList.add("active");
      window.scrollTo(0, 0);
    });
  }

  if (homeBtn && homeView && dashboardView) {
    homeBtn.addEventListener("click", () => {
      dashboardView.classList.remove("active");
      homeView.classList.add("active");
      window.scrollTo(0, 0);
    });
  }

  if (corpusSelect) corpusSelect.value = state.corpus;

  if (corpusSelect) {
    corpusSelect.addEventListener("change", (e) => {
      state.corpus = e.target.value;
      updateDashboard();
    });
  }

  if (targetSelect) {
    targetSelect.addEventListener("change", (e) => {
      state.searchTerm = e.target.value.trim();
      if (nlpSelect) nlpSelect.value = state.searchTerm;
      updateAffixDropdown();
      renderCooc();
      renderDataInsight();
      renderNLP();
    });
  }

  if (nlpSelect) {
    nlpSelect.addEventListener("change", (e) => {
      state.searchTerm = e.target.value.trim();
      if (targetSelect) targetSelect.value = state.searchTerm;
      updateAffixDropdown();
      renderCooc();
      renderDataInsight();
      renderNLP();
    });
  }

  if (nlpAffixSelect) {
    nlpAffixSelect.addEventListener("change", () => {
      renderNLP();
    });
  }

  init();
});