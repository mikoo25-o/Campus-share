import { ForgotPasswordForm } from "@/components/PasswordFlows";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Reset your password</h1>
        <p className="mt-1 text-brand-muted">Enter your email and we&apos;ll send you a link.</p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
