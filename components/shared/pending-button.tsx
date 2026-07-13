import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export function PendingButton({ children, pending, pendingLabel = "Saving", ...props }: ComponentProps<typeof Button> & { pending?: boolean; pendingLabel?: string }) {
  return <Button aria-disabled={pending} disabled={pending || props.disabled} {...props}>{pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{pending ? pendingLabel : children}</Button>;
}
