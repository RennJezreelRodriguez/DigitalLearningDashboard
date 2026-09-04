let corpusData = {
  Tagalog: [],
  Waray: []
};

let dictionaryData = {};

let state = {
  corpus: "Tagalog",
  searchTerm: "basa",
  viewMode: "cloud"
};

async function loadCSV(filename) {
  try {
    const response = await fetch(filename);
    const text = await response.text();
    const lines = text.split("\n");
    let parsed = [];
    
    for (let i = 2; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      let parts = line.includes("\t") ? line.split("\t") : line.split(",");
      if (parts.length >= 2) {
        let word = parts[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
        let freq = parseInt(parts[1].replace(/^["']|["']$/g, "").trim(), 10);
        
        if (word && !isNaN(freq) && /^[a-zA-Zà-ÿÀ-ßñÑ]+$/.test(word)) {
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
    const response = await fetch("dictionary.json");
    dictionaryData = await response.json();
  } catch (err) {
    console.error("Hindi ma-load ang dictionary.json", err);
  }
}

async function init() {
  document.getElementById("status-text").textContent = "Nilo-load ang mga CSV datasets at diksyunaryo...";
  
  const [tgl, war] = await Promise.all([
    loadCSV("Data/wordlist_tgl_wikipedia_2021_20260904060133.csv"),
    loadCSV("Data/wordlist_war_wikipedia_2021_20260904060844.csv"),
    loadDictionary()
  ]);

  corpusData.Tagalog = tgl;
  corpusData.Waray = war;

  document.getElementById("status-text").textContent = `Tagalog (${tgl.length} salita) at Waray (${war.length} salita) ay handa na!`;
  updateDashboard();
}

function updateDashboard() {
  const dataset = corpusData[state.corpus];
  if (!dataset || dataset.length === 0) return;

  const wordCloudEl = document.getElementById("word-cloud");
  const collocListEl = document.getElementById("colloc-list");
  const searchContainer = document.getElementById("search-container");
  
  if (state.viewMode === "anomaly") {
    searchContainer.style.display = "block";
  } else {
    searchContainer.style.display = "none";
  }

  if (state.viewMode === "cloud") {
    document.getElementById("freq-heading").textContent = `Graphical Trend: Frequency Bar Chart (${state.corpus})`;
    document.getElementById("top-subtext").textContent = `Paghahambing ng dalas ng mga pangunahing marker (tulad ng "sa", "ng", "han", "an").`;
    document.getElementById("colloc-heading").textContent = `Pagsusuri ng mga Pangunahing Marker (Data Insight)`;
    document.getElementById("colloc-subtext").textContent = `Pagkumpara sa estruktura ng Tagalog at Waray`;

    const topItems = dataset.slice(0, 8);
    const maxFreq = topItems[0]?.freq || 1;

    wordCloudEl.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 11px; color: #6b6255; margin-bottom: 4px;">Paghahambing ng dalas (Frequency per corpus):</div>
        ${topItems.map(item => {
          const percentage = Math.round((item.freq / maxFreq) * 100);
          return `
            <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
              <span style="width: 60px; font-weight: 600; text-align: right;">${item.word}</span>
              <div style="flex: 1; background: #eae1cf; border-radius: 4px; height: 18px; overflow: hidden; position: relative;">
                <div style="background: #C86D33; width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
              </div>
              <span style="width: 70px; color: #6b6255; font-size: 11px;">${item.freq.toLocaleString()}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;

    collocListEl.innerHTML = `
      <div class="insight-box">
        <b>Estrukturang Pagsusuri:</b> Ang bar chart na ito ay nagpapakita ng mga pangunahing pananda sa ${state.corpus}. Ayon sa mga gabay, ang mataas na frequency ng mga marker ay nagpapakita ng pagkakaiba sa estruktura at ugnayan ng mga salita.
      </div>
      <div class="colloc-row"><span>Kabuuang Malinis na Salita:</span> <span class="colloc-count">${dataset.length.toLocaleString()}</span></div>
    `;

  } else if (state.viewMode === "anomaly") {
    document.getElementById("freq-heading").textContent = `Cross-Dialect Corpus Comparison: "${state.searchTerm}"`;
    document.getElementById("top-subtext").textContent = `Direktang paghahambing ng dalas ng salita sa pagitan ng Tagalog at Waray Wikipedia Leipzig corpus.`;
    document.getElementById("colloc-heading").textContent = `Linguistic Contrast & Matching`;
    document.getElementById("colloc-subtext").textContent = `Paghahambing ng paggamit sa dalawang wika`;

    const term = state.searchTerm.toLowerCase();
    const tglMatch = corpusData.Tagalog.find(item => item.word === term) || { word: term, freq: 0 };
    const warMatch = corpusData.Waray.find(item => item.word === term) || { word: term, freq: 0 };

    const maxVal = Math.max(tglMatch.freq, warMatch.freq, 1);
    const tglPct = Math.round((tglMatch.freq / maxVal) * 100);
    const warPct = Math.round((warMatch.freq / maxVal) * 100);

    const defEntry = dictionaryData[term] || {
      tagalog: "Walang tiyak na kahulugan sa lokal na diksyunaryo (nakabatay sa frequency frequency lamang).",
      waray: "Walang tiyak na kahulugan sa lokal na diksyunaryo (nakabatay sa frequency frequency lamang)."
    };

    wordCloudEl.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; padding: 10px 0;">
        <div style="font-size: 12px; color: #6b6255; margin-bottom: 4px;">Paghahambing ng frequency para sa salitang: <b>"${state.searchTerm}"</b></div>
        
        <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
          <span style="width: 70px; font-weight: 600; text-align: right;">Tagalog</span>
          <div style="flex: 1; background: #eae1cf; border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
            <div style="background: #1A2E40; width: ${tglPct}%; height: 100%; border-radius: 4px;"></div>
          </div>
          <span style="width: 70px; color: #6b6255; font-size: 11px;">${tglMatch.freq.toLocaleString()}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
          <span style="width: 70px; font-weight: 600; text-align: right;">Waray</span>
          <div style="flex: 1; background: #eae1cf; border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
            <div style="background: #C86D33; width: ${warPct}%; height: 100%; border-radius: 4px;"></div>
          </div>
          <span style="width: 70px; color: #6b6255; font-size: 11px;">${warMatch.freq.toLocaleString()}</span>
        </div>
      </div>
    `;

    collocListEl.innerHTML = `
      <div class="insight-box">
        <b>Kahulugan mula sa Diksyunaryo:</b><br>
        • <b>Tagalog:</b> ${defEntry.tagalog}<br>
        • <b>Waray:</b> ${defEntry.waray}
      </div>
      <div class="colloc-row"><span>Tagalog Frequency:</span> <span class="colloc-count">${tglMatch.freq.toLocaleString()}</span></div>
      <div class="colloc-row"><span>Waray Frequency:</span> <span class="colloc-count">${warMatch.freq.toLocaleString()}</span></div>
    `;

  } else if (state.viewMode === "nlp") {
    document.getElementById("freq-heading").textContent = `NLP Preprocessing & Noise Reduction Pipeline`;
    document.getElementById("top-subtext").textContent = `Paghahanda ng corpus bago isalang sa AI Translation model.`;
    document.getElementById("colloc-heading").textContent = `Paghahanda para sa Pagsasalin`;
    document.getElementById("colloc-subtext").textContent = `Subukan ang interactive text cleaner sa ibaba`;

    wordCloudEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <div style="background: #FAF4EF; padding: 10px; border-radius: 6px; border-left: 3px solid #1A2E40;">
          <b>1. Token Filtering:</b> Pagtanggal ng mga bantas at hindi kinakailangang karakter mula sa corpus.
        </div>
        <div style="background: #FAF4EF; padding: 10px; border-radius: 6px; border-left: 3px solid #C86D33;">
          <b>2. Lemmatization:</b> Pag-normalize ng mga pandiwa patungo sa kanilang salitang-ugat (hal. <i>kumakain → kain</i>).
        </div>
      </div>
    `;

    collocListEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="insight-box" style="margin-bottom:0;">
          <b>Gawain — Paghahanda para sa Pagsasalin:</b><br>
          I-edit ang teksto sa ibaba at i-click ang button upang linisin ang morpolohikal na ingay at code-switching.
        </div>
        <textarea id="taglishInput" style="width: 100%; min-height: 90px; background: var(--input-bg); color: var(--text-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px; font-family: var(--font-ui); font-size: 13px; resize: vertical;">Kapag nag-aaral ako, parang gustong-gusto kong mag-relax muna, so nagbabasa ako ng libro. Actually, mas gusto ko ring kumakain ng meryenda while nagbabasa.</textarea>
        <button id="cleanBtn" style="background: var(--primary); color: #F5F0EB; border: none; padding: 10px 16px; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer;">Linisin ang Teksto para sa AI</button>
        <div id="cleanOutput" style="background: var(--input-bg); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 13px; line-height: 1.6; display: none;"></div>
      </div>
    `;

    setTimeout(() => {
      const cleanBtn = document.getElementById("cleanBtn");
      if (cleanBtn) {
        cleanBtn.addEventListener("click", () => {
          const inputVal = document.getElementById("taglishInput").value;
          const rootMap = [{ pattern: /\b(kumakain|kakain|nangaon|mangaon)\b/gi, root: "kain/kaon" }];
          const fillerWords = ["so", "actually", "like", "while", "basically"];
          
          let html = inputVal;
          let changes = [];
          
          rootMap.forEach(({ pattern, root }) => {
            html = html.replace(pattern, m => {
              changes.push(`${m} → ${root}`);
              return `<mark style="background: rgba(200,109,51,0.15); color: var(--accent); padding: 0 3px; border-radius: 3px; font-weight: 600;">${root}</mark>`;
            });
          });
          
          fillerWords.forEach(fw => {
            const re = new RegExp(`\\b${fw}\\b,?`, "gi");
            html = html.replace(re, m => {
              changes.push(`inalis: "${m.trim()}"`);
              return `<mark style="background: rgba(180,50,50,0.12); color: #b43232; text-decoration: line-through; padding: 0 3px; border-radius: 3px;">${m}</mark>`;
            });
          });

          const out = document.getElementById("cleanOutput");
          out.style.display = "block";
          out.innerHTML = `<div style="margin-bottom: 8px;"><b>Resulta:</b><br>${html}</div>` +
            (changes.length ? `<div style="font-size: 11px; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 6px;"><b>Mga Binago (${changes.length}):</b><br>${changes.join("<br>")}</div>` : ``);
        });
      }
    }, 50);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const corpusSelect = document.getElementById("corpus-select");
  const targetInput = document.getElementById("target-word-input");
  const tabButtons = document.querySelectorAll(".tab-btn");

  if (corpusSelect) corpusSelect.value = state.corpus;
  if (targetInput) targetInput.value = state.searchTerm;

  if (corpusSelect) {
    corpusSelect.addEventListener("change", (e) => {
      state.corpus = e.target.value;
      updateDashboard();
    });
  }

  if (targetInput) {
    targetInput.addEventListener("input", (e) => {
      state.searchTerm = e.target.value.trim();
      updateDashboard();
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.viewMode = btn.getAttribute("data-mode");
      updateDashboard();
    });
  });

  init();
});