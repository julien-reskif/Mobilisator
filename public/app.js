// src/utils.ts
var normalizeText = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[''`]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/\s+/g, "-").trim();

// src/app.ts
var getBasePath = () => {
  const path = window.location.pathname;
  const match = path.match(/^(\/[^/]+\/)/);
  if (match && match[1] !== "/") {
    return match[1];
  }
  return "/";
};
var BASE_PATH = getBasePath();
var searchTimeout = null;
var searchIndexCache = {};
var citiesDataCache = null;
var slugMapCache = null;
function getPartitionKey(query) {
  const firstChar = query.charAt(0).toLowerCase();
  if (firstChar >= "a" && firstChar <= "z") {
    return firstChar;
  }
  return "0";
}
async function loadSearchPartition(partition) {
  if (searchIndexCache[partition]) {
    return searchIndexCache[partition];
  }
  const response = await fetch(`${BASE_PATH}cities/search-${partition}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load search partition ${partition}`);
  }
  const data = await response.json();
  searchIndexCache[partition] = data;
  return data;
}
async function loadCitiesData() {
  if (citiesDataCache) {
    return citiesDataCache;
  }
  const response = await fetch(`${BASE_PATH}cities/cities-data.json`);
  if (!response.ok) {
    throw new Error("Failed to load cities data");
  }
  citiesDataCache = await response.json();
  return citiesDataCache;
}
async function loadSlugMap() {
  if (slugMapCache) {
    return slugMapCache;
  }
  const response = await fetch(`${BASE_PATH}cities/slug-map.json`);
  if (!response.ok) {
    throw new Error("Failed to load slug map");
  }
  slugMapCache = await response.json();
  return slugMapCache;
}
function debounce(func, delay) {
  return () => {
    if (searchTimeout !== null) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = window.setTimeout(() => func(), delay);
  };
}
function init() {
  handleRoute();
  window.addEventListener("popstate", handleRoute);
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      searchCities();
    }, 80));
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (searchTimeout !== null) {
          clearTimeout(searchTimeout);
        }
        searchCities();
      }
    });
  }
}
async function handleRoute() {
  const path = window.location.pathname;
  const relativePath = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path.substring(1);
  if (relativePath === "" || relativePath === "index.html") {
    showSearchView();
  } else {
    const slug = relativePath.replace(".html", "");
    await loadCityBySlug(slug);
  }
}
function showSearchView() {
  const searchView = document.getElementById("searchView");
  const cityView = document.getElementById("cityView");
  const results = document.getElementById("results");
  if (searchView)
    searchView.classList.remove("hidden");
  if (cityView)
    cityView.classList.add("hidden");
  if (results)
    results.innerHTML = "";
}
function showCityView() {
  const searchView = document.getElementById("searchView");
  const cityView = document.getElementById("cityView");
  if (searchView)
    searchView.classList.add("hidden");
  if (cityView)
    cityView.classList.remove("hidden");
}
function goBack() {
  window.history.pushState({}, "", BASE_PATH);
  showSearchView();
}
async function searchCities() {
  const searchInput = document.getElementById("searchInput");
  const resultsDiv = document.getElementById("results");
  if (!searchInput || !resultsDiv)
    return;
  const query = searchInput.value;
  if (!query || query.trim().length < 2) {
    resultsDiv.innerHTML = "";
    return;
  }
  resultsDiv.innerHTML = '<p class="loading">Recherche en cours...</p>';
  try {
    const normalized = normalizeText(query);
    const partition = getPartitionKey(normalized);
    const searchIndex = await loadSearchPartition(partition);
    const citiesData = searchIndex[normalized];
    if (!citiesData || citiesData.length === 0) {
      resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
      return;
    }
    displaySearchResults(citiesData.slice(0, 50));
  } catch (error) {
    console.error("Search error:", error);
    resultsDiv.innerHTML = '<p class="error">Erreur lors de la recherche</p>';
  }
}
async function fetchCityById(id) {
  try {
    const citiesData = await loadCitiesData();
    return citiesData[id] || null;
  } catch (error) {
    console.error(`Error fetching city ${id}:`, error);
    return null;
  }
}
async function fetchCityBySlug(slug) {
  try {
    const slugMap = await loadSlugMap();
    const id = slugMap[slug];
    if (id === undefined)
      return null;
    return fetchCityById(id);
  } catch (error) {
    console.error(`Error fetching city ${slug}:`, error);
    return null;
  }
}
function displaySearchResults(cities) {
  const resultsDiv = document.getElementById("results");
  if (!resultsDiv)
    return;
  if (cities.length === 0) {
    resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
    return;
  }
  const html = cities.map((city) => {
    const [id, name, codeDepartement] = city;
    return `
            <div class="result-item" onclick="navigateToCityById(${id})">
                <h3>${name}</h3>
                <p>Département: ${codeDepartement}</p>
            </div>
        `;
  }).join("");
  resultsDiv.innerHTML = html;
}
async function navigateToCityById(id) {
  const city = await fetchCityById(id);
  if (city?.slug) {
    window.history.pushState({}, "", `${BASE_PATH}${city.slug}`);
    displayCityDetail(city);
    showCityView();
  }
}
async function loadCityBySlug(slug) {
  const cityDetailDiv = document.getElementById("cityDetail");
  if (!cityDetailDiv)
    return;
  cityDetailDiv.innerHTML = '<p class="loading">Chargement...</p>';
  showCityView();
  try {
    const city = await fetchCityBySlug(slug);
    if (!city) {
      cityDetailDiv.innerHTML = '<p class="error">Ville non trouvée</p>';
      return;
    }
    displayCityDetail(city);
  } catch (error) {
    console.error("Error loading city:", error);
    cityDetailDiv.innerHTML = '<p class="error">Erreur lors du chargement de la ville</p>';
  }
}
function displayCityDetail(city) {
  const cityDetailDiv = document.getElementById("cityDetail");
  if (!cityDetailDiv)
    return;
  let toursHtml = "";
  if (city["Tour 1"]) {
    toursHtml += generateTourHtml("Tour 1", city["Tour 1"]);
  }
  if (city["Tour 2"]) {
    toursHtml += generateTourHtml("Tour 2", city["Tour 2"]);
  }
  const analyseHtml = city.Analyse ? `
            <div class="analyse-section">
                <h3>Analyse</h3>
                <div class="info-item">
                    <div class="info-label">Votes décisifs</div>
                    <div class="info-value">${city.Analyse["Votes décisifs"].toLocaleString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Non votants de 18-24</div>
                    <div class="info-value">${Math.round(city.Analyse["Non votants de 18-24"]).toLocaleString()}</div>
                </div>
            </div>
        ` : "";
  const html = `
        <div class="city-detail">
            <h2>${city.nom_standard}</h2>
            <div class="city-info">
                <div class="info-item">
                    <div class="info-label">Département</div>
                    <div class="info-value">${city.code_departement} - ${city.libelle_departement}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Code commune</div>
                    <div class="info-value">${city.code_commune}</div>
                </div>
            </div>
            ${analyseHtml}
            ${toursHtml}
        </div>
    `;
  cityDetailDiv.innerHTML = html;
}
function generateTourHtml(tourName, tourData) {
  const stats = `
        <div class="tour-stats">
            <h4>Statistiques</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Inscrits</span>
                    <span class="stat-value">${tourData.Inscrits.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Votants</span>
                    <span class="stat-value">${tourData.Votants.toLocaleString()} (${tourData["% Vot/Ins"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Abstentions</span>
                    <span class="stat-value">${tourData.Abstentions.toLocaleString()} (${tourData["% Abs/Ins"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Exprimés</span>
                    <span class="stat-value">${tourData.Exprimés.toLocaleString()} (${tourData["% Exp/Ins"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Blancs</span>
                    <span class="stat-value">${tourData.Blancs.toLocaleString()} (${tourData["% Blancs/Vot"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Nuls</span>
                    <span class="stat-value">${tourData.Nuls.toLocaleString()} (${tourData["% Nuls/Vot"].toFixed(2)}%)</span>
                </div>
            </div>
        </div>
    `;
  const results = `
        <div class="tour-results">
            <h4>Résultats</h4>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Liste</th>
                        <th>Tête de liste</th>
                        <th>Nuance</th>
                        <th>Voix</th>
                        <th>% Voix/Exp</th>
                        <th>% Voix/Ins</th>
                        <th>Sièges</th>
                    </tr>
                </thead>
                <tbody>
                    ${tourData.resultats.map((result) => `
                        <tr>
                            <td>${result.Liste}</td>
                            <td>${result.Prénom} ${result.Nom}</td>
                            <td>${result["Code Nuance"]}</td>
                            <td>${result.Voix.toLocaleString()}</td>
                            <td>${result["% Voix/Exp"].toFixed(2)}%</td>
                            <td>${result["% Voix/Ins"].toFixed(2)}%</td>
                            <td>${result["Sièges / Elu"]}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
  return `
        <div class="tour-section">
            <h3>${tourName}</h3>
            ${stats}
            ${results}
        </div>
    `;
}
window.navigateToCityById = navigateToCityById;
window.goBack = goBack;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
