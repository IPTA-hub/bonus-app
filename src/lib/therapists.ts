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
  };
}

export const THERAPISTS: Therapist[] = [
  // --- Regular therapists ---
  makeTherapist("Kiana Atencio", "OTR", 40, 42, { hireDate: "2025-11-05", workLocations: ["Greeley"] }),
  makeTherapist("Haidyn Stahl", "OTR", 40, 42, { hireDate: "2026-02-16", workLocations: ["Greeley"] }),
  makeTherapist("Kelly Trent", "OTR", 40, 42, { hireDate: "2026-03-30", workLocations: ["Greeley", "Farm"] }),
  makeTherapist("Hallie Sheridan", "OTR", 40, 42, { hireDate: "2026-03-30", workLocations: ["Windsor"] }),
  makeTherapist("Sophie Supernor", "OTR", 40, 42, { hireDate: "2026-01-28", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Andrea Gurga", "OTR", 40, 35, { hireDate: "2022-07-20", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Erin Kelly", "OTR", 40, 37, { hireDate: "2022-05-01", workLocations: ["Greeley", "Farm"] }),
  makeTherapist("Macie Bicandi", "OTR", 39, 37, { hireDate: "2025-03-24", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Gabby Javier", "OTR", 38.25, 39, { hireDate: "2024-10-21", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Lindsey Messenger", "OTR", 36, 29, { hireDate: "2021-01-25", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Jessica Nieves", "COTA", 34.5, 36, { hireDate: "2024-08-26", workLocations: ["Windsor"] }),
  makeTherapist("Jenna Maserang", "COTA", 30, 32, { hireDate: "2024-02-13", workLocations: ["Greeley"] }),
  makeTherapist("Carolee Jaynes", "OTR", 26, 22, { hireDate: "2024-06-03", workLocations: ["Farm"] }),
  makeTherapist("Jackie Browne", "OTR", 25.5, 23, { hireDate: "2025-03-13", workLocations: ["Greeley", "Farm"] }),
  makeTherapist("Nicole Richards", "OTR", 25, 21, { hireDate: "2020-06-08", workLocations: ["Windsor"] }),
  makeTherapist("Hannah Rosenbach", "SLP", 16, 19, { hireDate: "2026-03-30", workLocations: ["Greeley"] }),
  makeTherapist("April Monroe", "COTA", 15, 16, { hireDate: "2024-01-12", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Stephanie French", "OTR", 15, 15, { hireDate: "2023-11-06", workLocations: ["Windsor", "Farm"] }),
  makeTherapist("Carly Huyber", "OTR", 15, 16, { hireDate: "2026-01-22", workLocations: ["Windsor", "Farm"] }),

  // --- Clinical Directors ---
  makeTherapist("Kristina Ihrig", "OTR", 40, 18, {
    isClinicalDirector: true,
    directorLocation: "Greeley",
    hireDate: "2021-08-09",
    workLocations: ["Greeley"],
  }),
  makeTherapist("Katie Kiblen", "OTR", 34, 8, {
    isClinicalDirector: true,
    directorLocation: "Windsor",
    hireDate: "2019-10-14",
    workLocations: ["Windsor", "Farm"],
  }),
  makeTherapist("Stephanie Voorhes", "COTA", 37, 5, {
    isClinicalDirector: true,
    directorLocation: "Farm",
    hireDate: "2017-08-15",
    workLocations: ["Farm"],
  }),
  makeTherapist("Amy Mulligan", "SLP", 40, 20, {
    isClinicalDirector: true,
    directorLocation: "SLP",
    hireDate: "2025-09-19",
    workLocations: ["Greeley", "Farm", "Windsor"],
  }),

  // --- Director (non-clinical) ---
  makeTherapist("Nicole Summerson", "Director", 40, 0, {
    isClinicalDirector: false,
    hireDate: "2018-10-11",
    workLocations: ["Greeley", "Farm", "Windsor"],
  }),

  // --- Patient Care Coordinators ---
  makeTherapist("Corina Ceballos", "PCC", 40, 0, {
    directorLocation: "Greeley",
    workLocations: ["Greeley"],
  }),
  makeTherapist("Kenzie Overy", "PCC", 40, 0, {
    directorLocation: "Windsor",
    workLocations: ["Windsor"],
  }),

  // --- Equine Team ---
  makeTherapist("Marley Higgins", "Equine", 40, 0, {
    directorLocation: "Farm",
    workLocations: ["Farm"],
  }),
  makeTherapist("Katie Pederson", "Equine", 40, 0, {
    hireDate: "2025-04-14",
    workLocations: ["Farm"],
  }),
  makeTherapist("Savannah Ross", "Equine", 40, 0, {
    hireDate: "2024-10-07",
    workLocations: ["Farm"],
  }),
  makeTherapist("Dillen Edwards", "Equine", 40, 0, {
    hireDate: "2025-09-22",
    workLocations: ["Farm"],
  }),
];

export function getTherapistBySlug(slug: string): Therapist | undefined {
  return THERAPISTS.find((t) => t.slug === slug);
}

export function getClinicalDirectors(): Therapist[] {
  return THERAPISTS.filter((t) => t.isClinicalDirector);
}

export function getRegularTherapists(): Therapist[] {
  return THERAPISTS.filter((t) => !t.isClinicalDirector && t.role !== "Director" && t.role !== "PCC" && t.role !== "Equine");
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
