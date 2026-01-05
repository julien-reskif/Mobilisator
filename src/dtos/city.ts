export interface ElectionResult {
	"N.Pan.": number | null;
	"Code Nuance": string;
	"Sexe": string;
	"Nom": string;
	"Prénom": string;
	"Liste": string;
	"Sièges / Elu": string | number;
	"Sièges Secteur": number;
	"Sièges CC": number;
	"Voix": number;
	"% Voix/Ins": number;
	"% Voix/Exp": number;
}

export interface TourData {
	Inscrits: number;
	Abstentions: number;
	"% Abs/Ins": number;
	Votants: number;
	"% Vot/Ins": number;
	Blancs: number;
	"% Blancs/Ins": number;
	"% Blancs/Vot": number;
	Nuls: number;
	"% Nuls/Ins": number;
	"% Nuls/Vot": number;
	Exprimés: number;
	"% Exp/Ins": number;
	"% Exp/Vot": number;
	resultats: ElectionResult[];
}

export interface PopulationData {
	"F0-2": number;
	"F3-5": number;
	"F6-10": number;
	"F11-17": number;
	"F18-24": number;
	"F25-39": number;
	"F40-54": number;
	"F55-64": number;
	"F65-79": number;
	"F80+": number;
	"H0-2": number;
	"H3-5": number;
	"H6-10": number;
	"H11-17": number;
	"H18-24": number;
	"H25-39": number;
	"H40-54": number;
	"H55-64": number;
	"H65-79": number;
	"H80+": number;
}

export interface AnalyseData {
	"Votes décisifs": number;
	"tour décisif": number;
	majeurs: number;
	"Non votants de 18-24": number;
}

export interface ElectionEntry {
	__id: number;
	"Code du département": string;
	"Libellé du département": string;
	"Code de la commune": string;
	"Libellé de la commune": string;
	"Tour 1": TourData;
	"Tour 2"?: TourData;
	population?: PopulationData;
	Analyse: AnalyseData;
}

export interface FullCity {
	id: number;
	normalized_name: string;
	nom_standard: string;
	nom_sans_pronom: string;
	code_postal: string;
	codes_postaux: string[];
	code_departement: string;
	libelle_departement: string;
	code_commune: string;
}

export interface AnalyseData {
	"Votes décisifs": number;
	"tour décisif": number;
	majeurs: number;
	"Non votants de 18-24": number;
	"Pop 18-24": number;
	"Pop 18+": number;
	"Non votants": number;
	"Part ne votant pas": number;
}

export interface City {
	id: number;
	slug: string;
	nom_standard: string;
	code_postal: string;
	code_departement: string;
	code_insee: string;
	libelle_departement: string;
	code_commune: string;
	"Tour 1": TourData;
	"Tour 2"?: TourData;
	population?: PopulationData;
	Analyse: AnalyseData;
}

// Search result format: [id, name, code_departement]
export type CitySearchResult = [number, string, string];
