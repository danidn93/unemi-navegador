import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReasonModal from "@/components/ReasonModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type LandmarkType = "plazoleta" | "bar" | "corredor" | "otro";

interface Props {
  landmarkId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Landmark = {
  id: string;
  name: string | null;
  type: LandmarkType;
  is_active: boolean | null;
};

export default function LandmarkEditModal({ landmarkId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [l, setL] = useState<Landmark | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<LandmarkType>("plazoleta");
  const [isActive, setIsActive] = useState(true);

  const [ask, setAsk] = useState<null | { fields: Array<"type" | "state">; updates: Partial<Landmark> }>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("landmarks").select("id,name,type,is_active").eq("id", landmarkId).single();
      setLoading(false);
      if (error) { toast.error("No se pudo cargar la referencia"); return; }
      const lm = data as Landmark;
      setL(lm);
      setName(lm.name ?? "");
      setType(lm.type);
      setIsActive(lm.is_active ?? true);
    })();
  }, [landmarkId]);

  const requiresReason = useMemo(() => {
    if (!l) return [];
    const arr: Array<"type" | "state"> = [];
    if (type !== l.type) arr.push("type");
    if ((isActive ?? true) !== (l.is_active ?? true)) arr.push("state");
    return arr;
  }, [l, type, isActive]);

  const save = async () => {
    if (!l) return;
    const updates: Partial<Landmark> = {
      name: name.trim() || null,
      type,
      is_active: isActive,
    };

    const needs = requiresReason;
    if (needs.length) { setAsk({ fields: needs, updates }); return; }

    try {
      setSaving(true);
      const { error } = await supabase.from("landmarks").update(updates).eq("id", l.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        entity_table: "landmarks",
        entity_id: l.id,
        action: "update",
        reason: "Actualización sin cambios críticos",
        severity: "info",
        details: { from: l, to: updates },
      });

      toast.success("Referencia actualizada");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally { setSaving(false); }
  };

  const confirmReason = async (reason: string) => {
    if (!l || !ask) return;
    try {
      setSaving(true);

      await supabase.from("notifications").insert({
        entity_table: "landmarks",
        entity_id: l.id,
        action: ask.fields.includes("state")
          ? (ask.updates.is_active ? "enable" : "disable")
          : "update",
        reason,
        severity: ask.fields.includes("state") ? "warning" : "info",
        details: { fields: ask.fields, from: { type: l.type, is_active: l.is_active }, to: ask.updates },
      });

      const { error } = await supabase.from("landmarks").update(ask.updates).eq("id", l.id);
      if (error) throw error;

      toast.success("Referencia actualizada");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally { setSaving(false); setAsk(null); }
  };

  return (
    <div className="w-[min(92vw,640px)] bg-card text-card-foreground rounded-2xl shadow-2xl border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Editar punto de referencia</h3>
        <button className="p-1 rounded hover:bg-accent" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>

      <div className="p-4 grid gap-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label>Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plazoleta, Bar, etc." />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={type} onChange={(e) => setType(e.target.value as LandmarkType)}>
                  <option value="plazoleta">Plazoleta</option>
                  <option value="bar">Bar</option>
                  <option value="corredor">Corredor</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={isActive ? "1" : "0"} onChange={(e) => setIsActive(e.target.value === "1")}>
                  <option value="1">Habilitado</option>
                  <option value="0">Deshabilitado</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={save} disabled={saving || loading}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
      </div>

      <ReasonModal
        isOpen={!!ask}
        onClose={() => setAsk(null)}
        onConfirm={confirmReason}
        title="Motivo requerido"
        subtitle="Indica el motivo del cambio de estado o tipo de la referencia."
        actionLabel="Guardar y notificar"
        requireReason
      />
    </div>
  );
}
