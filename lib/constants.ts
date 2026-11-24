export const COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
  "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
] as const;

/** Approximate county centre points (lat, lng), used for weather and rough distances. Rounded to ~1 km. */
export const COUNTY_CENTRES: Record<string, [number, number]> = {
  Kisii: [-0.68, 34.77], Nairobi: [-1.29, 36.82], Kisumu: [-0.09, 34.77], Mombasa: [-4.04, 39.67], Nakuru: [-0.3, 36.07],
  Nyamira: [-0.57, 34.95], Migori: [-1.06, 34.47], "Homa Bay": [-0.53, 34.46], Kericho: [-0.37, 35.28], Bomet: [-0.79, 35.34],
  Kiambu: [-1.17, 36.83], Machakos: [-1.52, 37.26], "Uasin Gishu": [0.51, 35.27], Meru: [0.05, 37.65], Nyeri: [-0.42, 36.95],
  Kakamega: [0.28, 34.75], Bungoma: [0.57, 34.56], Busia: [0.46, 34.11], Siaya: [0.06, 34.29], Narok: [-1.08, 35.87],
  Kajiado: [-1.85, 36.78], Embu: [-0.53, 37.45], Kirinyaga: [-0.5, 37.28], "Murang'a": [-0.72, 37.15], Nyandarua: [-0.4, 36.4],
  Laikipia: [0.2, 36.78], Kilifi: [-3.63, 39.85], Kwale: [-4.17, 39.45], Kitui: [-1.37, 38.01], Makueni: [-1.8, 37.62],
  Nandi: [0.18, 35.1], Vihiga: [0.07, 34.72], "Trans Nzoia": [1.02, 34.95], "Elgeyo-Marakwet": [0.8, 35.5], Baringo: [0.47, 35.97],
};

export const FOOD_CATEGORIES = [
  { value: "cooked_meals", label: "Cooked meals" },
  { value: "fresh_vegetables", label: "Fresh vegetables" },
  { value: "fruits", label: "Fruits" },
  { value: "bakery", label: "Bakery products" },
  { value: "grains_cereals", label: "Grains and cereals" },
  { value: "packaged", label: "Packaged food" },
  { value: "dairy", label: "Dairy products" },
  { value: "other", label: "Other eligible food" },
] as const;

export const FOOD_UNITS = [
  { value: "kg", label: "kilograms (kg)" },
  { value: "g", label: "grams (g)" },
  { value: "portions", label: "portions" },
  { value: "pieces", label: "pieces" },
  { value: "boxes", label: "boxes" },
  { value: "bags", label: "bags" },
  { value: "litres", label: "litres" },
] as const;

export const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "Gluten-free", "Dairy-free", "No pork"] as const;
export const ALLERGEN_OPTIONS = ["Nuts", "Milk", "Eggs", "Wheat/gluten", "Soy", "Fish", "Sesame"] as const;

export const PRODUCE_CATEGORIES = [
  { value: "vegetables", label: "Vegetables" },
  { value: "fruits", label: "Fruits" },
  { value: "grains", label: "Grains" },
  { value: "legumes", label: "Legumes" },
  { value: "poultry_eggs", label: "Poultry and eggs" },
  { value: "dairy", label: "Dairy" },
  { value: "seeds_seedlings", label: "Seeds and seedlings" },
  { value: "other", label: "Other" },
] as const;

export const PRODUCE_UNITS = [
  { value: "kg", label: "per kg" },
  { value: "bunch", label: "per bunch" },
  { value: "crate", label: "per crate" },
  { value: "bag", label: "per bag" },
  { value: "piece", label: "per piece" },
  { value: "head", label: "per head" },
  { value: "litre", label: "per litre" },
  { value: "tray", label: "per tray" },
] as const;

export const DELIVERY_OPTIONS = [
  { value: "collection", label: "Buyer collects" },
  { value: "local_delivery", label: "Local delivery" },
  { value: "arranged", label: "Arranged with buyer" },
] as const;

export const BUSINESS_TYPES = [
  { value: "agri_supplier", label: "Agricultural supplier" },
  { value: "farmer", label: "Farmer" },
  { value: "restaurant", label: "Restaurant" },
  { value: "supermarket", label: "Supermarket" },
  { value: "food_business", label: "Food business" },
  { value: "local_business", label: "Local business" },
  { value: "community_org", label: "Community organisation" },
  { value: "service_provider", label: "Service provider" },
] as const;

export const CAMPAIGN_TYPES = [
  { value: "sponsored_food", label: "Sponsored food listing" },
  { value: "sponsored_produce", label: "Sponsored farmer-market product" },
  { value: "agri_supplier", label: "Agricultural supplier advertisement" },
  { value: "community_business", label: "Community or business promotion" },
  { value: "educational", label: "Educational content" },
] as const;

export const CAMPAIGN_OBJECTIVES = [
  { value: "awareness", label: "Get seen" },
  { value: "traffic", label: "Send people to my website" },
  { value: "promote_listing", label: "Promote a produce listing" },
  { value: "promote_donation", label: "Promote a food donation" },
] as const;

export const AD_PLACEMENTS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "find_food", label: "Find Food" },
  { value: "farmer_market", label: "Farmer Market" },
  { value: "promote", label: "Promote & Advertise" },
  { value: "recommendations", label: "Recommendations" },
] as const;

export const REPORT_REASONS = [
  { value: "unsafe_food", label: "Food looks unsafe" },
  { value: "misleading", label: "Misleading or false" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "other", label: "Something else" },
] as const;

export function labelOf(list: readonly { value: string; label: string }[], value: string | null | undefined) {
  return list.find((x) => x.value === value)?.label ?? value ?? "";
}
