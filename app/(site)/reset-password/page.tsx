import { ResetPasswordForm } from "@/components/PasswordFlows";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Choose a new password</h1>
      </header>
      <ResetPasswordForm />
    </div>
  );
}
