"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, LoginState } from "./actions";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending}>
      Sign in
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField name="email" type="email" label="Email" autoComplete="username" required />
      <TextField name="password" type="password" label="Password" autoComplete="current-password" required />
      {state.error && <p className="text-sm text-danger-text">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
