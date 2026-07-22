export interface User {
  id: string;
  email?: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at?: string;
  // Datos náuticos
  club?: string | null;
  sailing_class?: string | null;
  usual_role?: string | null;
  location?: string | null;
  // Redes / contacto
  instagram?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  website?: string | null;
}

export interface ProfileStats {
  boats_owned: number;
  crews_joined: number;
  member_since: string;
}

export interface PostAuthor {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
}

export interface PostComment {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  author_id: string;
  author: PostAuthor | null;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: PostAuthor | null;
  comment_count?: number;
  // Engagement (lo calcula el backend en los GET de posts).
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  saved_by_me?: boolean;
  recent_comments?: PostComment[];
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export interface BoatOwner {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
}

export const HULL_MATERIALS = [
  'Fibra',
  'Madera',
  'Aluminio',
  'Acero',
  'Carbono',
  'Otro',
] as const;
export type HullMaterial = (typeof HULL_MATERIALS)[number];

export const RATING_SYSTEMS = ['ORC', 'IRC', 'PHRF', 'Otro'] as const;
export type RatingSystem = (typeof RATING_SYSTEMS)[number];

export interface Boat {
  id: string;
  name: string;
  sail_number: string | null;
  /** Clase de vela: la que decide la elegibilidad en regatas. */
  category: string;
  photo_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: BoatOwner | null;

  // Ficha ampliada — todo opcional.
  builder: string | null;
  model: string | null;
  designer: string | null;
  year_built: number | null;
  hull_material: HullMaterial | null;
  registration_number: string | null;
  home_port: string | null;
  /** Código ISO 3166-1 alfa-2 (UY, AR, ES…). */
  flag: string | null;
  rating_system: RatingSystem | null;
  rating_value: number | null;
  crew_capacity: number | null;
}

export interface MyBoat extends Boat {
  relation: 'owner' | 'crew';
  my_role: string | null;
  crew_member_id: string | null;
}

export interface CrewEntry {
  id: string;
  role: string;
  invited_at: string;
  user: BoatOwner | null;
}

export interface BoatWithCrew extends Boat {
  crew: CrewEntry[];
}

export interface Invitation {
  id: string;
  role: string;
  invited_at: string;
  boat: {
    id: string;
    name: string;
    sail_number: string | null;
    category: string;
    photo_url: string | null;
    owner: BoatOwner | null;
  } | null;
}

export interface UserSearchResult {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
}

export type ClassifiedCategory = 'tripulante' | 'profesor' | 'barco' | 'otro';
export type ClassifiedRequirementType =
  | 'sailing_class'
  | 'experience_level'
  | 'role'
  | 'language'
  | 'availability';

export interface ClassifiedRequirement {
  id?: string;
  classified_id?: string;
  requirement_type: ClassifiedRequirementType;
  requirement_value: string;
}

export interface ClassifiedProfile {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  sailing_class?: string | null;
  usual_role?: string | null;
  location?: string | null;
}

export interface Classified {
  id: string;
  author_id: string;
  category: ClassifiedCategory;
  title: string;
  description: string;
  location: string;
  location_worldwide: boolean;
  status: 'active' | 'expired' | 'archived';
  created_at: string;
  expires_at: string;
  renewed_at: string | null;
  views_count: number;
  contact_email: string | null;
  contact_phone: string | null;
  author?: ClassifiedProfile | null;
  requirements: ClassifiedRequirement[];
  requirement_count?: number;
  requirement_summary?: string[];
  interest_count?: number;
  is_interested?: boolean;
  interests?: ClassifiedInterest[];
}

export interface ClassifiedInterest {
  id: string;
  classified_id?: string;
  user_id: string;
  message: string | null;
  created_at: string;
  user?: ClassifiedProfile | null;
}

export interface ClassifiedMatch {
  id: string;
  classified_id: string;
  matched_user_id: string;
  match_score: number;
  created_at: string;
  viewed_at: string | null;
  user: ClassifiedProfile | null;
}

// ── Administración ──────────────────────────────────────────

export type AccountType = 'sailor' | 'club' | 'federation';
export type AccountStatus = 'active' | 'suspended';

export interface AdminUser {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  account_type: AccountType;
  status: AccountStatus;
  created_at: string;
  last_active_at: string | null;
  boats_count: number;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
  account_type: AccountType;
  status: AccountStatus;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  last_active_at: string | null;
  boats: {
    id: string;
    name: string;
    sail_number: string | null;
    category: string;
    photo_url: string | null;
    created_at: string;
  }[];
  permissions: string[];
}

export interface PermissionCatalogItem {
  permission: string;
  description: string;
}

export interface AdminStats {
  total_users: number;
  active_today: number;
  new_today: number;
  total_boats: number;
  by_account_type: Record<AccountType, number>;
  by_status: Record<AccountStatus, number>;
}

export interface AdminBoat {
  id: string;
  name: string;
  sail_number: string | null;
  category: string;
  photo_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner: BoatOwner | null;
}

// ── Regatas ─────────────────────────────────────────────────

export type RegattaStatus =
  | 'upcoming'
  | 'open'
  | 'in_progress'
  | 'finished'
  | 'cancelled';

/** El campeonato (evento). No tiene clase propia. */
export interface Regatta {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: RegattaStatus;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  scoring_system: string;
  photo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  entry_count?: number;
  classes?: RegattaClass[];
}

export interface Race {
  id: string;
  regatta_class_id?: string;
  race_number: number;
  name: string | null;
  status: 'scheduled' | 'completed';
  sailed_at: string | null;
}

/** Clase/flota de un campeonato: corre por separado. */
export interface RegattaClass {
  id: string;
  regatta_id: string;
  sailing_class: string;
  discards_count: number;
  max_entries: number | null;
  status: RegattaStatus;
  created_at: string;
  updated_at: string;
  entry_count?: number;
  races?: Race[];
  eligible_boats?: EligibleBoat[];
  /** Inscripciones propias en esta clase (puede haber más de un barco). */
  my_entries?: Array<{ id: string; boat_id: string }>;
}

export interface RegattaDetail extends Regatta {
  classes: RegattaClass[];
}

export interface EligibleBoat {
  id: string;
  name: string;
  sail_number: string | null;
  category: string;
  photo_url: string | null;
  eligible: boolean;
  class_matches: boolean;
  already_registered: boolean;
}

export interface RegattaEntry {
  id: string;
  regatta_id: string;
  regatta_class_id: string;
  boat_id: string;
  registered_by: string;
  sail_number: string | null;
  status: 'confirmed' | 'withdrawn';
  registered_at: string;
  boat: {
    id: string;
    name: string;
    sail_number: string | null;
    category: string;
    photo_url: string | null;
    owner: BoatOwner | null;
  } | null;
}

export interface StandingRacePoint {
  race_id: string;
  race_number: number;
  points: number;
  position: number | null;
  code: string | null;
  discarded: boolean;
}

export interface Standing {
  entry_id: string;
  races: StandingRacePoint[];
  gross_total: number;
  total: number;
  rank: number;
  entry: RegattaEntry | null;
}

/** Bloque de resultados de UNA clase. */
export interface ClassResults {
  regatta_class: RegattaClass;
  races: Race[];
  entry_count: number;
  effective_discards: number;
  completed_races: number;
  discards_count: number;
  discard_threshold: number;
  /** Inscritos en la serie (incluye retirados): base de la penalización. */
  series_entries: number;
  /** Puntos que vale un DNF/DSQ/etc. en esta clase. */
  penalty_points: number;
  standings: Standing[];
}

export interface RegattaHistoryItem {
  entry_id: string;
  regatta_id: string;
  regatta_name: string;
  regatta_class_id: string;
  sailing_class: string;
  class_status: RegattaStatus;
  location: string | null;
  start_date: string;
  status: RegattaStatus;
  boat_name: string | null;
  position: number | null;
  total_entries: number | null;
  points: number | null;
}
