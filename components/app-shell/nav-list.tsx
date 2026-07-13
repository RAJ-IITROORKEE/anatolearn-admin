"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigation } from "@/components/app-shell/navigation";
import { cn } from "@/lib/utils";

export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="space-y-6 px-3 py-5">
      {navigation.map((group) => (
        <div key={group.label}>
          {!collapsed && <p className="mb-2 px-3 text-xs font-semibold text-muted">{group.label}</p>}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-body transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active && "bg-primary-soft font-semibold text-primary hover:bg-primary-soft hover:text-primary",
                      collapsed && "justify-center px-0",
                      item.accent === "quiz" && !active && "border-l-2 border-quiz",
                      item.accent === "test" && !active && "border-l-2 border-test",
                    )}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
