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
