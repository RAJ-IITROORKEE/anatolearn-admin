"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useState } from "react";

import { Breadcrumbs } from "@/components/app-shell/breadcrumbs";
import { NavList } from "@/components/app-shell/nav-list";
import { ProfileMenu } from "@/components/app-shell/profile-menu";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({ children, profile }: { children: React.ReactNode; profile: { fullName: string; email: string } }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-surface transition-[width] duration-200 lg:flex lg:flex-col", collapsed ? "w-[76px]" : "w-[260px]")}>
        <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-2")}><BrandMark compact={collapsed} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><NavList collapsed={collapsed} /></div>
        <div className="border-t border-border p-3"><Button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("w-full", collapsed && "px-0")} onClick={() => setCollapsed((value) => !value)} variant="ghost">{collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <><PanelLeftClose aria-hidden="true" className="size-5" /><span>Collapse sidebar</span></>}</Button></div>
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild><Button aria-label="Open navigation" className="lg:hidden" size="icon" variant="ghost"><Menu aria-hidden="true" className="size-5" /></Button></Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
                <Dialog.Content aria-describedby={undefined} aria-label="Navigation" className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,320px)] flex-col border-r border-border bg-surface shadow-xl">
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <div className="flex h-16 items-center justify-between border-b border-border px-4"><BrandMark /><Dialog.Close asChild><Button aria-label="Close navigation" size="icon" variant="ghost"><X aria-hidden="true" className="size-5" /></Button></Dialog.Close></div>
                  <div className="min-h-0 flex-1 overflow-y-auto"><NavList onNavigate={() => setMobileOpen(false)} /></div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <Breadcrumbs />
          </div>
          <ProfileMenu profile={profile} />
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
