"use client";

import { ArrowRight, Smartphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";

type LoginMode = "password" | "otp";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  account_blocked: "This account has been blocked. Contact support for help.",
  whatsapp_otp_not_configured: "Mobile OTP sign-in isn't set up yet — use email and password.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

interface LoginAccount {
  onboarded_at: string | null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(searchParams.get("mode") === "otp" ? "otp" : "password");
  const router = useRouter();
  const authConfig = useAuthConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const { account } = await parseJsonOrThrow<{ account: LoginAccount }>(res);
      router.push(account.onboarded_at ? "/home" : "/onboarding");
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ mobile }),
      });
      await parseJsonOrThrow(res);
      router.push(`/otp?context=login&mobile=${encodeURIComponent(mobile)}`);
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-white p-8 shadow-soft">
      <div className="flex flex-col items-center gap-1 pb-8 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">CardPing</h1>
        <p className="text-sm text-muted">Sign in to your account</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>
      )}

      {mode === "password" ? (
        <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
          <TextField
            label="Email address"
            type="email"
            placeholder="name@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            labelAction={
              <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:text-accent-hover">
                Forgot password?
              </Link>
            }
          />
          <Button type="submit" className="mt-2 w-full py-3" loading={submitting}>
            Log in
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-6" onSubmit={handleSendCode}>
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="phone" className="text-xs font-semibold tracking-wide text-muted-2">
              Phone Number
            </label>
            <div className="flex items-stretch rounded-lg border border-border bg-surface-warm">
              <span className="flex items-center gap-2 border-r border-border px-3 text-sm text-ink">
                <Image src="/icons/icon-flag-in.svg" alt="" width={18} height={18} />
                +91
              </span>
              <input
                id="phone"
                type="tel"
                placeholder="00000 00000"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full rounded-r-lg px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:outline-none"
              />
            </div>
          </div>
          <Button type="submit" className="flex w-full items-center justify-center gap-2 py-3" loading={submitting}>
            Send code
            <ArrowRight className="size-4" strokeWidth={2} />
          </Button>
        </form>
      )}

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted">Or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          className="w-full gap-3 py-3"
          disabled={!authConfig.googleEnabled}
          title={authConfig.googleEnabled ? undefined : "Google sign-in isn't set up yet"}
          onClick={() => {
            window.location.href = "/api/auth/google/start";
          }}
        >
          <Image src="/icons/icon-google.svg" alt="" width={18} height={18} />
          Continue with Google
        </Button>
        {mode === "password" ? (
          <Button
            variant="secondary"
            className="w-full gap-3 py-3"
            disabled={!authConfig.whatsappOtpEnabled}
            title={authConfig.whatsappOtpEnabled ? undefined : "SMS/WhatsApp sign-in isn't set up yet — use email and password"}
            onClick={() => setMode("otp")}
          >
            <Smartphone className="size-[18px]" strokeWidth={2} />
            Continue with Mobile OTP
          </Button>
        ) : (
          <Button variant="secondary" className="w-full gap-3 py-3" onClick={() => setMode("password")}>
            <Image src="/icons/icon-envelope.svg" alt="" width={16} height={13} />
            Login with Email &amp; Password
          </Button>
        )}
      </div>

      <p className="pt-8 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-accent">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
