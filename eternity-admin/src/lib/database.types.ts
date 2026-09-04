// Deliberately NOT shared with eternity-web — separate app, separate repo,
// separate deploy. The only thing the two share is the Supabase project.
//
// Note on `interface` vs `type` below: these must be `type` aliases, not
// `interface` declarations. supabase-js's generics check each table's Row
// against `Record<string, unknown>` via a conditional `extends`, and that
// check silently evaluates false for `interface` types (TS doesn't grant
// them the same implicit index signature it grants object type literals),
// which quietly collapses every query's return type to `never`.

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

export type Batch = { code: string; sort: number };
export type Center = { code: string; sort: number };
export type AttendeeType = 'student' | 'graduate' | 'alumni';

export type Feature = {
  key: string;
  label: string;
  is_live: boolean;
  sort: number;
  updated_at: string;
};

export type Reveal = {
  key: string;
  label: string;
  value: string | null;
  detail: string | null;
  link_url: string | null;
  is_revealed: boolean;
  revealed_at: string | null;
  sort: number;
};

export type Artist = {
  id: string;
  name: string;
  tagline: string | null;
  photo_path: string | null;
  instagram: string | null;
  spotify: string | null;
  is_revealed: boolean;
  revealed_at: string | null;
  sort: number;
};

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

export type Settings = {
  id: number;
  early_bird_ends_at: string;
  order_cutoff_at: string;
  payment_window: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_branch: string;
  collection_point: string;
  band_capacity: number;
  artist_placeholders: number;
  more_artists_coming: boolean;
  feed_max_video_secs: number;
  feed_home_count: number;
  feed_autoplay: boolean;
  launch_state: 'idle' | 'armed' | 'launched';
  launch_armed_at: string | null;
  launch_countdown_secs: number;
};

export type PostMediaKind = 'image' | 'video';

export type PostMedia = {
  id: string;
  post_id: string;
  kind: PostMediaKind;
  path: string;
  width: number | null;
  height: number | null;
  placeholder: string | null;
  poster_path: string | null;
  duration_s: number | null;
  sort: number;
};

export type Post = {
  id: string;
  caption: string | null;
  is_published: boolean;
  is_pinned: boolean;
  like_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** `admin_post_view` row — a post with its media pre-joined as JSON. */
export type AdminPostRow = Post & { media: PostMedia[] | null };

export type SizeChartRow = {
  size: string;
  chest_in: number;
  length_in: number;
  sleeve_in: number | null;
  fits_chest: string;
  sort: number;
};

export type SizeStock = { size: string; cap: number };

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
  checked_in_by: string | null;
  void_reason: string | null;
  created_at: string;
};

/** `gate_manifest` VIEW — everything a gate device needs to resolve a scan offline. */
export type GateManifestRow = {
  pass_id: string;
  order_code: string;
  full_name: string;
  center: string;
  phone: string;
  photo_url: string | null;
  checked_in_at: string | null;
  checked_in_by_name: string | null;
  void_reason: string | null;
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

export type EmailOutboxRow = {
  id: number;
  to_email: string;
  to_name: string | null;
  template: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

/** `size_availability` VIEW — cap/taken/remaining/sold_out per size. */
export type SizeAvailability = {
  size: string;
  sort: number;
  cap: number;
  taken: number;
  remaining: number;
  sold_out: boolean;
};

/** `band_availability` VIEW — single-row aggregate for the (unsized) wristband. */
export type BandAvailability = { cap: number; taken: number };

/** `admin_order_view` VIEW — orders with items pre-joined as text and JSON. */
export type AdminOrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  full_name: string;
  attendee_type: AttendeeType;
  sa_number: string | null;
  batch: string | null;
  nic: string | null;
  center: string;
  phone: string;
  email: string;
  avatar_url: string | null;
  total: number;
  subtotal: number;
  payment_ref: string | null;
  slip_path: string | null;
  created_at: string;
  slip_uploaded_at: string | null;
  payment_due_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  ready_at: string | null;
  collected_at: string | null;
  rejection_reason: string | null;
  items: string | null;
  items_json: { product: string; size: string | null; qty: number; unit: number }[] | null;
  /** Null for every non-alumni order, and for an alumni order not yet approved. */
  pass_code: string | null;
  checked_in_at: string | null;
};

export type SizeBreakdownRow = { size: string; units: number };
export type BatchBreakdownRow = { batch: string; orders: number; value: number };
export type RevenueSummaryRow = { status: OrderStatus; orders: number; value: number };

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      profiles: Table<Profile>;
      batches: Table<Batch>;
      centers: Table<Center>;
      features: Table<Feature>;
      reveals: Table<Reveal>;
      artists: Table<Artist>;
      products: Table<Product>;
      settings: Table<Settings>;
      size_chart: Table<SizeChartRow>;
      size_stock: Table<SizeStock>;
      orders: Table<Order>;
      order_items: Table<OrderItem>;
      passes: Table<Pass>;
      email_outbox: Table<EmailOutboxRow>;
      posts: Table<Post>;
      post_media: Table<PostMedia>;
    };
    Views: {
      size_availability: View<SizeAvailability>;
      band_availability: View<BandAvailability>;
      admin_order_view: View<AdminOrderRow>;
      gate_manifest: View<GateManifestRow>;
      admin_post_view: View<AdminPostRow>;
      size_breakdown: View<SizeBreakdownRow>;
      batch_breakdown: View<BatchBreakdownRow>;
      revenue_summary: View<RevenueSummaryRow>;
    };
    Functions: {
      set_launch_state: {
        Args: { new_state: string };
        Returns: void;
      };
      check_in_pass: {
        Args: { p_pass_id: string; p_checked_in_at?: string };
        Returns: { out_pass_id: string; already_checked_in: boolean; out_checked_in_at: string; out_checked_in_by: string | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
