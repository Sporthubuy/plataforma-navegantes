export interface User {
  id: string;
  email?: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at?: string;
}

export interface PostAuthor {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
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

export interface Boat {
  id: string;
  name: string;
  sail_number: string | null;
  category: string;
  photo_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: BoatOwner | null;
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
