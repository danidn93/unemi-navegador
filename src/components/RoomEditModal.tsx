// src/components/RoomEditModal.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

type ReasonSeverity = "info" | "warn" | "critical";
type AppRole = "public" | "student" | "admin";
export type ReasonRequest = {
  action: string;
  entityTable: string;
  entityId: string;
  defaultSeverity?: ReasonSeverity;
};

interface Props {
  roomId: string;
  onClose: () => void;
  onSaved: () => void;
  /**
   * Callback opcional para solicitar motivo al usuario cuando hagas cambios sensibles
   * (tu Index.tsx ya lo provee). Si no lo envías, no se pedirá motivo.
   */
  requestReason?: (req: ReasonRequest) => Promise<{ reason: string; severity: ReasonSeverity }>;
}

type Building = { id: string; name: string; total_floors: number | null };
type Floor = { id: string; building_id: string; floor_number: number; floor_name: string | null };
type RoomType = { id: string; name: string };

type RoomRow = {
  id: string;
  name: string;
  room_number: string | null;
  description: string | null;
  capacity: number | null;
  equipment: string[] | null;
  keywords: string[] | null;
  directions: string | null;
  actividades: string[] | null;
  image_url: string | null;
  floor_id: string;
  room_type_id: string | null;
  target: AppRole;
  floor: {
    id: string;
    floor_number: number;
    floor_name: string | null;
    building: { id: string; name: string };
  } | null;
  room_type: { id: string; name: string } | null;
};

const toCSV = (arr: string[] | null | undefined) => (arr && arr.length ? arr.join(", ") : "");
const fromCSV = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export default function RoomEditModal({ roomId, onClose, onSaved, requestReason }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [room, setRoom] = useState<RoomRow | null>(null);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  // form state
  const [name, setName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [directions, setDirections] = useState("");
  const [equipment, setEquipment] = useState("");
  const [keywords, setKeywords] = useState("");
  const [actividades, setActividades] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");

  const [buildingId, setBuildingId] = useState<string>("");
  const [floorId, setFloorId] = useState<string>("");
  const [roomTypeId, setRoomTypeId] = useState<string>("");
  const [target, setTarget] = useState<AppRole>("public");

  // Carga catálogos y habitación
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [bRes, tRes] = await Promise.all([
          supabase.from("buildings").select("id,name,total_floors").order("name", { ascending: true }),
          supabase.from("room_types").select("id,name").order("name", { ascending: true }),
        ]);
        if (bRes.error) throw bRes.error;
        if (tRes.error) throw tRes.error;
        setBuildings(bRes.data || []);
        setRoomTypes(tRes.data || []);

        const { data, error } = await supabase
          .from("rooms")
          .select(
            `
            id,name,room_number,description,capacity,equipment,keywords,directions,actividades,image_url,floor_id,room_type_id,target,
            floor:floor_id(
              id,floor_number,floor_name,
              building:buildings(id,name)
            ),
            room_type:room_type_id(id,name)
          `
          )
          .eq("id", roomId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Habitación no encontrada");

        const r = data as unknown as RoomRow;
        setRoom(r);

        setName(r.name || "");
        setRoomNumber(r.room_number || "");
        setCapacity(r.capacity ?? "");
        setDescription(r.description || "");
        setDirections(r.directions || "");
        setEquipment(toCSV(r.equipment));
        setKeywords(toCSV(r.keywords));
        setActividades(toCSV(r.actividades));
        setImageUrl(r.image_url || "");

        setRoomTypeId(r.room_type?.id || r.room_type_id || "");
        setFloorId(r.floor?.id || r.floor_id);
        setBuildingId(r.floor?.building.id || "");
        setTarget(r.target || "public");

        if (r.floor?.building.id) {
          const { data: fl } = await supabase
            .from("floors")
            .select("id,building_id,floor_number,floor_name")
            .eq("building_id", r.floor.building.id)
            .order("floor_number", { ascending: true });
          setFloors(fl || []);
        }
      } catch (err: any) {
        console.error("[RoomEditModal] load error:", err);
        toast.error(err.message || "No se pudo cargar la habitación");
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  // Cambiar edificio => recargar pisos
  useEffect(() => {
    (async () => {
      if (!buildingId) {
        setFloors([]);
        return;
      }
      const { data, error } = await supabase
        .from("floors")
        .select("id,building_id,floor_number,floor_name")
        .eq("building_id", buildingId)
        .order("floor_number", { ascending: true });
      if (!error) setFloors(data || []);
    })();
  }, [buildingId]);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === buildingId) || null,
    [buildings, buildingId]
  );

  const handleSave = async () => {
    if (!room) return;
    if (!name.trim()) return toast.error("Nombre requerido");
    if (!floorId) return toast.error("Selecciona un piso");
    if (!roomTypeId) return toast.error("Selecciona un tipo");

    try {
      setSaving(true);

      // Si te interesa pedir motivo para auditoría:
      if (requestReason) {
        await requestReason({
          action: "update",
          entityTable: "rooms",
          entityId: room.id,
          defaultSeverity: "info",
        });
      }

      const payload = {
        name: name.trim(),
        room_number: roomNumber || null,
        capacity: capacity === "" ? null : Number(capacity),
        description: description || null,
        directions: directions || null,
        equipment: equipment.trim() ? fromCSV(equipment) : null,
        keywords: keywords.trim() ? fromCSV(keywords) : null,
        actividades: actividades.trim() ? fromCSV(actividades) : null,
        image_url: imageUrl || null,
        floor_id: floorId,
        room_type_id: roomTypeId,
        target: target,
      };

      const { error } = await supabase.from("rooms").update(payload).eq("id", room.id);
      if (error) throw error;

      toast.success("Habitación actualizada");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[RoomEditModal] save error:", err);
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative bg-card text-card-foreground w-[min(92vw,900px)] rounded-2xl shadow-2xl border border-border max-h-[85vh] overflow-hidden">
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-card/95 backdrop-blur">
        <h2 className="text-lg font-semibold">Editar habitación</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Cerrar
          </Button>
        </div>
      </div>

      {/* contenido */}
      <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(85vh-56px-64px)]">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : !room ? (
          <div className="text-sm text-muted-foreground">No se encontró la información.</div>
        ) : (
          <>
            {/* Edificio y Piso */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="grid gap-1.5">
                <Label>Edificio</Label>
                <select
                  className="px-2 py-1.5 rounded border bg-background"
                  value={buildingId}
                  onChange={(e) => {
                    setBuildingId(e.target.value);
                    setFloorId("");
                  }}
                >
                  <option value="">— Selecciona —</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label>Piso</Label>
                <select
                  className="px-2 py-1.5 rounded border bg-background"
                  value={floorId}
                  onChange={(e) => setFloorId(e.target.value)}
                  disabled={!buildingId}
                >
                  <option value="">{buildingId ? "— Selecciona —" : "Elige un edificio primero"}</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.floor_name || `Piso ${f.floor_number}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <select
                  className="px-2 py-1.5 rounded border bg-background"
                  value={roomTypeId}
                  onChange={(e) => setRoomTypeId(e.target.value)}
                >
                  <option value="">— Selecciona —</option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Visibilidad (Target)</Label>
                <select
                  className="px-2 py-1.5 rounded border bg-background"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as AppRole)}
                >
                  <option value="public">Público (Todos)</option>
                  <option value="student">Estudiantes (Logueados)</option>
                  <option value="admin">Administrativos (Logueados)</option>
                </select>
              </div>
            </div>

            {/* Datos principales */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Número / Código</Label>
                <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Capacidad</Label>
                <Input
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Imagen (URL)</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>

            {/* Listas coma separadas */}
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="grid gap-1.5">
                <Label>Equipo (coma-separado)</Label>
                <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="proyector, pizarra, ..." />
              </div>
              <div className="grid gap-1.5">
                <Label>Keywords (coma-separado)</Label>
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="laboratorio, química" />
              </div>
              <div className="grid gap-1.5">
                <Label>Actividades (coma-separado)</Label>
                <Input
                  value={actividades}
                  onChange={(e) => setActividades(e.target.value)}
                  placeholder="Procesos institucionales, Acreditación"
                />
              </div>
            </div>

            {/* Textos largos */}
            <div className="grid gap-1.5 mt-4">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid gap-1.5 mt-4">
              <Label>Indicaciones de cómo llegar</Label>
              <Textarea value={directions} onChange={(e) => setDirections(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {/* footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 px-4 py-3 border-t bg-card/95 backdrop-blur">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
