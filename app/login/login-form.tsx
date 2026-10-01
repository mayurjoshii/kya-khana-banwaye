"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { inputClass, labelClass, Notice } from "@/components/ui";

import { signIn } from "./actions";

export function LoginForm() {
  const [error, action] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      {error && <Notice tone="mirchi">{error}</Notice>}
      <SubmitButton variant="primary" pending="Signing in…" className="mt-2 py-3">
        Sign in
      </SubmitButton>
    </form>
  );
}
