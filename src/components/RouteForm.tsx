// src/components/RouteForm.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type StepKind = "room" | "landmark" | "footway" | "entrance" | "parking" | "custom";

type MinimalRoom = {
  id: string;
  name: string;
  directions: string | null;
  floor: { id: string; floor_number: number; building: { id: string; name: string } };
};
type MinimalLandmark = { id: string; name: string | null };
type MinimalFootway = { id: string; name: string | null };
type MinimalEntrance = { id: string; name: string | null };
type MinimalParking = { id: string; name: string | null };

type StepDraft = {
  kind: StepKind;
  room_id?: string | null;
  landmark_id?: string | null;
  footway_id?: string | null;
  entrance_id?: string | null;
  parking_id?: string | null;
  custom_instruction?: string | null;
};

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function RouteForm({ onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // catálogos mínimos
  const [rooms, setRooms] = useState<MinimalRoom[]>([]);
  const [landmarks, setLandmarks] = useState<MinimalLandmark[]>([]);
  const [footways, setFootways] = useState<MinimalFootway[]>([]);
  const [entrances, setEntrances] = useState<MinimalEntrance[]>([]);
  const [parkings, setParkings] = useState<MinimalParking[]>([]);

  // paso en edición
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [kind, setKind] = useState<StepKind>("room");
  const [entityId, setEntityId] = useState<string>("");
  const [customInstruction, setCustomInstruction] = useState("");

  const lastRoom = useMemo(() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.kind === "room" && s.room_id) {
        return rooms.find(r => r.id === s.room_id) || null;
      }
    }
    return null;
  }, [steps, rooms]);

  const selectedRoom = useMemo(
    () => rooms.find(r => r.id === entityId) || null,
    [entityId, rooms]
  );

  // ¿mismo bloque/piso que el último room?
  const sameBlockAndFloor = useMemo(() => {
    if (!lastRoom || kind !== "room" || !selectedRoom) return false;
    return (
      lastRoom.floor.building.id === selectedRoom.floor.building.id &&
      lastRoom.floor.id === selectedRoom.floor.id
    );
  }, [lastRoom, kind, selectedRoom]);

  useEffect(() => {
    (async () => {
      try {
        // rooms (incluye floor + building para la comparación)
        const r = await supabase
          .from("rooms")
          .select(`
            id, name, directions,
            floor:floors(id, floor_number,
              building:buildings(id, name)
            )
          `)
          .order("name", { ascending: true });
        if (r.error) throw r.error;
        setRooms((r.data || []) as unknown as MinimalRoom[]);

        const lm = await supabase.from("landmarks").select("id,name").order("name", { ascending: true });
        if (!lm.error) setLandmarks((lm.data || []) as MinimalLandmark[]);

        const fw = await supabase.from("footways").select("id,name").order("created_at", { ascending: true });
        if (!fw.error) setFootways((fw.data || []) as MinimalFootway[]);

        const en = await supabase.from("entrances").select("id,name").order("created_at", { ascending: true });
        if (!en.error) setEntrances((en.data || []) as MinimalEntrance[]);

        const pk = await supabase.from("parkings").select("id,name").order("created_at", { ascending: true });
        if (!pk.error) setParkings((pk.data || []) as MinimalParking[]);
      } catch (err) {
        console.error(err);
        toast.error("No se pudieron cargar catálogos");
      }
    })();
  }, []);

  // Primer paso: si el kind es room y no hay pasos aún, pre-llenar con directions
  useEffect(() => {
    if (steps.length === 0 && kind === "room" && selectedRoom) {
      setCustomInstruction(selectedRoom.directions || "");
    }
  }, [kind, selectedRoom, steps.length]);

  const addStep = () => {
    const draft: StepDraft = { kind, custom_instruction: customInstruction.trim() || null };

    if (kind !== "custom" && !entityId) {
      toast.error("Selecciona un elemento");
      return;
    }

    if (kind === "room") draft.room_id = entityId;
    if (kind === "landmark") draft.landmark_id = entityId;
    if (kind === "footway") draft.footway_id = entityId;
    if (kind === "entrance") draft.entrance_id = entityId;
    if (kind === "parking") draft.parking_id = entityId;

    setSteps(prev => [...prev, draft]);
    // preparar siguiente
    setCustomInstruction("");
    setEntityId("");
    setKind("room");
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps(prev => {
      const arr = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  };

  const saveRoute = async () => {
    if (!name.trim()) return toast.error("Ingresa un nombre para el recorrido");
    if (steps.length === 0) return toast.error("Agrega al menos un paso");

    try {
      setSaving(true);
      const { data: r, error } = await supabase
        .from("routes")
        .insert({ name: name.trim(), description: description.trim() || null })
        .select("id")
        .single();
      if (error) throw error;

      const routeId = r.id as string;
      const payload = steps.map((s, i) => ({
        route_id: routeId,
        room_id: s.room_id ?? null,
        landmark_id: s.landmark_id ?? null,
        footway_id: s.footway_id ?? null,
        entrance_id: s.entrance_id ?? null,
        parking_id: s.parking_id ?? null,
        custom_instruction: s.custom_instruction ?? null,
        order_index: i + 1,
      }));

      const { error: e2 } = await supabase.from("route_steps").insert(payload);
      if (e2) throw e2;

      toast.success("Recorrido creado");
      onCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo crear el recorrido");
    } finally {
      setSaving(false);
    }
  };

  const entityOptions = () => {
    if (kind === "room") return rooms.map(r => ({ id: r.id, label: `${r.name} — ${r.floor.building.name} · Piso ${r.floor.floor_number}` }));
    if (kind === "landmark") return landmarks.map(l => ({ id: l.id, label: l.name || "(sin nombre)" }));
    if (kind === "footway") return footways.map(f => ({ id: f.id, label: f.name || "(sin nombre)" }));
    if (kind === "entrance") return entrances.map(e => ({ id: e.id, label: e.name || "(sin nombre)" }));
    if (kind === "parking") return parkings.map(p => ({ id: p.id, label: p.name || "(sin nombre)" }));
    return [];
  };

  return (
    <div className="relative bg-card text-card-foreground w-[min(96vw,900px)] rounded-2xl border shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-lg font-semibold">Nuevo recorrido</h3>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </div>

      <div className="p-4 grid gap-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Desde entrada principal a Secretaría" />
          </div>
          <div className="grid gap-1.5">
            <Label>Descripción (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción" />
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-sm font-medium mb-2">Añadir paso</div>
          <div className="grid md:grid-cols-[160px_1fr] gap-3 items-start">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => { setKind(v as StepKind); setEntityId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Habitación (room)</SelectItem>
                  <SelectItem value="landmark">Referencia</SelectItem>
                  <SelectItem value="entrance">Entrada</SelectItem>
                  <SelectItem value="parking">Parqueadero</SelectItem>
                  <SelectItem value="footway">Calle</SelectItem>
                  <SelectItem value="custom">Instrucción libre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind !== "custom" ? (
              <div className="grid gap-1.5">
                <Label>Elemento</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {entityOptions().map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Lógica: si el paso anterior fue un room y este también, y están en mismo bloque+piso -> permitir instrucciones adicionales */}
                {sameBlockAndFloor && (
                  <div className="text-xs text-muted-foreground">
                    Mismo bloque y piso que el paso anterior — puedes añadir instrucciones adicionales.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Instrucción</Label>
                <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="(Etiqueta opcional para identificar este paso)" />
              </div>
            )}
          </div>

          <div className="grid gap-1.5 mt-3">
            <Label>Instrucciones adicionales (opcional)</Label>
            <Textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder={steps.length === 0 && kind === "room" ? "Se prellenó con las indicaciones del primer destino (si tenía)." : "Ej.: Avanza por el corredor hasta el aula del fondo."}
            />
          </div>

          <div className="mt-3 flex justify-end">
            <Button onClick={addStep}>Añadir paso</Button>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Pasos ({steps.length})</div>
          {steps.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin pasos aún.</div>
          ) : (
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="rounded border p-2 flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">#{i + 1} — {s.kind}</div>
                    {s.room_id && <div className="text-muted-foreground text-xs">room_id: {s.room_id}</div>}
                    {s.landmark_id && <div className="text-muted-foreground text-xs">landmark_id: {s.landmark_id}</div>}
                    {s.footway_id && <div className="text-muted-foreground text-xs">footway_id: {s.footway_id}</div>}
                    {s.entrance_id && <div className="text-muted-foreground text-xs">entrance_id: {s.entrance_id}</div>}
                    {s.parking_id && <div className="text-muted-foreground text-xs">parking_id: {s.parking_id}</div>}
                    {s.custom_instruction && <div className="text-xs mt-1">ℹ️ {s.custom_instruction}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</Button>
                    <Button size="sm" variant="secondary" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeStep(i)}>Eliminar</Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={saveRoute} disabled={saving}>{saving ? "Guardando…" : "Guardar recorrido"}</Button>
      </div>
    </div>
  );
}
