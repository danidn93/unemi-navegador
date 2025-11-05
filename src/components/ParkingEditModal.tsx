import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReasonModal from "@/components/ReasonModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type ParkingType = "car" | "motorcycle" | "mixed";

interface Props {
  parkingId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Parking = {
  id: string;
  name: string | null;
  type: ParkingType;
  is_active: boolean | null;
  capacity: number | null;
  building_id: string | null;
};

type Building = { id: string; name: string };

export default function ParkingEditModal({ parkingId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<Parking | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [name, setName] = useState("");
  const [type, setType] = useState<ParkingType>("car");
  const [isActive, setIsActive] = useState(true);
  const [capacity, setCapacity] = useState<string>("");
  const [buildingId, setBuildingId] = useState<string | "">("");

  const [ask, setAsk] = useState<null | { fields: Array<"type" | "state">; updates: Partial<Parking> }>(null);

  useEffect(() => {
    (async () => {
      const [res, blds] = await Promise.all([
        supabase.from("parkings").select("id,name,type,is_active,capacity,building_id").eq("id", parkingId).single(),
        supabase.from("buildings").select("id,name").order("name", { ascending: true }),
      ]);
      setLoading(false);
      if (res.error) { toast.error("No se pudo cargar el parqueadero"); return; }
      const pk = res.data as Parking;
      setP(pk);
      setName(pk.name ?? "");
      setType(pk.type ?? "car");
      setIsActive(pk.is_active ?? true);
      setCapacity(pk.capacity != null ? String(pk.capacity) : "");
      setBuildingId(pk.building_id ?? "");
      if (!blds.error) setBuildings((blds.data || []) as Building[]);
    })();
  }, [parkingId]);

  const requiresReason = useMemo(() => {
    if (!p) return [];
    const arr: Array<"type" | "state"> = [];
    if (type !== p.type) arr.push("type");
    if ((isActive ?? true) !== (p.is_active ?? true)) arr.push("state");
    return arr;
  }, [p, type, isActive]);

  const save = async () => {
    if (!p) return;
    const cap = capacity.trim() === "" ? null : Number(capacity);
    if (capacity !== "" && (!Number.isFinite(cap as number) || (cap as number) < 0)) {
      toast.error("Capacidad inválida");
      return;
    }
    const updates: Partial<Parking> = {
      name: name.trim() || null,
      type,
      is_active: isActive,
      capacity: cap,
      building_id: buildingId || null,
    };

    const needs = requiresReason;
    if (needs.length) { setAsk({ fields: needs, updates }); return; }

    try {
      setSaving(true);
      const { error } = await supabase.from("parkings").update(updates).eq("id", p.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        entity_table: "parkings",
        entity_id: p.id,
        action: "update",
        reason: "Actualización sin cambios críticos",
        severity: "info",
        details: { from: p, to: updates },
      });

      toast.success("Parqueadero actualizado");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const confirmReason = async (reason: string) => {
    if (!p || !ask) return;
    try {
      setSaving(true);

      await supabase.from("notifications").insert({
        entity_table: "parkings",
        entity_id: p.id,
        action: ask.fields.includes("state")
          ? (ask.updates.is_active ? "enable" : "disable")
          : "update",
        reason,
        severity: ask.fields.includes("state") ? "warning" : "info",
        details: { fields: ask.fields, from: { type: p.type, is_active: p.is_active }, to: ask.updates },
      });

      const { error } = await supabase.from("parkings").update(ask.updates).eq("id", p.id);
      if (error) throw error;

      toast.success("Parqueadero actualizado");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
      setAsk(null);
    }
  };

  return (
    <div className="w-[min(92vw,640px)] bg-card text-card-foreground rounded-2xl shadow-2xl border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Editar parqueadero</h3>
        <button className="p-1 rounded hover:bg-accent" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>

      <div className="p-4 grid gap-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label>Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parqueadero norte" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={type} onChange={(e) => setType(e.target.value as ParkingType)}>
                  <option value="car">Autos</option>
                  <option value="motorcycle">Motos</option>
                  <option value="mixed">Mixto</option>
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

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Capacidad (opcional)</Label>
                <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Edificio vinculado</Label>
                <select className="h-9 rounded-md border bg-background px-3" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
        subtitle="Indica el motivo del cambio de estado o tipo del parqueadero."
        actionLabel="Guardar y notificar"
        requireReason
      />
    </div>
  );
}
