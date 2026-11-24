import SignUpForm from "@/components/SignUpForm";
import { parseRole } from "@/lib/roles";

export const metadata = { title: "Create your account | CampusShare" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Create Your Account</h1>
        <p className="mt-1 text-brand-muted">Join CampusShare and be part of the solution. It&apos;s free.</p>
      </header>
      <SignUpForm initialRole={parseRole(role)} />
    </div>
  );
}
