// src/components/ReasonModal.tsx
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;

  title?: string;
  subtitle?: string;
  actionLabel?: string;
  requireReason?: boolean;
  initialReason?: string;
};

export default function ReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Motivo requerido",
  subtitle = "Describe brevemente el motivo de esta acción. Este texto se registrará en el sistema de notificaciones.",
  actionLabel = "Confirmar",
  requireReason = true,
  initialReason = "",
}: Props) {
  const [reason, setReason] = useState(initialReason);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason(initialReason);
      setTouched(false);
      setBusy(false);
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }, [isOpen, initialReason]);

  if (!isOpen) return null;

  const mustBlock = requireReason && reason.trim().length < 3;

  const handleConfirm = async () => {
    try {
      setTouched(true);
      if (mustBlock) return;
      setBusy(true);
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Escape" && !busy) {
      e.preventDefault();
      onClose();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter" && !busy) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[4000] flex items-center justify-center p-4"
      onKeyDown={onKeyDown}
      onClick={() => { if (!busy) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative w-[min(92vw,560px)] bg-card text-card-foreground rounded-2xl shadow-2xl border border-border z-[4010]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button
            className="p-1 rounded hover:bg-accent disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 grid gap-3">
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">
              Motivo {requireReason ? "(requerido)" : "(opcional)"}
            </span>
            <textarea
              ref={textRef}
              className="min-h-[100px] px-3 py-2 rounded-md border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: Mantenimiento / Cambio de uso / Seguridad…"
              disabled={busy}
            />
            {touched && mustBlock && (
              <span className="text-[11px] text-red-600">
                Escribe al menos 3 caracteres.
              </span>
            )}
          </label>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 rounded border disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="px-3 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
            onClick={handleConfirm}
            disabled={busy || mustBlock}
          >
            {busy ? "Guardando…" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
