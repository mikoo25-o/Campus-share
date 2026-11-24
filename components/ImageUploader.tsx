"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { imageUrl, type Bucket } from "@/lib/storage";
import { friendlyError } from "@/lib/errors";

export type UploadedImage = { path: string };

const MAX_EDGE = 1600;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** Shrinks a phone photo and re-encodes it as JPEG. This also removes location data stored in the photo. */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
  );
}

export default function ImageUploader({
  bucket,
  value,
  onChange,
  max = 5,
  label,
  hint,
  camera = true,
}: {
  bucket: Bucket;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  max?: number;
  label: string;
  hint?: string;
  camera?: boolean;
}) {
  const { supabase, user } = useAuth();
  const pick = useRef<HTMLInputElement>(null);
  const shoot = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  async function handle(files: FileList | null) {
    if (!files || !files.length || !supabase || !user) return;
    setError("");
    const room = max - value.length;
    const list = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > room) setError(`You can add up to ${max} photos.`);

    let next = [...value];
    for (const file of list) {
      if (!ACCEPT.includes(file.type)) {
        setError("Use a JPG, PNG or WebP photo.");
        continue;
      }
      if (file.size > MAX_INPUT_BYTES) {
        setError("That photo is too large. Choose one under 20 MB.");
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const blob = await prepare(file);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        next = [...next, { path }];
        onChange(next);
      } catch (e) {
        setError(friendlyError(e, "We couldn't upload that photo. Check your connection and try again."));
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (pick.current) pick.current.value = "";
    if (shoot.current) shoot.current.value = "";
  }

  async function remove(path: string) {
    onChange(value.filter((v) => v.path !== path));
    // Best effort: the file may already be referenced by a saved record, in which case the form removes the record.
    await supabase?.storage.from(bucket).remove([path]);
  }

  const full = value.length >= max;

  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {hint && <p className="mb-2 text-xs text-brand-muted">{hint}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((v) => (
          <li key={v.path} className="relative aspect-square overflow-hidden rounded-2xl border border-brand-line bg-brand-line/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(bucket, v.path) ?? ""} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => void remove(v.path)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <li key={`busy-${i}`} className="flex aspect-square items-center justify-center rounded-2xl border border-brand-line bg-brand-line/40">
            <Loader2 className="h-6 w-6 animate-spin text-brand-muted motion-reduce:animate-none" aria-label="Uploading" />
          </li>
        ))}
        {!full && (
          <li className="aspect-square">
            <button
              type="button"
              onClick={() => pick.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-line text-xs font-semibold text-brand-muted hover:bg-brand-line/40"
            >
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
              Add photo
            </button>
          </li>
        )}
      </ul>
      {camera && !full && (
        <button type="button" onClick={() => shoot.current?.click()} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-brand-line px-4 text-sm font-semibold hover:bg-brand-line/50 sm:hidden">
          <Camera className="h-4 w-4" aria-hidden="true" />
          Take a photo
        </button>
      )}
      <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} onChange={(e) => void handle(e.target.files)} />
      <input ref={shoot} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => void handle(e.target.files)} />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-brand-alert">
          {error}
        </p>
      )}
    </div>
  );
}
