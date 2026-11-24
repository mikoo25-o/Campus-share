export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string | null;
  organisation_name: string | null;
  county: string | null;
  town: string | null;
  primary_role: "donor" | "receiver";
  is_farmer: boolean;
  is_advertiser: boolean;
  is_admin: boolean;
  status: "active" | "suspended";
  show_on_leaderboard: boolean;
  avatar_path: string | null;
  onboarding_done: boolean;
};

export type PublicProfile = {
  id: string;
  display_name: string;
  organisation_name: string | null;
  county: string | null;
  town: string | null;
};

export type DonationStatus = "draft" | "available" | "reserved" | "collected" | "expired" | "cancelled";

export type Donation = {
  id: string;
  donor_id: string;
  title: string;
  category: string;
  description: string | null;
  quantity: number;
  quantity_remaining: number;
  unit: string;
  portions: number | null;
  prepared_at: string | null;
  expires_at: string;
  storage_conditions: string | null;
  county: string;
  town: string;
  area_label: string | null;
  lat: number | null;
  lng: number | null;
  dietary: string[];
  allergens: string[];
  notes: string | null;
  status: DonationStatus;
  created_at: string;
  donation_images?: { id: string; storage_path: string; sort_order: number }[];
  public_profiles?: PublicProfile | null;
};

export type Reservation = {
  id: string;
  donation_id: string;
  receiver_id: string;
  quantity: number;
  status: "reserved" | "collected" | "cancelled" | "expired";
  code_attempts: number;
  created_at: string;
  collected_at: string | null;
  food_donations?: Donation | null;
};

export type Listing = {
  id: string;
  farmer_id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  unit: string;
  quantity_available: number;
  harvest_date: string | null;
  available_from: string | null;
  county: string;
  town: string | null;
  delivery_options: string[];
  keywords: string[];
  status: "draft" | "active" | "paused" | "sold_out" | "removed";
  created_at: string;
  produce_images?: { id: string; storage_path: string; sort_order: number }[];
  farmer_profiles?: FarmerProfile | null;
};

export type FarmerProfile = {
  user_id: string;
  farm_name: string;
  farmer_name: string;
  county: string;
  town: string | null;
  description: string | null;
  categories: string[];
  contact_note: string | null;
  avatar_path: string | null;
};

export type Enquiry = {
  id: string;
  listing_id: string;
  buyer_id: string;
  farmer_id: string;
  message: string;
  quantity_interest: number | null;
  status: "new" | "replied" | "closed";
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  produce_listings?: { name: string } | null;
};

export type Campaign = {
  id: string;
  owner_id: string;
  name: string;
  objective: string;
  campaign_type: string;
  headline: string;
  description: string | null;
  image_path: string | null;
  destination_url: string;
  cta_label: string;
  target_counties: string[];
  target_categories: string[];
  placements: string[];
  start_date: string;
  end_date: string;
  budget_credits: number;
  spent_credits: number;
  refunded_credits: number;
  payment_status: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "paused" | "ended";
  rejection_reason: string | null;
  created_at: string;
};

export type ServedAd = {
  id: string;
  headline: string;
  description: string | null;
  image_path: string | null;
  cta_label: string;
  campaign_type: string;
  advertiser: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type CreditAccount = { balance: number; total_earned: number; total_spent: number };

export type LedgerEntry = {
  id: string;
  amount: number;
  entry_type: "earn" | "spend" | "refund" | "adjustment";
  status: "posted" | "held" | "reversed";
  note: string | null;
  created_at: string;
};

export type LeaderRow = {
  rank: number;
  display_name: string;
  organisation_name: string | null;
  county: string | null;
  collections: number;
  kg: number;
  credits: number;
  score: number;
  is_me: boolean;
};
