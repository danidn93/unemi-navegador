import React, { useEffect, useMemo, useState } from "react";
import { X, ArrowUp, ArrowDown, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RoomRow = {
  id: string;
  name: string;
  room_number?: string | null;
  directions?: string | null;
  floor?: {
    id: string;
    floor_number: number;
    floor_name?: string | null;
    building?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type Step = {
  room: RoomRow;
  instruction: string;
};

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function RouteCreateModal({ isOpen = true, onClose, onCreated }: Props) {
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoadingRooms(true);
      const { data, error } = await supabase
        .from("rooms")
        .select(`
          id, name, room_number, directions,
          floor:floor_id( 
            id, floor_number, floor_name,
            building:buildings(id, name)
          )
        `)
        .order("name", { ascending: true });
      if (error) throw error;
      setRooms((data || []) as RoomRow[]);
    } catch (err: any) {
      console.error("[RouteCreateModal] loadRooms", err);
      toast.error("No se pudieron cargar las habitaciones");
    } finally {
      setLoadingRooms(false);
    }
  };

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) =>
      (r.name || "").toLowerCase().includes(q) ||
      (r.room_number || "").toLowerCase().includes(q) ||
      (r.floor?.building?.name || "").toLowerCase().includes(q)
    );
  }, [rooms, search]);

  const addSelectedRoom = () => {
    if (!selectedRoomId) return;
    const r = rooms.find((x) => x.id === selectedRoomId);
    if (!r) return;
    const defaultInstruction = steps.length === 0 ? (r.directions ?? "") : "";
    setSteps((s) => [...s, { room: r, instruction: defaultInstruction }]);
    setSelectedRoomId("");
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setSteps((s) => {
      const copy = [...s];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const moveDown = (index: number) => {
    setSteps((s) => {
      if (index >= s.length - 1) return s;
      const copy = [...s];
      [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]];
      return copy;
    });
  };

  const removeStep = (index: number) => {
    setSteps((s) => s.filter((_, i) => i !== index));
  };

  const canEditInstructionFor = (idx: number) => {
    if (idx === 0) return true;
    const prev = steps[idx - 1]?.room;
    const cur = steps[idx]?.room;
    if (!prev || !cur) return true;
    const sameBuilding =
      prev.floor?.building?.id &&
      cur.floor?.building?.id &&
      prev.floor.building.id === cur.floor.building.id;
    const sameFloor = prev.floor?.id && cur.floor?.id && prev.floor.id === cur.floor.id;
    return sameBuilding && sameFloor;
  };

  const validateMandatoryInstructions = () => {
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1]?.room;
      const b = steps[i]?.room;
      if (!a || !b) continue;
      const sameBuilding =
        a.floor?.building?.id && b.floor?.building?.id && a.floor.building.id === b.floor.building.id;
      const sameFloor = a.floor?.id && b.floor?.id && a.floor.id === b.floor.id;
      if (sameBuilding && sameFloor) {
        const instr = (steps[i].instruction || "").trim();
        if (!instr) {
          toast.error(
            `El paso #${i + 1} requiere instrucciones por estar en el mismo bloque y piso que el anterior.`
          );
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nombre de recorrido requerido"); return; }
    if (steps.length === 0) { toast.error("Agrega al menos un paso"); return; }
    if (!validateMandatoryInstructions()) return;

    try {
      setSaving(true);

      const { data: routeData, error: rErr } = await supabase
        .from("routes")
        .insert({ name: name.trim(), description: description.trim() || null })
        .select("id")
        .single();

      if (rErr || !routeData?.id) throw rErr || new Error("No se obtuvo id del recorrido");

      const routeId = routeData.id;

      const rows = steps.map((s, idx) => ({
        route_id: routeId,
        room_id: s.room.id,
        order_index: idx + 1,
        custom_instruction: s.instruction || null,
      }));

      const { error: stErr } = await supabase.from("route_steps").insert(rows);
      if (stErr) {
        await supabase.from("routes").delete().eq("id", routeId);
        throw stErr;
      }

      toast.success("Recorrido creado");
      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error("[RouteCreateModal] save", err);
      toast.error(err?.message || "No se pudo crear el recorrido");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} />
      <div className="relative w-[min(92vw,900px)] max-h-[90vh] overflow-auto bg-card text-card-foreground rounded-2xl shadow-2xl border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Crear recorrido</h3>
          <button className="p-1 rounded hover:bg-accent" onClick={() => !saving && onClose()}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 grid gap-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recorrido: Biblioteca → Secretaría" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción (opcional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Buscador de habitaciones */}
          <div className="grid gap-1.5">
            <Label>Buscar habitación</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                className="pl-8"
                placeholder="Filtra por nombre, código o edificio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Agregar paso */}
          <div className="grid gap-1.5">
            <Label>Agregar paso (selecciona habitación)</Label>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded border px-2 py-2 bg-background"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
              >
                <option value="">— Selecciona habitación —</option>
                {filteredRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.room_number ? `(${r.room_number})` : ""} — {r.floor?.building?.name ?? ""}
                  </option>
                ))}
              </select>
              <Button onClick={addSelectedRoom} disabled={!selectedRoomId || loadingRooms}>
                Añadir
              </Button>
            </div>
            <div className="text-[12px] text-muted-foreground">El primer paso puede copiar “directions” de la habitación, si existe.</div>
          </div>

          {/* Lista pasos */}
          <div className="grid gap-2">
            <Label>Pasos ({steps.length})</Label>
            <div className="space-y-2">
              {steps.map((s, idx) => (
                <div key={s.room.id + "-" + idx} className="p-2 rounded border flex gap-3 items-start">
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          {idx + 1}. {s.room.name} {s.room.room_number ? `(${s.room.room_number})` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.room.floor?.building?.name ?? "—"} · Piso {s.room.floor?.floor_number ?? "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1 rounded hover:bg-muted/30" onClick={() => moveUp(idx)} disabled={idx === 0}>
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-muted/30"
                          onClick={() => moveDown(idx)}
                          disabled={idx === steps.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button className="p-1 rounded hover:bg-muted/30" onClick={() => removeStep(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2">
                      <Label className="text-xs">
                        Instrucción {idx > 0 && canEditInstructionFor(idx) ? "(obligatoria si mismo bloque/piso)" : "(opcional)"}
                      </Label>
                      <Textarea
                        value={s.instruction}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSteps((prev) => prev.map((p, i) => (i === idx ? { ...p, instruction: v } : p)));
                        }}
                        placeholder={
                          idx === 0
                            ? "Se puede tomar la indicación por defecto del destino (si existe)."
                            : canEditInstructionFor(idx)
                            ? "Escribe la guía entre estos dos pasos."
                            : "No editable (diferente bloque/piso)"
                        }
                        disabled={!canEditInstructionFor(idx)}
                        className={!canEditInstructionFor(idx) ? "opacity-60" : ""}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || steps.length === 0}>
            {saving ? "Guardando…" : "Crear recorrido"}
          </Button>
        </div>
      </div>
    </div>
  );
}
