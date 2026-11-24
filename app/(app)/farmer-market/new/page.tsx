"use client";

import { useAuth } from "@/components/AuthProvider";
import ListingForm from "@/components/ListingForm";
import { EmptyState, LinkButton, PageHeader, Skeleton } from "@/components/ui";

export default function NewListingPage() {
  const { profile, loading } = useAuth();
  if (loading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!profile?.is_farmer)
    return <EmptyState title="Set up your seller profile first" text="Buyers need to know who they are buying from." action={<LinkButton href="/farmer-market/profile">Create seller profile</LinkButton>} />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="List produce" subtitle="Tell buyers what you have. Prices are in Kenyan shillings." />
      <ListingForm />
    </div>
  );
}
