import type { City, CitySearchResult, TourData } from "./dtos/city";
import { normalizeText } from "./utils";

// Get the base path for assets (handles GitHub Pages subdirectory deployment)
const getBasePath = (): string => {
	const path = window.location.pathname;
	// If we're at /OEP/ or /OEP/something, base is /OEP/
	// If we're at / or /something, base is /
	const match = path.match(/^(\/[^/]+\/)/);
	if (match && match[1] !== "/") {
		return match[1];
	}
	return "/";
};

const BASE_PATH = getBasePath();

// Router and app state
let searchTimeout: number | null = null;

// Cache for loaded data
const searchIndexCache: Record<string, Record<string, CitySearchResult[]>> = {};
let citiesDataCache: Record<number, City> | null = null;
let slugMapCache: Record<string, number> | null = null;

// Get partition key for a query (first character)
function getPartitionKey(query: string): string {
	const firstChar = query.charAt(0).toLowerCase();
	if (firstChar >= "a" && firstChar <= "z") {
		return firstChar;
	}
	return "0"; // Numbers and other characters
}

// Load a search partition if not already cached
async function loadSearchPartition(
	partition: string,
): Promise<Record<string, CitySearchResult[]>> {
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

// Load cities data if not already cached
async function loadCitiesData(): Promise<Record<number, City>> {
	if (citiesDataCache) {
		return citiesDataCache;
	}
	const response = await fetch(`${BASE_PATH}cities/cities-data.json`);
	if (!response.ok) {
		throw new Error("Failed to load cities data");
	}
	citiesDataCache = await response.json();
	return citiesDataCache!;
}

// Load slug map if not already cached
async function loadSlugMap(): Promise<Record<string, number>> {
	if (slugMapCache) {
		return slugMapCache;
	}
	const response = await fetch(`${BASE_PATH}cities/slug-map.json`);
	if (!response.ok) {
		throw new Error("Failed to load slug map");
	}
	slugMapCache = await response.json();
	return slugMapCache!;
}

// Debounce function
function debounce(func: () => void, delay: number): () => void {
	return () => {
		if (searchTimeout !== null) {
			clearTimeout(searchTimeout);
		}
		searchTimeout = window.setTimeout(() => func(), delay);
	};
}

// Initialize the app
function init(): void {
	// Handle initial route
	handleRoute();

	// Listen for browser back/forward
	window.addEventListener("popstate", handleRoute);

	// Real-time search as user types
	const searchInput = document.getElementById(
		"searchInput",
	) as HTMLInputElement;
	if (searchInput) {
		searchInput.addEventListener(
			"input",
			debounce(() => {
				searchCities();
			}, 80),
		);

		// Also handle Enter key
		searchInput.addEventListener("keypress", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				if (searchTimeout !== null) {
					clearTimeout(searchTimeout);
				}
				searchCities();
			}
		});
	}
}

// Handle routing based on current URL
async function handleRoute(): Promise<void> {
	const path = window.location.pathname;
	// Remove base path to get the relative path
	const relativePath = path.startsWith(BASE_PATH)
		? path.slice(BASE_PATH.length)
		: path.substring(1);

	if (relativePath === "" || relativePath === "index.html") {
		showSearchView();
	} else {
		// Extract slug from path (e.g., 76100-rouen)
		const slug = relativePath.replace(".html", "");
		await loadCityBySlug(slug);
	}
}

// Show search view
function showSearchView(): void {
	const searchView = document.getElementById("searchView");
	const cityView = document.getElementById("cityView");
	const results = document.getElementById("results");

	if (searchView) searchView.classList.remove("hidden");
	if (cityView) cityView.classList.add("hidden");
	if (results) results.innerHTML = "";
}

// Show city view
function showCityView(): void {
	const searchView = document.getElementById("searchView");
	const cityView = document.getElementById("cityView");

	if (searchView) searchView.classList.add("hidden");
	if (cityView) cityView.classList.remove("hidden");
}

// Go back to search
function goBack(): void {
	window.history.pushState({}, "", BASE_PATH);
	showSearchView();
}

// Search cities by name or postal code
async function searchCities(): Promise<void> {
	const searchInput = document.getElementById(
		"searchInput",
	) as HTMLInputElement;
	const resultsDiv = document.getElementById("results");

	if (!searchInput || !resultsDiv) return;

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

		const citiesData: CitySearchResult[] = searchIndex[normalized];

		if (!citiesData || citiesData.length === 0) {
			resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
			return;
		}

		// Display results directly from search data (no need to fetch each city)
		displaySearchResults(citiesData.slice(0, 50));
	} catch (error) {
		console.error("Search error:", error);
		resultsDiv.innerHTML = '<p class="error">Erreur lors de la recherche</p>';
	}
}

// Fetch city by ID
async function fetchCityById(id: number): Promise<City | null> {
	try {
		const citiesData = await loadCitiesData();
		return citiesData[id] || null;
	} catch (error) {
		console.error(`Error fetching city ${id}:`, error);
		return null;
	}
}

// Fetch city by slug
async function fetchCityBySlug(slug: string): Promise<City | null> {
	try {
		const slugMap = await loadSlugMap();
		const id = slugMap[slug];
		if (id === undefined) return null;
		return fetchCityById(id);
	} catch (error) {
		console.error(`Error fetching city ${slug}:`, error);
		return null;
	}
}

// Display search results
function displaySearchResults(cities: CitySearchResult[]): void {
	const resultsDiv = document.getElementById("results");

	if (!resultsDiv) return;

	if (cities.length === 0) {
		resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
		return;
	}

	// cities is now an array of [id, name, code_departement]
	const html = cities
		.map((city) => {
			const [id, name, codeDepartement] = city;
			return `
            <div class="result-item" onclick="navigateToCityById(${id})">
                <h3>${name}</h3>
                <p>Département: ${codeDepartement}</p>
            </div>
        `;
		})
		.join("");

	resultsDiv.innerHTML = html;
}

// Navigate to city page by ID
async function navigateToCityById(id: number): Promise<void> {
	// First load the city to get its slug
	const city = await fetchCityById(id);
	if (city?.slug) {
		window.history.pushState({}, "", `${BASE_PATH}${city.slug}`);
		displayCityDetail(city);
		showCityView();
	}
}

// Load and display city by slug
async function loadCityBySlug(slug: string): Promise<void> {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

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
		cityDetailDiv.innerHTML =
			'<p class="error">Erreur lors du chargement de la ville</p>';
	}
}

// Display city detail
function displayCityDetail(city: City): void {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

	let toursHtml = "";

	// Tour 1
	if (city["Tour 1"]) {
		toursHtml += generateTourHtml("Tour 1", city["Tour 1"]);
	}

	// Tour 2
	if (city["Tour 2"]) {
		toursHtml += generateTourHtml("Tour 2", city["Tour 2"]);
	}

	const analyseHtml = city.Analyse
		? `
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
        `
		: "";

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

// Generate HTML for a tour
function generateTourHtml(tourName: string, tourData: TourData): string {
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
                    ${tourData.resultats
						.map(
							(result) => `
                        <tr>
                            <td>${result.Liste}</td>
                            <td>${result.Prénom} ${result.Nom}</td>
                            <td>${result["Code Nuance"]}</td>
                            <td>${result.Voix.toLocaleString()}</td>
                            <td>${result["% Voix/Exp"].toFixed(2)}%</td>
                            <td>${result["% Voix/Ins"].toFixed(2)}%</td>
                            <td>${result["Sièges / Elu"]}</td>
                        </tr>
                    `,
						)
						.join("")}
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

// Make navigateToCityById available globally for onclick handlers
declare global {
	interface Window {
		navigateToCityById: (id: number) => Promise<void>;
		goBack: () => void;
	}
}

window.navigateToCityById = navigateToCityById;
window.goBack = goBack;

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
