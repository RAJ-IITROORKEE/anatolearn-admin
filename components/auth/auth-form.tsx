"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useId, useState } from "react";

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
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const errorId = useId();

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {state.error ? <p className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive" id={errorId} role="alert">{state.error}</p> : null}
      {state.success ? <p className="rounded-xl bg-success-soft p-3 text-sm text-success" role="status">{state.success}</p> : null}
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-2 block text-sm font-semibold" htmlFor={field.name}>{field.label}</label>
          <div className="relative">
            <input aria-describedby={state.error ? errorId : undefined} aria-invalid={state.error ? true : undefined} autoComplete={field.autoComplete} className="min-h-11 w-full rounded-xl border border-border bg-subtle px-3 pr-12 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" disabled={pending} id={field.name} name={field.name} required type={field.type === "password" && visiblePasswords[field.name] ? "text" : field.type} />
            {field.type === "password" ? <button aria-label={visiblePasswords[field.name] ? "Hide password" : "Show password"} aria-pressed={Boolean(visiblePasswords[field.name])} className="absolute inset-y-0 right-0 inline-flex min-w-11 items-center justify-center rounded-r-xl text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" disabled={pending} onClick={() => setVisiblePasswords((current) => ({ ...current, [field.name]: !current[field.name] }))} type="button">{visiblePasswords[field.name] ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}</button> : null}
          </div>
        </div>
      ))}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Please wait..." : submitLabel}</Button>
    </form>
  );
}
