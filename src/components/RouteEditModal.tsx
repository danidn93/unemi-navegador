// src/components/RouteEditModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Search } from "lucide-react";

type Route = { id: string; name: string; description: string | null };
type Step = {
  id: string;
  order_index: number;
  custom_instruction: string | null;
  room_id: string | null;
  landmark_id: string | null;
  footway_id: string | null;
  entrance_id: string | null;
  parking_id: string | null;
};

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

interface Props {
  routeId: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

export default function RouteEditModal({ routeId, onClose, onSaved, onDeleted }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [route, setRoute] = useState<Route | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // ---- room loading + selector para agregar ----
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [addingStep, setAddingStep] = useState(false);

  // Para editar instrucciones por paso (local)
  const [editInstructions, setEditInstructions] = useState<Record<string, string>>({});
  const [savingInstructionFor, setSavingInstructionFor] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await supabase.from("routes").select("id,name,description").eq("id", routeId).single();
      if (r.error) throw r.error;
      setRoute(r.data as Route);
      setName(r.data.name);
      setDescription(r.data.description || "");

      const s = await supabase
        .from("route_steps")
        .select("id,order_index,custom_instruction,room_id,landmark_id,footway_id,entrance_id,parking_id")
        .eq("route_id", routeId)
        .order("order_index", { ascending: true });
      if (s.error) throw s.error;
      const stepRows = (s.data || []) as Step[];
      setSteps(stepRows);

      // inicializa editInstructions con lo que haya
      const map: Record<string, string> = {};
      stepRows.forEach((st) => {
        map[st.id] = st.custom_instruction || "";
      });
      setEditInstructions(map);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar el recorrido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [routeId]);

  // carga habitaciones (para agregar)
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
      console.error("[RouteEditModal] loadRooms", err);
      toast.error("No se pudieron cargar las habitaciones");
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    // carga rooms una sola vez al montar el modal
    loadRooms();
  }, []);

  const filteredRooms = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) =>
      (r.name || "").toLowerCase().includes(q) ||
      (r.room_number || "").toLowerCase().includes(q) ||
      (r.floor?.building?.name || "").toLowerCase().includes(q)
    );
  }, [rooms, search]);

  // ---- guardar encabezado ----
  const saveHeader = async () => {
    try {
      setSaving(true);
      const { error } = await supabase.from("routes").update({
        name: name.trim(),
        description: description.trim() || null
      }).eq("id", routeId);
      if (error) throw error;
      toast.success("Recorrido actualizado");
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  // ---- eliminar paso (ya existente) ----
  const deleteStep = async (id: string) => {
    const { error } = await supabase.from("route_steps").delete().eq("id", id);
    if (error) return toast.error("No se pudo eliminar el paso");
    toast.success("Paso eliminado");
    await load();
    onSaved();
  };

  // ---- mover paso (usa RPC o fallback) ----
  const moveStep = async (id: string, dir: -1 | 1) => {
    const idx = steps.findIndex(s => s.id === id);
    if (idx < 0) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const a = steps[idx], b = steps[targetIdx];
    // swap order_index
    const { error } = await supabase.rpc("swap_route_steps", { step_a: a.id, step_b: b.id });
    if (error) {
      // fallback sin RPC
      const u1 = await supabase.from("route_steps").update({ order_index: b.order_index }).eq("id", a.id);
      const u2 = await supabase.from("route_steps").update({ order_index: a.order_index }).eq("id", b.id);
      if (u1.error || u2.error) return toast.error("No se pudo reordenar");
    }
    await load();
    onSaved();
  };

  // ---- eliminar recorrido ----
  const deleteRoute = async () => {
    if (!confirm("¿Eliminar este recorrido? Esta acción no se puede deshacer.")) return;
    // Elimina pasos primero por FK
    const d1 = await supabase.from("route_steps").delete().eq("route_id", routeId);
    if (d1.error) return toast.error("No se pudo eliminar los pasos");
    const d2 = await supabase.from("routes").delete().eq("id", routeId);
    if (d2.error) return toast.error("No se pudo eliminar el recorrido");
    toast.success("Recorrido eliminado");
    onDeleted?.();
    onClose();
  };

  // ---- agregar paso (solo por habitación como en RouteCreateModal) ----
  const addSelectedRoom = async (instruction?: string | null) => {
    if (!selectedRoomId) {
      toast.error("Selecciona una habitación para añadir.");
      return;
    }
    try {
      setAddingStep(true);
      const maxIndex = steps.length > 0 ? Math.max(...steps.map(s => s.order_index)) : 0;
      const { error } = await supabase.from("route_steps").insert([{
        route_id: routeId,
        room_id: selectedRoomId,
        order_index: maxIndex + 1,
        custom_instruction: instruction || null,
      }]);
      if (error) throw error;
      toast.success("Paso añadido");
      setSelectedRoomId("");
      setSearch("");
      await load();
      onSaved();
    } catch (err: any) {
      console.error("[RouteEditModal] addSelectedRoom", err);
      toast.error(err?.message || "No se pudo añadir el paso");
    } finally {
      setAddingStep(false);
    }
  };

  // ---- editar instrucción de paso existente ----
  const saveStepInstruction = async (stepId: string) => {
    const text = (editInstructions[stepId] ?? "").trim();
    try {
      setSavingInstructionFor(stepId);
      const { error } = await supabase.from("route_steps").update({ custom_instruction: text || null }).eq("id", stepId);
      if (error) throw error;
      toast.success("Instrucción guardada");
      await load();
      onSaved();
    } catch (err: any) {
      console.error("[RouteEditModal] saveStepInstruction", err);
      toast.error(err?.message || "No se pudo guardar la instrucción");
    } finally {
      setSavingInstructionFor(null);
    }
  };

  const getRoomLabel = (roomId: string | null) => {
    if (!roomId) return null;
    const r = rooms.find((x) => x.id === roomId);
    if (r) {
      return `${r.name}${r.room_number ? ` (${r.room_number})` : ""} — ${r.floor?.building?.name ?? ""}`;
    }
    return roomId;
  };

  return (
    <div className="w-[min(92vw,900px)] bg-card text-card-foreground rounded-2xl shadow-2xl border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Editar recorrido</h3>
        <button className="p-1 rounded hover:bg-accent" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>

      <div className="p-4 grid gap-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Descripción</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {/* --- sección para agregar pasos (similar a RouteCreateModal) --- */}
            <div className="rounded border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Añadir paso</div>
              </div>

              <div className="grid gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                  <Input
                    className="pl-8"
                    placeholder="Filtra por nombre, código o edificio…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

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
                  <Button onClick={() => addSelectedRoom(null)} disabled={!selectedRoomId || loadingRooms || addingStep}>
                    {addingStep ? "Añadiendo…" : "Añadir"}
                  </Button>
                </div>
                <div className="text-[12px] text-muted-foreground">Puedes añadir la habitación y luego editar la instrucción del paso si lo requieres.</div>
              </div>
            </div>

            <div className="rounded border">
              <div className="px-3 py-2 text-sm font-medium border-b">Pasos</div>
              {steps.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No hay pasos.</div>
              ) : (
                <ol className="p-3 space-y-2">
                  {steps.map((s, i) => (
                    <li key={s.id} className="rounded border p-2 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm">
                          <div className="font-medium">#{s.order_index} {getRoomLabel(s.room_id) ? `— ${getRoomLabel(s.room_id)}` : ""}</div>
                          {s.landmark_id && <div className="text-xs text-muted-foreground">landmark_id: {s.landmark_id}</div>}
                          {s.footway_id && <div className="text-xs text-muted-foreground">footway_id: {s.footway_id}</div>}
                          {s.entrance_id && <div className="text-xs text-muted-foreground">entrance_id: {s.entrance_id}</div>}
                          {s.parking_id && <div className="text-xs text-muted-foreground">parking_id: {s.parking_id}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="secondary" onClick={() => moveStep(s.id, -1)} disabled={i === 0}>↑</Button>
                          <Button size="sm" variant="secondary" onClick={() => moveStep(s.id, 1)} disabled={i === steps.length - 1}>↓</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteStep(s.id)}>Eliminar</Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Instrucción personalizada</Label>
                        <Textarea
                          value={editInstructions[s.id] ?? s.custom_instruction ?? ""}
                          onChange={(e) => setEditInstructions(prev => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="Instrucción opcional (por ejemplo: 'Subir por la escalera central, girar a la izquierda')"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              // reset al valor original
                              setEditInstructions(prev => ({ ...prev, [s.id]: s.custom_instruction ?? "" }));
                            }}
                            disabled={savingInstructionFor === s.id}
                          >
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveStepInstruction(s.id)}
                            disabled={savingInstructionFor === s.id}
                          >
                            {savingInstructionFor === s.id ? "Guardando…" : "Guardar instrucción"}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button onClick={saveHeader} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
              <Button variant="destructive" onClick={deleteRoute}>Eliminar recorrido</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
