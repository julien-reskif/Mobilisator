import type { City, ElectionEntry, FullCity } from "./dtos/city";

export const normalizeText = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[''`]/g, "-")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/\s+/g, "-")
		.trim();

export const fullCityToCity = (
	city: FullCity,
	electionEntry: ElectionEntry,
): City => {
	const slug = `${city.code_departement}-${city.code_commune}-${city.normalized_name}`;

	// Calculate population stats
	const pop = electionEntry.population;
	const pop1824 = pop
		? (pop["F18-24"] || 0) + (pop["H18-24"] || 0)
		: 0;
	const pop18Plus = pop
		? (pop["F18-24"] || 0) + (pop["F25-39"] || 0) + (pop["F40-54"] || 0) + (pop["F55-64"] || 0) + (pop["F65-79"] || 0) + (pop["F80+"] || 0) +
		  (pop["H18-24"] || 0) + (pop["H25-39"] || 0) + (pop["H40-54"] || 0) + (pop["H55-64"] || 0) + (pop["H65-79"] || 0) + (pop["H80+"] || 0)
		: 0;

	// Get total voters from the decisive tour
	const tourDecisif = electionEntry["Tour 2"] || electionEntry["Tour 1"];
	const votants = tourDecisif?.Votants || 0;
	const nonVotants = Math.round(pop18Plus - votants);
	const partNeVotantPas = pop18Plus > 0 ? (pop18Plus - votants) / pop18Plus : 0;

	// Build code INSEE (department code padded to 2 or 3 chars + commune code padded to 3 chars)
	const deptCode = city.code_departement.padStart(city.code_departement.length >= 3 ? 3 : 2, "0");
	const communeCode = city.code_commune.padStart(3, "0");
	const codeInsee = `${deptCode}${communeCode}`;

	return {
		id: city.id,
		slug,
		nom_standard: city.nom_standard,
		code_postal: city.code_departement,
		code_departement: city.code_departement,
		code_insee: codeInsee,
		libelle_departement: city.libelle_departement,
		code_commune: city.code_commune,
		"Tour 1": electionEntry["Tour 1"],
		...(electionEntry["Tour 2"] && { "Tour 2": electionEntry["Tour 2"] }),
		...(electionEntry.population && { population: electionEntry.population }),
		Analyse: {
			...electionEntry.Analyse,
			"Pop 18-24": Math.round(pop1824),
			"Pop 18+": Math.round(pop18Plus),
			"Non votants": nonVotants,
			"Part ne votant pas": partNeVotantPas,
		},
	};
};
