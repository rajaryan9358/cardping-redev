import { redirect } from "next/navigation";
import { getCurrentAdmin } from "../../lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/users");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-soft">
        <h1 className="text-xl font-semibold text-ink">CardPing Admin</h1>
        <p className="mt-1 text-sm text-muted">Staff sign-in.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
