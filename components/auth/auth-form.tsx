"use client";

import { useActionState } from "react";

import type { AuthActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

type Field = { name: string; label: string; type: "email" | "password"; autoComplete: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  fields: Field[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {state.error ? <p className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.success ? <p className="rounded-xl bg-success-soft p-3 text-sm text-success" role="status">{state.success}</p> : null}
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-2 block text-sm font-semibold" htmlFor={field.name}>{field.label}</label>
          <input autoComplete={field.autoComplete} className="min-h-11 w-full rounded-xl border border-border bg-subtle px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" disabled={pending} id={field.name} name={field.name} required type={field.type} />
        </div>
      ))}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Please wait..." : submitLabel}</Button>
    </form>
  );
}
