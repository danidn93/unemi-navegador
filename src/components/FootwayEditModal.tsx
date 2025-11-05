import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReasonModal from "@/components/ReasonModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type FootwayState = "ABIERTO" | "CERRADO";
type FootwayTransit = "pedestrian" | "vehicular" | "both";

interface Props {
  footwayId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Footway = {
  id: string;
  name: string | null;
  state: FootwayState;
  access_type: FootwayTransit;
};

export default function FootwayEditModal({ footwayId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fw, setFw] = useState<Footway | null>(null);

  // form
  const [name, setName] = useState("");
  const [state, setState] = useState<FootwayState>("ABIERTO");
  const [access, setAccess] = useState<FootwayTransit>("pedestrian");

  // reason
  const [ask, setAsk] = useState<null | {
    reasonFor: Array<"state" | "type">;
    payload: Partial<Footway>;
  }>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("footways")
        .select("id,name,state,access_type")
        .eq("id", footwayId)
        .single();
      setLoading(false);
      if (error) {
        toast.error("No se pudo cargar la calle");
        return;
      }
      const f = data as Footway;
      setFw(f);
      setName(f.name ?? "");
      setState(f.state);
      setAccess(f.access_type);
    })();
  }, [footwayId]);

  const requiresReason = useMemo(() => {
    if (!fw) return [];
    const changes: Array<"state" | "type"> = [];
    if (state !== fw.state) changes.push("state");
    if (access !== fw.access_type) changes.push("type");
    return changes;
  }, [fw, state, access]);

  const handleSave = async () => {
    if (!fw) return;
    const updates: Partial<Footway> = {
      name: name.trim() || null,
      state,
      access_type: access,
    };

    // Si cambió estado o tipo, pedir motivo y diferir update
    const needs = requiresReason;
    if (needs.length) {
      setAsk({ reasonFor: needs, payload: updates });
      return;
    }

    // Sin motivo: guardar y notificar cambios no sensibles
    try {
      setSaving(true);
      const { error } = await supabase.from("footways").update(updates).eq("id", fw.id);
      if (error) throw error;

      // notification (sin reason)
      await supabase.from("notifications").insert({
        entity_table: "footways",
        entity_id: fw.id,
        action: "update",
        reason: "Actualización de campos no sensibles",
        severity: "info",
        details: { from: fw, to: updates },
        role_target: "public",
      });

      toast.success("Calle actualizada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReason = async (reason: string) => {
    if (!fw || !ask) return;
    try {
      setSaving(true);
      const updates = ask.payload;

      // 1) notification con reason
      await supabase.from("notifications").insert({
        entity_table: "footways",
        entity_id: fw.id,
        action: ask.reasonFor.includes("state")
          ? updates.state === "CERRADO"
            ? "disable"
            : "enable"
          : "update",
        reason,
        severity: ask.reasonFor.includes("state") ? "warning" : "info",
        details: {
          fields: ask.reasonFor,
          from: { state: fw.state, access_type: fw.access_type },
          to: { state: updates.state, access_type: updates.access_type },
        },
        role_target: "public",
      });

      // 2) update
      const { error } = await supabase.from("footways").update(updates).eq("id", fw.id);
      if (error) throw error;

      toast.success("Calle actualizada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
      setAsk(null);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter") {
      e.preventDefault();
      if (!saving) void handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!saving) onClose();
    }
  };

  return (
    <div className="w-[min(92vw,640px)] bg-card text-card-foreground rounded-2xl shadow-2xl border" onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Editar calle</h3>
        <button className="p-1 rounded hover:bg-accent" onClick={onClose} aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 grid gap-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label>Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Calle interna, sendero, etc." />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={state} onChange={(e) => setState(e.target.value as FootwayState)}>
                  <option value="ABIERTO">ABIERTO</option>
                  <option value="CERRADO">CERRADO</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={access} onChange={(e) => setAccess(e.target.value as FootwayTransit)}>
                  <option value="pedestrian">Peatonal</option>
                  <option value="vehicular">Vehicular</option>
                  <option value="both">Mixta</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || loading}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
      </div>

      <ReasonModal
        isOpen={!!ask}
        onClose={() => setAsk(null)}
        onConfirm={handleConfirmReason}
        title="Motivo requerido"
        subtitle="Describe brevemente por qué cambias el estado o tipo de la calle."
        actionLabel="Guardar y notificar"
        requireReason
      />
    </div>
  );
}
