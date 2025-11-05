import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReasonModal from "@/components/ReasonModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type EntranceType = "pedestrian" | "vehicular" | "both";

interface Props {
  entranceId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Entrance = {
  id: string;
  name: string | null;
  type: EntranceType;
  is_active: boolean | null;
  building_id: string | null;
};

type Building = { id: string; name: string };

export default function EntranceEditModal({ entranceId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [e, setE] = useState<Entrance | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [name, setName] = useState("");
  const [type, setType] = useState<EntranceType>("pedestrian");
  const [isActive, setIsActive] = useState(true);
  const [buildingId, setBuildingId] = useState<string | "">("");

  const [ask, setAsk] = useState<null | { fields: Array<"type" | "state">; updates: Partial<Entrance> }>(null);

  useEffect(() => {
    (async () => {
      const [entr, blds] = await Promise.all([
        supabase.from("entrances").select("id,name,type,is_active,building_id").eq("id", entranceId).single(),
        supabase.from("buildings").select("id,name").order("name", { ascending: true }),
      ]);
      setLoading(false);
      if (entr.error) { toast.error("No se pudo cargar la entrada"); return; }
      setE(entr.data as Entrance);
      setName(entr.data?.name ?? "");
      setType(entr.data?.type ?? "pedestrian");
      setIsActive(entr.data?.is_active ?? true);
      setBuildingId(entr.data?.building_id ?? "");
      if (!blds.error) setBuildings((blds.data || []) as Building[]);
    })();
  }, [entranceId]);

  const requiresReason = useMemo(() => {
    if (!e) return [];
    const fields: Array<"type" | "state"> = [];
    if (type !== e.type) fields.push("type");
    if ((isActive ?? true) !== (e.is_active ?? true)) fields.push("state");
    return fields;
  }, [e, type, isActive]);

  const save = async () => {
    if (!e) return;
    const updates: Partial<Entrance> = {
      name: name.trim() || null,
      type,
      is_active: isActive,
      building_id: buildingId || null,
    };

    const needs = requiresReason;
    if (needs.length) {
      setAsk({ fields: needs, updates });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from("entrances").update(updates).eq("id", e.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        entity_table: "entrances",
        entity_id: e.id,
        action: "update",
        reason: "Actualización sin cambios críticos",
        severity: "info",
        details: { from: e, to: updates },
        role_target: "public",
      });

      toast.success("Entrada actualizada");
      onSaved(); onClose();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally { setSaving(false); }
  };

  const confirmReason = async (reason: string) => {
    if (!e || !ask) return;
    try {
      setSaving(true);

      await supabase.from("notifications").insert({
        entity_table: "entrances",
        entity_id: e.id,
        action: ask.fields.includes("state")
          ? (ask.updates.is_active ? "enable" : "disable")
          : "update",
        reason,
        severity: ask.fields.includes("state") ? "warning" : "info",
        details: { fields: ask.fields, from: { type: e.type, is_active: e.is_active }, to: ask.updates },
        role_target: "public",
      });

      const { error } = await supabase.from("entrances").update(ask.updates).eq("id", e.id);
      if (error) throw error;

      toast.success("Entrada actualizada");
      onSaved(); onClose();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar");
    } finally { setSaving(false); setAsk(null); }
  };

  return (
    <div className="w-[min(92vw,640px)] bg-card text-card-foreground rounded-2xl shadow-2xl border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Editar entrada</h3>
        <button className="p-1 rounded hover:bg-accent" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>

      <div className="p-4 grid gap-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label>Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Puerta principal" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={type} onChange={(e) => setType(e.target.value as EntranceType)}>
                  <option value="pedestrian">Peatonal</option>
                  <option value="vehicular">Vehicular</option>
                  <option value="both">Mixta</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={isActive ? "1" : "0"} onChange={(e) => setIsActive(e.target.value === "1")}>
                  <option value="1">Habilitada</option>
                  <option value="0">Deshabilitada</option>
                </select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Edificio vinculado</Label>
              <select className="h-9 rounded-md border bg-background px-3" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                <option value="">— Ninguno —</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
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
        subtitle="Indica el motivo del cambio de estado o tipo de la entrada."
        actionLabel="Guardar y notificar"
        requireReason
      />
    </div>
  );
}
