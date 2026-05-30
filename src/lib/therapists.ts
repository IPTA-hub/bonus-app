export interface Therapist {
  name: string;
  slug: string;
  role: string; // OTR, COTA, SLP
  hoursPerWeek: number;
  isFullTime: boolean;
  proRateFactor: number;
  expectedVisits: number;
  isClinicalDirector: boolean;
  directorLocation?: string; // which location they oversee
  hireDate?: string; // ISO date string
  workLocations: string[]; // typical work locations
  email?: string; // for reminder emails
  noBonus?: boolean; // tracks visits but has no bonus structure
}

const FT_HOURS = 32;
const PRORATE_BASE = 40; // Pro-rate factor based on 40-hour work week

function makeTherapist(
  name: string,
  role: string,
  hours: number,
  expectedVisits: number,
  opts?: {
    isClinicalDirector?: boolean;
    directorLocation?: string;
    hireDate?: string;
    workLocations?: string[];
    email?: string;
    noBonus?: boolean;
  }
): Therapist {
  const isFullTime = hours >= FT_HOURS;
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z]/g, "-").replace(/-+/g, "-"),
    role,
    hoursPerWeek: hours,
    isFullTime,
    proRateFactor: isFullTime ? 1.0 : Math.round((hours / PRORATE_BASE) * 10000) / 10000,
    expectedVisits,
    isClinicalDirector: opts?.isClinicalDirector || false,
    directorLocation: opts?.directorLocation,
    hireDate: opts?.hireDate,
    workLocations: opts?.workLocations || [],
    email: opts?.email,
    noBonus: opts?.noBonus || false,
  };
}

export const THERAPISTS: Therapist[] = [
  // --- Regular therapists ---
  makeTherapist("Kiana Atencio", "OTR", 40, 42, { hireDate: "2025-11-05", workLocations: ["Greeley"], email: "kianaa@integratedpeds.com" }),
  makeTherapist("Haidyn Stahl", "OTR", 40, 42, { hireDate: "2026-02-16", workLocations: ["Greeley"], email: "haidyns@integratedpeds.com" }),
  makeTherapist("Kelly Trent", "OTR", 40, 42, { hireDate: "2026-03-30", workLocations: ["Greeley", "Farm"], email: "kellyt@integratedpeds.com" }),
  makeTherapist("Hallie Sheridan", "OTR", 40, 42, { hireDate: "2026-03-30", workLocations: ["Windsor"], email: "hallies@integratedpeds.com" }),
  makeTherapist("Sophie Supernor", "OTR", 40, 42, { hireDate: "2026-01-28", workLocations: ["Windsor", "Farm"], email: "sophies@integratedpeds.com" }),
  makeTherapist("Andrea Gurga", "OTR", 40, 35, { hireDate: "2022-07-20", workLocations: ["Windsor", "Farm"], email: "andreag@integratedpeds.com" }),
  makeTherapist("Erin Kelly", "OTR", 40, 37, { hireDate: "2022-05-01", workLocations: ["Greeley", "Farm"], email: "erink@integratedpeds.com" }),
  makeTherapist("Macie Bicandi", "OTR", 39, 37, { hireDate: "2025-03-24", workLocations: ["Windsor", "Farm"], email: "macieb@integratedpeds.com" }),
  makeTherapist("Gabby Javier", "OTR", 38.25, 39, { hireDate: "2024-10-21", workLocations: ["Windsor", "Farm"], email: "gabbyj@integratedpeds.com" }),
  makeTherapist("Lindsey Messenger", "OTR", 36, 29, { hireDate: "2021-01-25", workLocations: ["Windsor", "Farm"], email: "lindseym@integratedpeds.com" }),
  makeTherapist("Jessica Nieves", "COTA", 34.5, 36, { hireDate: "2024-08-26", workLocations: ["Windsor"], email: "jessican@integratedpeds.com" }),
  makeTherapist("Jenna Maserang", "COTA", 30, 32, { hireDate: "2024-02-13", workLocations: ["Greeley"], email: "jennam@integratedpeds.com" }),
  makeTherapist("Carolee Jaynes", "OTR", 26, 22, { hireDate: "2024-06-03", workLocations: ["Farm"], email: "caroleej@integratedpeds.com" }),
  makeTherapist("Jackie Browne", "OTR", 25.5, 23, { hireDate: "2025-03-13", workLocations: ["Greeley", "Farm"], email: "jacquelineb@integratedpeds.com" }),
  makeTherapist("Nicole Richards", "OTR", 25, 21, { hireDate: "2020-06-08", workLocations: ["Windsor"], email: "nicoler@integratedpeds.com" }),
  makeTherapist("Hannah Rosenbach", "SLP", 16, 19, { hireDate: "2026-03-30", workLocations: ["Greeley"], email: "hannahr@integratedpeds.com" }),
  makeTherapist("April Monroe", "COTA", 15, 16, { hireDate: "2024-01-12", workLocations: ["Windsor", "Farm"], email: "aprilm@integratedpeds.com" }),
  makeTherapist("Stephanie French", "OTR", 15, 15, { hireDate: "2023-11-06", workLocations: ["Windsor", "Farm"], email: "stephanief@integratedpeds.com" }),
  makeTherapist("Carly Huyber", "OTR", 15, 16, { hireDate: "2026-01-22", workLocations: ["Windsor", "Farm"], email: "carlyh@integratedpeds.com" }),

  // --- Clinical Directors ---
  makeTherapist("Kristina Ihrig", "OTR", 40, 18, {
    isClinicalDirector: true,
    directorLocation: "Greeley",
    hireDate: "2021-08-09",
    workLocations: ["Greeley"],
    email: "kristinai@integratedpeds.com",
  }),
  makeTherapist("Katie Kiblen", "OTR", 34, 8, {
    isClinicalDirector: true,
    directorLocation: "Windsor",
    hireDate: "2019-10-14",
    workLocations: ["Windsor", "Farm"],
    email: "katiek@integratedpeds.com",
  }),
  makeTherapist("Stephanie Voorhes", "COTA", 37, 5, {
    isClinicalDirector: true,
    directorLocation: "Farm",
    hireDate: "2017-08-15",
    workLocations: ["Farm"],
    email: "stephaniev@integratedpeds.com",
  }),
  makeTherapist("Amy Mulligan", "SLP", 40, 20, {
    isClinicalDirector: true,
    directorLocation: "SLP",
    hireDate: "2025-09-19",
    workLocations: ["Greeley", "Farm", "Windsor"],
    email: "amym@integratedpeds.com",
  }),

  // --- Tracking only (no bonus structure) ---
  makeTherapist("Taneal Behm", "OTR", 40, 0, {
    noBonus: true,
    workLocations: ["Greeley", "Windsor", "Farm"],
    email: "tanealb@integratedpeds.com",
  }),
  makeTherapist("Abby Nothem", "SLP", 20, 0, {
    noBonus: true,
    workLocations: ["Greeley", "Windsor", "Farm"],
    email: "abbyn@integratedpeds.com",
  }),
  makeTherapist("Malia Eyler", "SLP", 20, 0, {
    noBonus: true,
    workLocations: ["Greeley", "Windsor", "Farm"],
    email: "malia@integratedpeds.com",
  }),

  // --- Directors (non-clinical) ---
  makeTherapist("Lexie McConnaughey", "Marketing", 40, 0, {
    isClinicalDirector: false,
    workLocations: ["Greeley", "Farm", "Windsor"],
    email: "lexiem@integratedpeds.com",
  }),
  makeTherapist("Nicole Summerson", "Director", 40, 0, {
    isClinicalDirector: false,
    hireDate: "2018-10-11",
    workLocations: ["Greeley", "Farm", "Windsor"],
    email: "nicoles@integratedpeds.com",
  }),

  // --- Patient Care Coordinators ---
  makeTherapist("Corina Ceballos", "PCC", 40, 0, {
    directorLocation: "Greeley",
    workLocations: ["Greeley"],
    email: "corinac@integratedpeds.com",
  }),
  makeTherapist("Kenzie Overy", "PCC", 40, 0, {
    directorLocation: "Windsor",
    workLocations: ["Windsor"],
    email: "kenzieo@integratedpeds.com",
  }),

  // --- PCC Assistants ---
  makeTherapist("Perla Gomez", "PCC-Asst", 40, 0, {
    workLocations: ["Greeley"],
    email: "perlag@integratedpeds.com",
  }),

  // --- Equine Team ---
  makeTherapist("Marley Higgins", "Equine", 40, 0, {
    directorLocation: "Farm",
    workLocations: ["Farm"],
    email: "marleyh@integratedpeds.com",
  }),
  makeTherapist("Katie Pederson", "Equine", 40, 0, {
    hireDate: "2025-04-14",
    workLocations: ["Farm"],
    email: "barnmanager@integratedpeds.com",
  }),
  makeTherapist("Savannah Ross", "Equine", 40, 0, {
    hireDate: "2024-10-07",
    workLocations: ["Farm"],
    email: "savannahr@integratedpeds.com",
  }),
  makeTherapist("Dillen Edwards", "Equine", 40, 0, {
    hireDate: "2025-09-22",
    workLocations: ["Farm"],
    email: "dillene@integratedpeds.com",
  }),
];

export function getTherapistBySlug(slug: string): Therapist | undefined {
  return THERAPISTS.find((t) => t.slug === slug);
}

// Convert a DB custom_staff row into a Therapist object
export function customStaffRowToTherapist(row: {
  slug: string;
  name: string;
  role: string;
  hours_per_week: number;
  expected_visits: number;
  is_clinical_director: boolean;
  director_location: string | null;
  hire_date: string | null;
  work_locations: string;
  email: string | null;
  no_bonus: boolean;
}): Therapist {
  const hours = Number(row.hours_per_week);
  const isFullTime = hours >= FT_HOURS;
  return {
    name: row.name,
    slug: row.slug,
    role: row.role,
    hoursPerWeek: hours,
    isFullTime,
    proRateFactor: isFullTime ? 1.0 : Math.round((hours / PRORATE_BASE) * 10000) / 10000,
    expectedVisits: row.expected_visits,
    isClinicalDirector: row.is_clinical_director,
    directorLocation: row.director_location ?? undefined,
    hireDate: row.hire_date ?? undefined,
    workLocations: row.work_locations ? row.work_locations.split(",").filter(Boolean) : [],
    email: row.email ?? undefined,
    noBonus: row.no_bonus,
  };
}

export function getClinicalDirectors(): Therapist[] {
  return THERAPISTS.filter((t) => t.isClinicalDirector);
}

export function getRegularTherapists(): Therapist[] {
  return THERAPISTS.filter((t) => !t.isClinicalDirector && !t.noBonus && t.role !== "Director" && t.role !== "PCC" && t.role !== "PCC-Asst" && t.role !== "Equine" && t.role !== "Marketing");
}

export function getPCCStaff(): Therapist[] {
  return THERAPISTS.filter((t) => t.role === "PCC");
}

export function getEquineTeam(): Therapist[] {
  return THERAPISTS.filter((t) => t.role === "Equine");
}

export function getEquineDirector(): Therapist | undefined {
  return THERAPISTS.find((t) => t.role === "Equine" && t.directorLocation);
}

export function getEquineStaffMembers(): Therapist[] {
  return THERAPISTS.filter((t) => t.role === "Equine" && !t.directorLocation);
}

// All staff who should have a "director" user role (clinical directors + Nicole Summerson)
export function getDirectors(): Therapist[] {
  return THERAPISTS.filter((t) => t.isClinicalDirector || t.role === "Director");
}

export function getTherapistsByLocation(location: string): Therapist[] {
  return THERAPISTS.filter((t) => t.workLocations.includes(location));
}

export const LOCATIONS = ["Greeley", "Farm", "Windsor"] as const;
export type Location = (typeof LOCATIONS)[number];

// Calculate months of service as of a given date
export function getMonthsOfService(hireDate: string, asOf?: Date): number {
  const hire = new Date(hireDate);
  const ref = asOf || new Date();
  const months = (ref.getFullYear() - hire.getFullYear()) * 12 + (ref.getMonth() - hire.getMonth());
  if (ref.getDate() < hire.getDate()) return Math.max(0, months - 1);
  return Math.max(0, months);
}

// Calculate years of service as of a given date
export function getYearsOfService(hireDate: string, asOf?: Date): number {
  const hire = new Date(hireDate);
  const ref = asOf || new Date();
  let years = ref.getFullYear() - hire.getFullYear();
  const monthDiff = ref.getMonth() - hire.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < hire.getDate())) {
    years--;
  }
  return Math.max(0, years);
}
