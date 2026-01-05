import type { City, CitySearchResult } from "./dtos/city";
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
		// Clear input on focus
		searchInput.addEventListener("focus", () => {
			searchInput.value = "";
			clearResults();
		});

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
		// Home page - clear city detail
		const cityDetailDiv = document.getElementById("cityDetail");
		if (cityDetailDiv) cityDetailDiv.innerHTML = "";
	} else {
		// Extract slug from path (e.g., 76100-rouen)
		const slug = relativePath.replace(".html", "");
		await loadCityBySlug(slug);
	}
}

// Clear search results
function clearResults(): void {
	const results = document.getElementById("results");
	if (results) results.innerHTML = "";
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
                <h3>${name} (${codeDepartement})</h3>
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
		clearResults();
		// Update search input with city name
		const searchInput = document.getElementById("searchInput") as HTMLInputElement;
		if (searchInput) searchInput.value = `${city.nom_standard} (${city.code_departement})`;
	}
}

// Load and display city by slug
async function loadCityBySlug(slug: string): Promise<void> {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

	cityDetailDiv.innerHTML = '<p class="loading">Chargement...</p>';

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

	// Update search input with city name
	const searchInput = document.getElementById("searchInput") as HTMLInputElement;
	if (searchInput) searchInput.value = `${city.nom_standard} (${city.code_departement})`;

	if (!city.Analyse) {
		cityDetailDiv.innerHTML = '<p class="error">Données d\'analyse non disponibles pour cette ville</p>';
		return;
	}

	const votesDecisifs = city.Analyse["Votes décisifs"];
	const tourDecisif = city.Analyse["tour décisif"];
	const hasSecondTour = !!city["Tour 2"];

	// Get the decisive tour data
	const tourData = hasSecondTour ? city["Tour 2"]! : city["Tour 1"];
	const resultats = tourData.resultats;

	// Sort results by votes to get 1st and 2nd place
	const sortedResultats = [...resultats].sort((a, b) => b.Voix - a.Voix);
	const first = sortedResultats[0];
	const second = sortedResultats[1];

	// Build explanation for decisive votes
	let explanationDecisive = "";
	if (tourDecisif === 1 && !hasSecondTour) {
		// First round win with absolute majority
		explanationDecisive = `Si ${votesDecisifs.toLocaleString("fr-FR")} personnes supplémentaires avaient voté pour une autre liste que ${first.Liste}, menée par ${first.Prénom} ${first.Nom}, elle aurait perdu la majorité absolue des votes exprimés et un second tour aurait eu lieu.`;
	} else {
		// Second round or close race
		explanationDecisive = `Si ${votesDecisifs.toLocaleString("fr-FR")} personnes supplémentaires avaient voté pour ${second.Liste}, menée par ${second.Prénom} ${second.Nom} (${second.Voix.toLocaleString("fr-FR")} votes), elle serait passée devant ${first.Liste} menée par ${first.Prénom} ${first.Nom} (${first.Voix.toLocaleString("fr-FR")} votes).`;
	}

	// Build election source URL
	const deptCode = city.code_departement.padStart(3, "0");
	const electionSource = `https://www.archives-resultats-elections.interieur.gouv.fr/resultats/municipales-2020/${deptCode}/${city.code_insee}.php`;

	// Build explanation for non-voting
	const pop1824 = city.Analyse["Pop 18-24"];
	const pop18Plus = city.Analyse["Pop 18+"];
	const nonVotants = city.Analyse["Non votants"];
	const partNeVotantPas = city.Analyse["Part ne votant pas"];
	const explanationNonVoting = `${city.nom_standard} compte ${pop1824.toLocaleString("fr-FR")} jeunes de 18 à 24 ans et en moyenne ${(partNeVotantPas * 100).toFixed(1)}% de la population majeure n'a pas voté à ${city.nom_standard} (${nonVotants.toLocaleString("fr-FR")} non votants / ${pop18Plus.toLocaleString("fr-FR")} majeur·es).`;

	const nonVotingSource = "https://explore.data.gouv.fr/fr/datasets/6627b6fd7291f9d8a62d9997/#/resources/b8ad4a63-a4e3-4ef2-af6e-b08ef3b8084d";

	// Determine tagline based on whether there was a second round
	const mainTagline = hasSecondTour
		? "votes suffisaient<br>pour élire un autre maire"
		: "votes suffisaient<br>pour aller au second tour";

	const nonVotants1824 = Math.round(city.Analyse["Non votants de 18-24"]);

	const html = `
        <div class="city-detail">

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">
				<div class="main-number">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">
                <div class="secondary-number">${nonVotants1824.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">jeunes de 18-24 ans<br>n'ont pas voté</div>
            </div>

            <!-- CTA Button -->
            <div class="cta-section">
                <a href="https://www.service-public.fr/particuliers/vosdroits/R16396" target="_blank" class="cta-button">
                    POUR 2026,<br>INSCRIS TOI EN 1 MINUTE<span class="emoji">🔥</span>
                </a>
            </div>

            <!-- Explanation: Decisive Votes -->
            <div class="explanation-section">
                <p class="explanation-text">${explanationDecisive}</p>
                <a href="${electionSource}" target="_blank" class="source-link">${electionSource}</a>
            </div>

            <!-- Explanation: Non-Voting -->
            <div class="explanation-section white">
                <p class="explanation-text">${explanationNonVoting}</p>
                <a href="${nonVotingSource}" target="_blank" class="source-link">${nonVotingSource}</a>
            </div>
        </div>
    `;

	cityDetailDiv.innerHTML = html;
}

// Make navigateToCityById available globally for onclick handlers
declare global {
	interface Window {
		navigateToCityById: (id: number) => Promise<void>;
	}
}

window.navigateToCityById = navigateToCityById;

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
