export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  description: string | null;
  images: string[];
  early_price: number;
  regular_price: number;
  includes_tee: boolean;
  includes_band: boolean;
  max_per_order: number;
  is_active: boolean;
  sort: number;
  updated_at: string;
};

export type SizeChartRow = {
  size: string;
  chest_in: number;
  length_in: number;
  sleeve_in: number;
  fits_chest: string;
  sort: number;
};

export type Batch = {
  code: string;
  sort: number;
};

export type Center = {
  code: string;
  sort: number;
};

export type AttendeeType = 'student' | 'graduate' | 'alumni';

export type Settings = {
  id: number;
  early_bird_ends_at: string;
  order_cutoff_at: string;
  payment_window: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_branch: string;
  artist_placeholders: number;
  more_artists_coming: boolean;
  feed_max_video_secs: number;
  feed_home_count: number;
  feed_autoplay: boolean;
  launch_state: 'idle' | 'armed' | 'launched';
  launch_armed_at: string | null;
  launch_countdown_secs: number;
};

export type Feature = {
  key: string;
  label: string;
  is_live: boolean;
  sort: number;
  updated_at: string;
};

/**
 * Shape of the `public_reveals` VIEW — never the `reveals` table.
 * `value`/`detail` are already null server-side until `is_revealed` is
 * true, so there's no unrevealed data to accidentally render here.
 */
export type PublicReveal = {
  key: string;
  label: string;
  sort: number;
  is_revealed: boolean;
  revealed_at: string | null;
  value: string | null;
  detail: string | null;
  link_url: string | null;
};

/**
 * Shape of the `public_artists` VIEW — never the `artists` table. A sealed
 * artist has no row here at all (not a nulled row), so there's nothing
 * client-side that could leak an unannounced name.
 */
export type PublicArtist = {
  id: string;
  name: string;
  tagline: string | null;
  photo_path: string | null;
  instagram?: string | null;
  spotify?: string | null;
  revealed_at: string | null;
  sort: number;
};

export type PostMediaKind = 'image' | 'video';

/**
 * Shape of a media item inside `public_feed.media` — deliberately shorter
 * keys than the `post_media` table/`admin_post_view` columns (no `id`; `w`/
 * `h`/`poster`/`duration` instead of `width`/`height`/`poster_path`/
 * `duration_s`), since this JSON is repeated per item in a paginated public
 * response and the admin composer's isn't. `path` doubles as a stable React
 * key — it's a UUID-based filename, unique per item, and there's no `id`
 * here to use instead. No `sort` either — items already arrive in sort
 * order from the view's own `jsonb_agg(... order by sort)`, so the client
 * never needs to re-sort and the key isn't worth repeating per item.
 */
export type PostMedia = {
  kind: PostMediaKind;
  path: string;
  w: number | null;
  h: number | null;
  placeholder: string | null;
  poster: string | null;
  duration: number | null;
};

/**
 * Shape of the `public_feed` VIEW — never `posts`. A draft simply has no
 * row here, the same "unpublished never on the wire" shape as
 * public_reveals/public_artists.
 */
export type FeedPost = {
  id: string;
  caption: string | null;
  is_pinned: boolean;
  like_count: number;
  published_at: string;
  media: PostMedia[] | null;
};

export type UserRole = 'user' | 'admin' | 'superadmin';

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  sa_number: string | null;
  batch: string | null;
  center: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
};

export type OrderStatus =
  | 'awaiting_payment'
  | 'slip_uploaded'
  | 'approved'
  | 'rejected'
  | 'ready_for_collection'
  | 'collected'
  | 'cancelled';

export type Order = {
  id: string;
  user_id: string;
  code: string;
  status: OrderStatus;
  full_name: string;
  attendee_type: AttendeeType;
  sa_number: string | null;
  phone: string;
  batch: string | null;
  nic: string | null;
  center: string;
  email: string;
  subtotal: number;
  total: number;
  slip_path: string | null;
  slip_uploaded_at: string | null;
  payment_ref: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  ready_at: string | null;
  collected_at: string | null;
  payment_due_at: string;
  created_at: string;
  updated_at: string;
};

export type Pass = {
  id: string;
  order_id: string;
  user_id: string;
  checked_in_at: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  size: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type PostLike = {
  post_id: string;
  user_id: string;
  created_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      products: Table<Product>;
      size_chart: Table<SizeChartRow>;
      batches: Table<Batch>;
      centers: Table<Center>;
      settings: Table<Settings>;
      features: Table<Feature>;
      profiles: Table<Profile>;
      orders: Table<Order>;
      order_items: Table<OrderItem>;
      passes: Table<Pass>;
      post_likes: Table<PostLike>;
    };
    Views: {
      public_reveals: View<PublicReveal>;
      public_artists: View<PublicArtist>;
      public_feed: View<FeedPost>;
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
