"use client";

import { useParams } from "next/navigation";
import ListingForm from "@/components/ListingForm";
import { PageHeader } from "@/components/ui";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Edit listing" />
      <ListingForm listingId={id} />
    </div>
  );
}
