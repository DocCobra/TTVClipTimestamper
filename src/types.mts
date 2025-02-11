export interface TokenInfo {
  access_token: string; 
  expires_in: number;
  token_type: string; 
}

export interface ClipFile {
  id: string; 
  path: string; 
}

export interface ClipInfoResponse {
  data: ClipInfo[];
  pagination: {}; 
}

export interface ClipInfo {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: number;
  broadcaster_name: string;
  creator_id: number;
  creator_name: string;
  video_id: number; 
  game_id: number;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number;
  is_featured: boolean;
}
