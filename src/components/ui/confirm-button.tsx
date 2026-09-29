"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Destructive action that asks for confirmation in place (no extra dialog
 * library): the first click arms it, the second click runs it, and it disarms
 * itself after a few seconds.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm delete",
  busyLabel = "Deleting…",
  onConfirm,
  icon,
  size = "sm",
  variant = "outline",
  className,
}: {
  label: string;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => Promise<void> | void;
  icon?: React.ReactNode;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "outline" | "ghost" | "destructive" | "secondary";
  className?: string;
}) {
  const [armed, setArmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={armed ? "destructive" : variant}
      disabled={busy}
      onClick={handleClick}
      title={armed ? confirmLabel : label}
      className={cn(className)}
    >
      {icon}
      {busy ? busyLabel : armed ? confirmLabel : label}
    </Button>
  );
}