"use client";

import { ArrowRight, Smartphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

type LoginMode = "password" | "otp";

function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(searchParams.get("mode") === "otp" ? "otp" : "password");
  const router = useRouter();

  function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    router.push("/otp?context=login");
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-white p-8 shadow-soft">
      <div className="flex flex-col items-center gap-1 pb-8 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">CardPing</h1>
        <p className="text-sm text-muted">Sign in to your account</p>
      </div>

      {mode === "password" ? (
        <form className="flex flex-col gap-4" onSubmit={handleSendCode}>
          <TextField label="Email address" type="email" placeholder="name@company.com" required />
          <TextField
            label="Password"
            type="password"
            placeholder="••••••••"
            required
            labelAction={
              <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:text-accent-hover">
                Forgot password?
              </Link>
            }
          />
          <Button type="submit" className="mt-2 w-full py-3">
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
                className="w-full rounded-r-lg px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:outline-none"
              />
            </div>
          </div>
          <Button type="submit" className="flex w-full items-center justify-center gap-2 py-3">
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
        <Button variant="secondary" className="w-full gap-3 py-3">
          <Image src="/icons/icon-google.svg" alt="" width={18} height={18} />
          Continue with Google
        </Button>
        {mode === "password" ? (
          <Button variant="secondary" className="w-full gap-3 py-3" onClick={() => setMode("otp")}>
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
