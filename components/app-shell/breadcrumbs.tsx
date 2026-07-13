"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumbs() {
  const segments = usePathname().split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="flex items-center gap-1 text-sm text-muted">
        <li><Link className="hover:text-primary" href="/dashboard">Admin</Link></li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const label = segment.replaceAll("-", " ");
          return <li className="flex min-w-0 items-center gap-1" key={href}><ChevronRight aria-hidden="true" className="size-4 shrink-0" /><Link aria-current={index === segments.length - 1 ? "page" : undefined} className="truncate capitalize text-body hover:text-primary" href={href}>{label}</Link></li>;
        })}
      </ol>
    </nav>
  );
}
