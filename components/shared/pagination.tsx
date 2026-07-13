"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageCount, pathname }: { page: number; pageCount: number; pathname: string }) {
  const searchParams = useSearchParams();
  const href = (target: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(target));
    return `${pathname}?${next.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-border pt-4">
      <p className="text-sm text-muted">Page <strong className="text-foreground">{page}</strong> of {pageCount}</p>
      <div className="flex gap-2">
        <Link aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")} href={href(Math.max(1, page - 1))}><ChevronLeft aria-hidden="true" className="size-4" />Previous</Link>
        <Link aria-disabled={page >= pageCount} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pageCount && "pointer-events-none opacity-50")} href={href(Math.min(pageCount, page + 1))}>Next<ChevronRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </nav>
  );
}
