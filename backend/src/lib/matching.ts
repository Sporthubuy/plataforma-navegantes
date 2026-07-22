export type ClassifiedRequirementType =
  | 'sailing_class'
  | 'experience_level'
  | 'role'
  | 'language'
  | 'availability';

export interface ClassifiedRequirement {
  requirement_type: ClassifiedRequirementType;
  requirement_value: string;
}

export interface MatchingUserProfile {
  sailing_class?: string | null;
  usual_role?: string | null;
  country?: string | null;
  city?: string | null;
  languages?: string[] | string | null;
  is_active?: boolean;
  boats_count?: number;
  finished_regattas_count?: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesText(value: string | null | undefined, expected: string): boolean {
  if (!value) return false;
  const actual = normalize(value);
  const target = normalize(expected);
  return actual === target || actual.includes(target) || target.includes(actual);
}

function matchesLanguage(
  languages: string[] | string | null | undefined,
  expected: string
): boolean {
  if (Array.isArray(languages)) {
    return languages.some((language) => matchesText(language, expected));
  }
  return matchesText(languages, expected);
}

function matchesExperience(
  requirement: string,
  profile: MatchingUserProfile
): boolean {
  const experience = (profile.finished_regattas_count ?? 0) + (profile.boats_count ?? 0);
  const expected = normalize(requirement);
  if (expected === 'avanzado') return experience >= 6;
  if (expected === 'intermedio') return experience >= 3;
  if (expected === 'principiante' || expected === 'inicial') return experience < 3;
  return false;
}

/** Calcula el porcentaje de requisitos cumplidos por un perfil. */
export function calculateMatchScore(
  requirements: ClassifiedRequirement[],
  userProfile: MatchingUserProfile
): number {
  if (requirements.length === 0) return 0;

  const matched = requirements.filter((requirement) => {
    switch (requirement.requirement_type) {
      case 'sailing_class':
        return matchesText(userProfile.sailing_class, requirement.requirement_value);
      case 'role':
        return matchesText(userProfile.usual_role, requirement.requirement_value);
      case 'experience_level':
        return matchesExperience(requirement.requirement_value, userProfile);
      case 'language':
        return matchesLanguage(userProfile.languages, requirement.requirement_value);
      case 'availability':
        return userProfile.is_active === true;
      default:
        return false;
    }
  }).length;

  return Math.round((matched / requirements.length) * 100);
}

export interface PlaceLike {
  country?: string | null;
  city?: string | null;
}

/**
 * Coincidencia geográfica entre un aviso y un perfil.
 *
 * El país tiene que coincidir sí o sí. La ciudad afina: si el aviso no
 * dice ciudad vale todo el país, y si la dice, el perfil tiene que
 * estar en esa ciudad (o no haber declarado ninguna, para no dejar
 * afuera a quien completó el perfil a medias).
 */
export function locationsMatch(
  classified: PlaceLike,
  profile: PlaceLike
): boolean {
  if (!classified.country || !profile.country) return false;
  if (classified.country !== profile.country) return false;
  if (!classified.city || !profile.city) return true;
  return matchesText(profile.city, classified.city);
}