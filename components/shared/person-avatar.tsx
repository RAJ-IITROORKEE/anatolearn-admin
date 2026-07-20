import { UserRound } from "lucide-react";
import Image from "next/image";

export function PersonAvatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  const pixels = size === "sm" ? 32 : 40;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return url
    ? <Image alt={`${name}'s avatar`} className={`${dimensions} shrink-0 rounded-full object-cover ring-1 ring-border`} height={pixels} src={url} unoptimized width={pixels} />
    : <span aria-label={`${name} avatar unavailable`} className={`${dimensions} inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary ring-1 ring-border`}>{initials || <UserRound aria-hidden className="size-4" />}</span>;
}
