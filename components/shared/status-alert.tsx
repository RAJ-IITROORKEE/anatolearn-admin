import { CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

const variants = {
  success: { icon: CircleCheck, className: "border-success/20 bg-success-soft text-success" },
  warning: { icon: TriangleAlert, className: "border-warning/20 bg-warning-soft text-warning" },
  info: { icon: Info, className: "border-primary/20 bg-primary-soft text-primary" },
};

export function StatusAlert({ children, variant = "info" }: { children: React.ReactNode; variant?: keyof typeof variants }) {
  const { className, icon: Icon } = variants[variant];
  return <div className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm font-medium", className)} role="status"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="text-body">{children}</span></div>;
}
