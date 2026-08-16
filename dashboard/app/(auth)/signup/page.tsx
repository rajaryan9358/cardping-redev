"use client";

import { BadgeCheck, Building2, Lock, LucideIcon, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

function IconField({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return (
    <div className="relative w-full">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={2} />
      <input
        className="w-full rounded-lg border border-border bg-surface-warm py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        {...props}
      />
    </div>
  );
}

export default function SignUpPage() {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/onboarding");
  }

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">CardPing</h1>
        <p className="text-sm text-muted">Create your account to start managing leads</p>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-white p-8 shadow-soft">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Full name</label>
            <IconField icon={Building2} type="text" placeholder="Jane Doe" required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Email address</label>
            <IconField icon={Mail} type="email" placeholder="you@company.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Password</label>
            <IconField icon={Lock} type="password" placeholder="••••••••" required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Confirm password</label>
            <IconField icon={Lock} type="password" placeholder="••••••••" required />
          </div>

          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" required className="mt-0.5 size-4 rounded border-border text-accent" />
            <span>
              I agree to the <span className="text-ink">Terms of Service</span> and <span className="text-ink">Privacy Policy</span>.
            </span>
          </label>

          <Button type="submit" className="w-full py-3">
            Create account
          </Button>
        </form>

        <div className="flex justify-center border-t border-border pt-6">
          <div className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2">
            <BadgeCheck className="size-4 text-accent" strokeWidth={2} />
            <span className="text-xs font-semibold tracking-wide text-accent-text">50 free scans to start, no card required</span>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-sm font-semibold text-accent">
          Log in
        </Link>
      </p>
    </div>
  );
}
