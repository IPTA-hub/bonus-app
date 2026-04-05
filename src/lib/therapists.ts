export interface Therapist {
  name: string;
  slug: string;
  role: string;
  hoursPerWeek: number;
  isFullTime: boolean;
  proRateFactor: number;
  expectedVisits: number;
}

const FT_HOURS = 32;

function makeTherapist(
  name: string,
  role: string,
  hours: number,
  expectedVisits: number
): Therapist {
  const isFullTime = hours >= FT_HOURS;
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z]/g, "-").replace(/-+/g, "-"),
    role,
    hoursPerWeek: hours,
    isFullTime,
    proRateFactor: isFullTime ? 1.0 : Math.round((hours / FT_HOURS) * 10000) / 10000,
    expectedVisits,
  };
}

export const THERAPISTS: Therapist[] = [
  makeTherapist("Kiana Atencio", "OTR", 40, 42),
  makeTherapist("Haidyn Stahl", "OTR", 40, 42),
  makeTherapist("Kelly Trent", "OTR", 40, 42),
  makeTherapist("Halle Sheridan", "OTR", 40, 42),
  makeTherapist("Stacy Supernor", "OTR", 40, 42),
  makeTherapist("Anna Gurga", "OTR", 40, 35),
  makeTherapist("Emily Kelly", "OTR", 40, 37),
  makeTherapist("Kallie Ihrig", "OTR", 40, 18),
  makeTherapist("Mary Bicandi", "OTR", 39, 37),
  makeTherapist("Stephanie Voorhes", "COTA", 37, 5),
  makeTherapist("Katie Kiblen", "OTR", 34, 8),
  makeTherapist("Gian Javier", "OTR", 38.25, 39),
  makeTherapist("Lacy Messenger", "OTR", 36, 29),
  makeTherapist("Jose Nieves", "COTA", 34.5, 36),
  makeTherapist("Jessica Maserang", "COTA", 30, 32),
  makeTherapist("Chelsey Jaynes", "OTR", 26, 22),
  makeTherapist("Julie Browne", "OTR", 25.5, 23),
  makeTherapist("Natalie Richards", "OTR", 25, 21),
  makeTherapist("Hannah Rosenbach", "SLP", 16, 19),
  makeTherapist("Alyssa Monroe", "COTA", 15, 16),
  makeTherapist("Sophie French", "OTR", 15, 15),
  makeTherapist("Carly Huyber", "OTR", 15, 16),
];

export function getTherapistBySlug(slug: string): Therapist | undefined {
  return THERAPISTS.find((t) => t.slug === slug);
}
