"use server";

import { redirect } from "next/navigation";
import { adminAuthRepo } from "../../lib/repositories/adminAuth.repo";
import { createSessionCookie, verifyPassword } from "../../lib/auth";

export interface LoginState {
  error: string | null;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await adminAuthRepo.findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Incorrect email or password." };
  }

  await createSessionCookie(user.id);
  redirect("/users");
}
