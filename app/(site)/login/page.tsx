import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Welcome back</h1>
        <p className="mt-1 text-brand-muted">Log in to your CampusShare account.</p>
      </header>
      <LoginForm next={next} linkError={sp.error === "link"} />
    </div>
  );
}
