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
    
    for (let i = 1; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      let parts = line.includes("\t") ? line.split("\t") : line.split(",");
      if (parts.length >= 2) {
        let word = parts[0].replace(/^["']|["']$/g, "").trim().toLowerCase();
        let freq = parseInt(parts[1].replace(/^["']|["']$/g, "").trim(), 10);
        
        if (word && !isNaN(freq)) {
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
    document.getElementById("top-subtext").textContent = `Paghahambing ng dalas ng mga pangunahing marker at salita.`;
    document.getElementById("colloc-heading").textContent = `Pagsusuri ng mga Pangunahing Marker (Data Insight)`;
    document.getElementById("colloc-subtext").textContent = `Pagkumpara sa estruktura ng Tagalog at Waray`;

    const topItems = dataset.slice(0, 8);
    const maxFreq = topItems[0]?.freq || 1;

    wordCloudEl.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Paghahambing ng dalas (Frequency per corpus):</div>
        ${topItems.map(item => {
          const percentage = Math.round((item.freq / maxFreq) * 100);
          return `
            <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
              <span style="width: 70px; font-weight: 600; text-align: right; color: var(--text-main);">${item.word}</span>
              <div style="flex: 1; background: var(--border-color); border-radius: 4px; height: 18px; overflow: hidden; position: relative;">
                <div style="background: var(--accent-gold-deep); width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
              </div>
              <span style="width: 70px; color: var(--text-muted); font-size: 11px;">${item.freq.toLocaleString()}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;

    collocListEl.innerHTML = `
      <div class="insight-box" style="margin-bottom: 10px; font-size: 13px;">
        <b>Estrukturang Pagsusuri:</b> Ang bar chart na ito ay nagpapakita ng mga pangunahing pananda sa ${state.corpus} corpus.
      </div>
      <div class="colloc-row"><span>Kabuuang Malinis na Salita:</span> <span class="colloc-count">${dataset.length.toLocaleString()}</span></div>
    `;

  } else if (state.viewMode === "anomaly") {
    document.getElementById("freq-heading").textContent = `Cross-Dialect Corpus Comparison: "${state.searchTerm}"`;
    document.getElementById("top-subtext").textContent = `Direktang paghahambing ng dalas ng salita sa pagitan ng Tagalog at Waray Wikipedia corpus.`;
    document.getElementById("colloc-heading").textContent = `Linguistic Contrast & Matching`;
    document.getElementById("colloc-subtext").textContent = `Paghahambing ng paggamit sa dalawang wika`;

    const term = state.searchTerm.toLowerCase();
    const tglMatch = corpusData.Tagalog.find(item => item.word === term) || { word: term, freq: 0 };
    const warMatch = corpusData.Waray.find(item => item.word === term) || { word: term, freq: 0 };

    const maxVal = Math.max(tglMatch.freq, warMatch.freq, 1);
    const tglPct = Math.round((tglMatch.freq / maxVal) * 100);
    const warPct = Math.round((warMatch.freq / maxVal) * 100);

    const defEntry = dictionaryData[term] || {
      tagalog: "Walang tiyak na kahulugan sa lokal na diksyunaryo.",
      waray: "Walang tiyak na kahulugan sa lokal na diksyunaryo."
    };

    wordCloudEl.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; padding: 10px 0;">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Paghahambing ng frequency para sa salitang: <b style="color: var(--text-main);">"${state.searchTerm}"</b></div>
        
        <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
          <span style="width: 70px; font-weight: 600; text-align: right; color: var(--text-main);">Tagalog</span>
          <div style="flex: 1; background: var(--border-color); border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
            <div style="background: var(--secondary-blue); width: ${tglPct}%; height: 100%; border-radius: 4px;"></div>
          </div>
          <span style="width: 70px; color: var(--text-muted); font-size: 11px;">${tglMatch.freq.toLocaleString()}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
          <span style="width: 70px; font-weight: 600; text-align: right; color: var(--text-main);">Waray</span>
          <div style="flex: 1; background: var(--border-color); border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
            <div style="background: var(--accent-gold-deep); width: ${warPct}%; height: 100%; border-radius: 4px;"></div>
          </div>
          <span style="width: 70px; color: var(--text-muted); font-size: 11px;">${warMatch.freq.toLocaleString()}</span>
        </div>
      </div>
    `;

    collocListEl.innerHTML = `
      <div class="insight-box" style="margin-bottom: 10px; font-size: 13px; line-height: 1.5;">
        <b>Kahulugan mula sa Diksyunaryo:</b><br>
        • <b>Tagalog:</b> ${defEntry.tagalog}<br>
        • <b>Waray:</b> ${defEntry.waray}
      </div>
      <div class="colloc-row"><span>Tagalog Frequency:</span> <span class="colloc-count" style="color: var(--secondary-blue);">${tglMatch.freq.toLocaleString()}</span></div>
      <div class="colloc-row"><span>Waray Frequency:</span> <span class="colloc-count" style="color: var(--accent-gold-deep);">${warMatch.freq.toLocaleString()}</span></div>
    `;

  } else if (state.viewMode === "nlp") {
    document.getElementById("freq-heading").textContent = `NLP Preprocessing & Noise Reduction Pipeline`;
    document.getElementById("top-subtext").textContent = `Paghahanda ng corpus bago isalang sa AI Translation model.`;
    document.getElementById("colloc-heading").textContent = `Paghahanda para sa Pagsasalin`;
    document.getElementById("colloc-subtext").textContent = `Subukan ang interactive text cleaner sa ibaba`;

    wordCloudEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <div style="background: var(--accent-light); color: var(--text-main); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); border-left: 3px solid var(--secondary-blue);">
          <b>1. Token Filtering:</b> Pagtanggal ng mga bantas at hindi kinakailangang karakter mula sa corpus.
        </div>
        <div style="background: var(--accent-light); color: var(--text-main); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); border-left: 3px solid var(--accent-gold-deep);">
          <b>2. Lemmatization:</b> Pag-normalize ng mga pandiwa patungo sa kanilang salitang-ugat.
        </div>
      </div>
    `;

    collocListEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="insight-box" style="font-size: 13px;">
          <b>Gawain — Paghahanda para sa Pagsasalin:</b><br>
          I-edit ang teksto sa ibaba at i-click ang button upang linisin ang morpolohikal na ingay.
        </div>
        <textarea id="taglishInput" style="width: 100%; min-height: 90px; background: var(--input-bg); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; font-family: inherit; font-size: 13px; resize: vertical;">Kapag nag-aaral ako, parang gustong-gusto kong mag-relax muna, so nagbabasa ako ng libro. Actually, mas gusto ko ring kumakain ng meryenda while nagbabasa.</textarea>
        <button id="cleanBtn" style="background: var(--accent-gold-deep); color: var(--primary-dark); border: none; padding: 10px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer;">Linisin ang Teksto para sa AI</button>
        <div id="cleanOutput" style="background: var(--accent-light); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; display: none;"></div>
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
              return `<mark style="background: rgba(224,166,40,0.3); color: var(--primary-dark); padding: 0 3px; border-radius: 3px; font-weight: 700;">${root}</mark>`;
            });
          });
          
          fillerWords.forEach(fw => {
            const re = new RegExp(`\\b${fw}\\b,?`, "gi");
            html = html.replace(re, m => {
              changes.push(`inalis: "${m.trim()}"`);
              return `<mark style="background: rgba(163,31,34,0.16); color: var(--primary); text-decoration: line-through; padding: 0 3px; border-radius: 3px;">${m}</mark>`;
            });
          });

          const out = document.getElementById("cleanOutput");
          out.style.display = "block";
          out.innerHTML = `<div style="margin-bottom: 8px;"><b style="color: var(--text-main);">Resulta:</b><br>${html}</div>` +
            (changes.length ? `<div style="font-size: 11px; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 6px;"><b style="color: var(--text-main);">Mga Binago (${changes.length}):</b><br>${changes.join("<br>")}</div>` : ``);
        });
      }
    }, 50);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const corpusSelect = document.getElementById("corpus-select");
  const targetSelect = document.getElementById("target-word-select");
  const tabButtons = document.querySelectorAll(".tab-btn");

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