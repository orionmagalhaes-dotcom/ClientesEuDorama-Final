
// Represents the raw row in Supabase 'clients' table
export interface ClientDBRow {
  id: string;
  phone_number: string;
  client_name?: string; // Nome escolhido pelo usuário
  purchase_date: string;
  duration_months: number;
  subscriptions: string[]; // Array of text as per schema (_text)
  is_debtor: boolean;
  is_contacted: boolean;
  override_expiration?: boolean; // New field for Admin Override
  deleted: boolean;
  created_at: string;
  client_password?: string; // Nova coluna para senha do cliente
  game_progress?: any; // Nova coluna JSONB para salvar progresso dos jogos
  last_active_at?: string; // Nova coluna para rastrear status online
  
  // Personalization (Stored in JSONB 'preferences' or distinct columns if migrated)
  // For this version we will map strictly to UI state, assuming persisted via localStorage or future DB update
  theme_color?: string;
  background_image?: string;
  profile_image?: string;
}

// Raw row for 'app_credentials' table
export interface AppCredentialDBRow {
  id: string;
  service: string;
  email: string;
  password: string;
  published_at: string;
  is_visible: boolean;
  created_at: string;
}

// Raw row for 'admin_users' table
export interface AdminUserDBRow {
  id: string;
  username: string;
  password: string;
  created_at: string;
}

// Raw row for 'user_doramas' table
export interface UserDoramaDBRow {
  id: string;
  phone_number: string;
  title: string;
  genre: string;
  thumbnail: string;
  status: string;
  episodes_watched: number;
  total_episodes: number;
  season?: number; // New field
  rating?: number; // New field for Favorites (1-5)
  list_type: string;
  created_at: string;
}

// Structure for Support Flows (Stored in Supabase)
export interface SupportFlowStep {
  id: string;
  message: string;
  options: { label: string; next_step_id: string | null; action?: 'link' | 'copy_credential' | 'check_subscription' | 'open_url'; action_value?: string }[];
}

export interface SupportFlowDBRow {
  id: string; // e.g., 'viki_start', 'viki_tv_samsung'
  title: string;
  content: any; // JSON containing message and options
}

export interface Dorama {
  id: string; // Will store the UUID from Supabase
  title: string;
  genre: string;
  thumbnail: string;
  status: 'Watching' | 'Plan to Watch' | 'Completed';
  episodesWatched?: number;
  totalEpisodes?: number;
  season?: number; // New field
  rating?: number; // 1 to 5 hearts
}

// Subscription Detail Interface - NOVA INTERFACE PARA DATAS INDIVIDUAIS
export interface SubscriptionDetail {
    purchaseDate: string;
    durationMonths: number;
    isDebtor: boolean;
}

// User interface used by the App (Mapped from DB)
export interface User {
  id: string;
  name: string; // Placeholder or derived
  phoneNumber: string;
  
  // GLOBAL Fallbacks (legacy support)
  purchaseDate: string;
  durationMonths: number;
  
  // Specific Data per Service (New Logic)
  subscriptionDetails: Record<string, SubscriptionDetail>;

  services: string[]; // List of apps (e.g. Viki, Netflix)
  isDebtor: boolean;
  overrideExpiration: boolean; // New field

  // Local state (features not yet in DB table)
  watching: Dorama[];
  favorites: Dorama[];
  completed: Dorama[];
  
  // Game Progress
  gameProgress: Record<string, any>;

  // Personalization
  themeColor?: string;
  backgroundImage?: string;
  profileImage?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system'; // System for support bot
  text: string;
  timestamp: Date;
  options?: { label: string; action: () => void }[]; // For UI interactions
}

export type ServiceType = 'Viki Pass' | 'Kocowa+' | 'IQIYI' | 'WeTV' | 'DramaBox' | string;

// Frontend representation of a credential
export interface AppCredential {
  id: string;
  service: ServiceType;
  email: string;
  password: string;
  publishedAt: string; // ISO Date
  isVisible: boolean; 
}

export interface AdminUser {
  id: string;
  username: string;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  image: string;
  source: string;
}
