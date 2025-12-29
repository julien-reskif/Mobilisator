const inputPath1 = "./elections_1.json";
const inputPath2 = "./elections_2.json";
const inputPathPopulation = "./population.json";
const outputPath = "./elections.json";
const inputFile1 = Bun.file(inputPath1);
const inputFile2 = Bun.file(inputPath2);
const inputFilePopulation = Bun.file(inputPathPopulation);

const startTime = performance.now();

// Clés de base (identifiants de la commune uniquement)
const baseKeys = [
	"__id",
	"Code du département",
	"Libellé du département",
	"Code de la commune",
	"Libellé de la commune",
];

// Clés qui vont dans "Tour 1" (statistiques de l'élection)
const tour1Keys = [
	"Inscrits",
	"Abstentions",
	"% Abs/Ins",
	"Votants",
	"% Vot/Ins",
	"Blancs",
	"% Blancs/Ins",
	"% Blancs/Vot",
	"Nuls",
	"% Nuls/Ins",
	"% Nuls/Vot",
	"Exprimés",
	"% Exp/Ins",
	"% Exp/Vot",
];

// Clés pour chaque résultat de candidat/liste
const resultKeys = [
	"N.Pan.",
	"Code Nuance",
	"Sexe",
	"Nom",
	"Prénom",
	"Liste",
	"Sièges / Elu",
	"Sièges Secteur",
	"Sièges CC",
	"Voix",
	"% Voix/Ins",
	"% Voix/Exp",
];

// Fonction pour créer la clé de correspondance (département + commune sur 3 digits)
const createKey = (row: Record<string, unknown>): string => {
	const dept = String(row["Code du département"]).padStart(2, "0");
	const commune = String(row["Code de la commune"]).padStart(3, "0");
	return dept + commune;
};

// Mapping des codes communes exceptionnels vers plusieurs codes INSEE
const communeToInseeMapping: Record<string, number[]> = {
	"055SR01": [13201, 13207],
	"055SR02": [13202, 13203],
	"055SR03": [13204, 13205],
	"055SR04": [13206, 13208],
	"055SR05": [13209, 13210],
	"055SR06": [13211, 13212],
	"055SR07": [13213, 13214],
	"055SR08": [13215, 13216],
	"056SR01": [75101, 75102, 75103, 75104],
};

// Fonction pour créer le(s) code(s) INSEE pour correspondance avec population.json
// Retourne un tableau de codes INSEE (peut contenir un seul élément)
const createInseeCodes = (
	row: Record<string, unknown>,
): number[] => {
	let dept = String(row["Code du département"]);
	const commune = String(row["Code de la commune"]);

	// Vérifier si le code commune a un mapping spécial
	if (communeToInseeMapping[commune]) {
		return communeToInseeMapping[commune];
	}

	// Exceptions pour les codes départementaux
	const deptExceptions = ["ZA", "ZB", "ZC", "ZD", "ZM", "ZN", "ZP", "ZS"];
	if (deptExceptions.includes(dept)) {
		dept = "97";
	}

	// Exceptions pour les codes communes (anciennes règles)
	let processedCommune = commune;
	if (commune.startsWith("123SR0")) {
		processedCommune = commune.replace("123SR0", "38");
	}

	// Normaliser et combiner
	dept = dept.padStart(2, "0");
	processedCommune = processedCommune.padStart(3, "0");
	return [parseInt(dept + processedCommune)];
};

// Clés démographiques à extraire de population.json
const populationKeys = [
	"F0-2",
	"F3-5",
	"F6-10",
	"F11-17",
	"F18-24",
	"F25-39",
	"F40-54",
	"F55-64",
	"F65-79",
	"F80+",
	"H0-2",
	"H3-5",
	"H6-10",
	"H11-17",
	"H18-24",
	"H25-39",
	"H40-54",
	"H55-64",
	"H65-79",
	"H80+",
];

// Fonction pour extraire les données d'un tour (statistiques + résultats)
const extractTourData = (row: Record<string, unknown>): Record<string, unknown> => {
	const tourData: Record<string, unknown> = {};
	
	// Ajouter les statistiques
	for (const key of tour1Keys) {
		if (key in row) {
			tourData[key] = row[key];
		}
	}

	// Extraire tous les résultats
	const resultats: Record<string, unknown>[] = [];

	// 1. Extraire le premier résultat (colonnes nommées)
	const firstResult: Record<string, unknown> = {};
	let hasFirstResult = false;
	for (const key of resultKeys) {
		if (key in row) {
			firstResult[key] = row[key];
			hasFirstResult = true;
		}
	}
	if (hasFirstResult) {
		resultats.push(firstResult);
	}

	// 2. Extraire les résultats suivants (colonnes Unnamed)
	const unnamedKeys = Object.keys(row)
		.filter((k) => k.startsWith("Unnamed: "))
		.sort(
			(a, b) =>
				parseInt(a.split(":")[1].trim()) - parseInt(b.split(":")[1].trim()),
		);

	// Grouper les colonnes Unnamed par blocs de 12
	for (let i = 0; i < unnamedKeys.length; i += resultKeys.length) {
		const result: Record<string, unknown> = {};
		let hasData = false;

		for (let j = 0; j < resultKeys.length; j++) {
			const unnamedKey = unnamedKeys[i + j];
			if (unnamedKey && row[unnamedKey] !== undefined && row[unnamedKey] !== null) {
				result[resultKeys[j]] = row[unnamedKey];
				hasData = true;
			}
		}

		if (hasData) {
			resultats.push(result);
		}
	}

	tourData.resultats = resultats;
	return tourData;
};

console.log("📖 Reading elections_1.json...");
const data1 = await inputFile1.json();

console.log("📖 Reading elections_2.json...");
const data2 = await inputFile2.json();

console.log("📖 Reading population.json...");
const populationData = await inputFilePopulation.json();

// Créer un index des données de elections_2 pour accès rapide
console.log("🔑 Creating index for elections_2...");
const elections2Index = new Map<string, Record<string, unknown>>();
for (const row of data2) {
	const key = createKey(row);
	elections2Index.set(key, row);
}

// Créer un index des données de population pour accès rapide
console.log("🔑 Creating index for population...");
const populationIndex = new Map<number, Record<string, unknown>>();
for (const row of populationData) {
	const inseeCode = parseInt(row.INSEE);
	if (!isNaN(inseeCode)) {
		populationIndex.set(inseeCode, row);
	}
}

console.log(`📊 Processing ${data1.length} entries...`);

const cleanedData = data1.map((row: Record<string, unknown>) => {
	// Créer l'objet de base avec les identifiants de la commune uniquement
	const baseData: Record<string, unknown> = {};
	for (const key of baseKeys) {
		if (key in row) {
			baseData[key] = row[key];
		}
	}

	// Créer l'objet "Tour 1" avec les données de elections_1
	const tour1Data = extractTourData(row);
	baseData["Tour 1"] = tour1Data;

	// Chercher les données correspondantes dans elections_2
	const key = createKey(row);
	const tour2Row = elections2Index.get(key);
	if (tour2Row) {
		const tour2Data = extractTourData(tour2Row);
		baseData["Tour 2"] = tour2Data;
	}

	// Chercher les données de population correspondantes
	const inseeCodes = createInseeCodes(row);
	const populationRows = inseeCodes
		.map((code) => populationIndex.get(code))
		.filter((row) => row !== undefined) as Record<string, unknown>[];

	if (populationRows.length > 0) {
		const populationData: Record<string, unknown> = {};
		
		// Sommer les valeurs pour toutes les clés démographiques
		for (const popKey of populationKeys) {
			let sum = 0;
			for (const popRow of populationRows) {
				if (popKey in popRow && typeof popRow[popKey] === "number") {
					sum += popRow[popKey] as number;
				}
			}
			if (sum > 0) {
				populationData[popKey] = sum;
			}
		}
		
		if (Object.keys(populationData).length > 0) {
			baseData.population = populationData;
		}
	}

	return baseData;
});

console.log("💾 Writing cleaned data to elections.json...");
await Bun.write(outputPath, JSON.stringify(cleanedData, null, 2));

const endTime = performance.now();

console.log(`✅ Done! Processed ${cleanedData.length} entries`);
console.log(`⏺ ${Number(endTime - startTime).toFixed(1)} ms to process`);

export {};
