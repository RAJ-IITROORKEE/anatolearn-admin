"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function UnsavedNavigationGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [destination, setDestination] = useState<string | null>(null);
  const currentUrl = useRef("");

  useEffect(() => {
    currentUrl.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }, [pathname]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const target = `${url.pathname}${url.search}${url.hash}`;
      if (target === currentUrl.current || (url.pathname === window.location.pathname && url.search === window.location.search && url.hash)) return;
      event.preventDefault();
      setDestination(target);
    };
    const popState = () => {
      const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (target === currentUrl.current) return;
      window.history.pushState(null, "", currentUrl.current);
      setDestination(target);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", popState);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", popState);
    };
  }, [dirty]);

  return <Dialog.Root onOpenChange={(open) => { if (!open) setDestination(null); }} open={destination !== null}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]" />
      <Dialog.Content aria-describedby="unsaved-navigation-description" className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl focus:outline-none" role="alertdialog">
        <Dialog.Title className="text-xl font-bold text-foreground">Discard unsaved campaign changes?</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm leading-6 text-muted" id="unsaved-navigation-description">Your edits have not been saved. Stay on this page or leave without keeping them.</Dialog.Description>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Dialog.Close asChild><Button variant="outline">Keep editing</Button></Dialog.Close><Button onClick={() => { const target = destination; setDestination(null); if (target) router.push(target); }} variant="destructive">Discard and leave</Button></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
