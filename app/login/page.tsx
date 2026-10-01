import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Cook Assistant" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="text-display">Cook Assistant</p>
      <p className="mt-2 mb-10 text-body text-ink-muted">Plan the visit. Send the voice note.</p>
      <LoginForm />
    </main>
  );
}
