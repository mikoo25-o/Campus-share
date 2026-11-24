import RolePicker from "@/components/RolePicker";
import { parseRole } from "@/lib/roles";

export const metadata = { title: "Get started | CampusShare" };

export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-gold">
          Join the movement
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">How are you joining CampusShare?</h1>
      </header>
      <RolePicker initialRole={parseRole(role)} />
    </div>
  );
}
