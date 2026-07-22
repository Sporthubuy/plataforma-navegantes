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
  location?: string | null;
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

/** Una coincidencia local requiere que una ubicación contenga a la otra. */
export function locationsMatch(
  classifiedLocation: string,
  profileLocation: string | null | undefined
): boolean {
  return matchesText(profileLocation, classifiedLocation) ||
    matchesText(classifiedLocation, profileLocation ?? '');
}