export type Bucket = "donation-images" | "produce-images" | "campaign-images" | "avatars";

/** Public URL for a stored image. Returns null when Supabase is not configured or there is no path. */
export function imageUrl(bucket: Bucket, path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export const FIRST_IMAGE = <T extends { sort_order: number; storage_path: string }>(images: T[] | undefined | null) =>
  images && images.length ? [...images].sort((a, b) => a.sort_order - b.sort_order)[0].storage_path : null;
