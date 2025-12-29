import { rm } from "node:fs/promises";

import type { FullCity, RawCity } from "./dtos/city";
import { fullCityToCity, normalizeText } from "./utils";

const MAX_CITIES_PER_NGRAM = 20;
const MIN_NGRAMS = 2;
const NB_NGRAMS = 45;

const outputDirectoryPath =
	"./public/cities";
const inputPath =
	"./communes.json";
const inputFile = Bun.file(inputPath);

interface Indexable {
	id: number;
}

export const createSearchIndex = (
	cities: FullCity[],
): Map<string, number[]> => {
	const searchIndex: Map<string, number[]> = new Map();

	const addStringToIndex = (index: Indexable) => (str: string) =>
		tokenizeText(str)
			.map(createNGrams)
			.reduce((acc, ngrams) => {
				ngrams.forEach((ngram) => {
					acc.add(ngram);
				});
				return acc;
			}, new Set())
			.forEach(addToIndex(searchIndex)(index));

	cities.forEach((city: FullCity) => {
		const addStringToFullCityIndex = addStringToIndex(city);

		[city.nom_standard, city.nom_sans_pronom, city.code_postal].forEach(
			addStringToFullCityIndex,
		);
		city.codes_postaux.forEach(addStringToFullCityIndex);
	});
	return searchIndex;
};

const addToIndex =
	(searchIndex: Map<string, number[]>) =>
	(indexable: Indexable) =>
	(key: string) => {
		if (!searchIndex.has(key)) {
			searchIndex.set(key, []);
		}
		const found =
			searchIndex.get(key)?.find((item) => item === indexable.id) ?? false;

		if (!found) {
			searchIndex.get(key)?.push(indexable.id);
		}
	};

export const tokenizeText = (text: string): string[] => {
	return normalizeText(text)
		.split(" ")
		.filter((token: string) => token.length > 0)
		.map((token: string) => token.toLowerCase());
};

export const createNGrams = (token: string): Set<string> => {
	const nGrams: Set<string> = new Set();
	for (let nx = MIN_NGRAMS; nx <= NB_NGRAMS; nx++) {
		nGrams.add(token.slice(0, nx));
	}
	if (token.length > NB_NGRAMS) {
		nGrams.add(token);
	}
	return nGrams;
};

const startTime = performance.now();

const communes = await inputFile.json();
const rawCities: RawCity[] = communes.data;
const cities: FullCity[] = rawCities
	.filter((city) => !!city && !!city.nom_sans_pronom)
	.map((city, idx) => {
		if (city.code_postal === null && city.codes_postaux !== null) {
			city.code_postal = city.codes_postaux.split(", ")[0];
		}

		return {
			id: idx + 1,
			normalized_name: normalizeText(city.nom_sans_pronom),
			nom_standard: city.nom_standard,
			nom_sans_pronom: city.nom_sans_pronom,
			code_postal: city.code_postal ?? "",
			codes_postaux: city.codes_postaux?.split(", ") ?? [],
			superficie_km2: city.superficie_km2,
		};
	});

const searchIndex: Map<string, number[]> = createSearchIndex(cities);

const citiesById = Object.fromEntries(cities.map((c) => [c.id, c]));
const citiesIndex = Array.from(searchIndex.entries()).map(([k, v]) => [
	k,
	v
		.sort(
			(a, b) =>
				citiesById[a].nom_standard.length - citiesById[b].nom_standard.length,
		)
		.slice(0, MAX_CITIES_PER_NGRAM)
		.map((i) => [i, citiesById[i].nom_standard, citiesById[i].code_postal]),
]);
const searchIndexJsonString = JSON.stringify(Object.fromEntries(citiesIndex));

await rm(outputDirectoryPath, { recursive: true, force: true });

for (const [k, v] of citiesIndex) {
	const fileLocation = `${outputDirectoryPath}/search/${k}.json`;
	Bun.write(fileLocation, JSON.stringify(v));
}

for (const fullFullCity of cities) {
	const city = fullCityToCity(fullFullCity);
	const fileLocation = `${outputDirectoryPath}/${city.id}.json`;
	const prettyFileLocation = `${outputDirectoryPath}/${city.slug}.json`;
	Bun.write(fileLocation, JSON.stringify(city));
	Bun.write(prettyFileLocation, JSON.stringify(city));
}

const endTime = performance.now();

console.log(`⏺ ${cities.length} citiess`);
console.log(`⏺ ${searchIndex.size} index entries`);
const sizeInBytes = searchIndexJsonString.length;
console.log(`⏺ ${Number(sizeInBytes / 1000).toFixed(1)} KB JSON size`);
console.log(
	`⏺ ${Number(endTime - startTime).toFixed(1)} ms to process search index`,
);
console.log("\n✔ Done");
