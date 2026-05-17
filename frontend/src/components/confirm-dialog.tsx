"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({ confirm: () => Promise.resolve(false) });

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolver?.(true);
    setResolver(null);
  };

  const handleCancel = () => {
    setOpen(false);
    resolver?.(false);
    setResolver(null);
  };

  const variantStyles = {
    danger: { icon: "text-destructive", bg: "bg-destructive/10", btn: "bg-destructive hover:bg-destructive/90 text-white" },
    warning: { icon: "text-[#ffae1f]", bg: "bg-[#fef5e5]", btn: "bg-[#ffae1f] hover:bg-[#ffae1f]/90 text-white" },
    info: { icon: "text-primary", bg: "bg-primary/10", btn: "bg-primary hover:bg-primary/90 text-white" },
  };
  const v = variantStyles[options?.variant || "danger"];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-xl ${v.bg} flex items-center justify-center shrink-0`}>
                <AlertTriangle className={`h-5 w-5 ${v.icon}`} />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <DialogTitle>{options?.title || (t.common.confirm_delete || "Confirm")}</DialogTitle>
                <DialogDescription>{options?.message}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={handleCancel}>
              {options?.cancelText || t.common.cancel}
            </Button>
            <Button className={`rounded-xl ${v.btn}`} onClick={handleConfirm}>
              {options?.confirmText || t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
