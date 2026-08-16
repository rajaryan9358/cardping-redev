"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex w-full max-w-[420px] flex-col items-center rounded-2xl border border-border bg-white p-8 text-center shadow-soft">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-success-bg text-success-text">
          <MailCheck className="size-6" strokeWidth={2} />
        </span>
        <h1 className="text-xl font-semibold text-ink">Check your email</h1>
        <p className="pt-2 text-sm text-muted">
          If an account exists for <span className="font-semibold text-ink">{email}</span>, we&apos;ve sent a link to reset
          your password.
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setSent(false)}>
          Use a different email
        </Button>
        <Link href="/login" className="pt-6 text-sm font-semibold text-accent hover:text-accent-hover">
          &larr; Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-white p-8 shadow-soft">
      <div className="flex flex-col items-center gap-1 pb-8 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Forgot password?</h1>
        <p className="text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <TextField
          label="Email address"
          type="email"
          placeholder="name@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" className="mt-2 w-full py-3">
          Send reset link
        </Button>
      </form>

      <Link href="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={2} /> Back to login
      </Link>
    </div>
  );
}
