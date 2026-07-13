"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, CircleUserRound, LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { logoutAction } from "@/features/auth/actions";

export function ProfileMenu({ profile }: { profile: { fullName: string; email: string } }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-left hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Open profile menu">
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary"><CircleUserRound aria-hidden="true" className="size-5" /></span>
        <span className="hidden sm:block"><span className="block max-w-40 truncate text-sm font-semibold text-foreground">{profile.fullName}</span><span className="block max-w-40 truncate text-xs text-muted">{profile.email}</span></span>
        <ChevronDown aria-hidden="true" className="hidden size-4 text-muted sm:block" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="z-50 min-w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg" sideOffset={8}>
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted">Account</DropdownMenu.Label>
          <DropdownMenu.Item asChild><Link className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-subtle" href="/settings/profile"><Settings aria-hidden="true" className="size-4" />Profile settings</Link></DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild><form action={logoutAction}><button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none hover:bg-subtle focus:bg-subtle" type="submit"><LogOut aria-hidden="true" className="size-4" />Sign out</button></form></DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
