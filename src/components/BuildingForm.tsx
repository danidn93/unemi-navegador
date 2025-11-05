// src/components/BuildingForm.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image as ImageIcon, Upload } from "lucide-react";

export type LatLng = { latitude: number; longitude: number };

export interface BuildingFormProps {
  onClose: () => void;
  onBuildingAdded: () => void;
  initialCoords?: LatLng | null;
}

type BuildingState = "HABILITADO" | "REPARACIÓN";

const PUBLIC_BUCKET = "public";

export default function BuildingForm({
  onClose,
  onBuildingAdded,
  initialCoords,
}: BuildingFormProps) {
  const [name, setName] = useState("");
  const [buildingCode, setBuildingCode] = useState("");
  const [description, setDescription] = useState("");
  const [totalFloors, setTotalFloors] = useState<number>(1);
  const [lat, setLat] = useState<number>(initialCoords?.latitude ?? 0);
  const [lng, setLng] = useState<number>(initialCoords?.longitude ?? 0);
  const [state, setState] = useState<BuildingState>("HABILITADO");
  const [imageUrl, setImageUrl] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialCoords) {
      setLat(initialCoords.latitude);
      setLng(initialCoords.longitude);
    }
  }, [initialCoords]);

  const handleUploadImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `buildings/tmp-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(PUBLIC_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;
      setImageUrl(url);
      toast.success("Imagen subida (se guardará al crear el edificio)");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo subir la imagen");
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Ingresa el nombre del edificio");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return toast.error("Faltan coordenadas válidas");
    if (!Number.isFinite(totalFloors) || totalFloors < 1) return toast.error("El número de pisos debe ser al menos 1");

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        building_code: buildingCode.trim() || null,
        description: description.trim() || null,
        total_floors: totalFloors,
        latitude: lat,
        longitude: lng,
        state,
        image_url: imageUrl || null,
      };

      const { error } = await supabase.from("buildings").insert(payload);
      if (error) throw error;

      toast.success("Edificio creado");
      onBuildingAdded();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al guardar el edificio");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!saving) void handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!saving) onClose();
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg p-4 md:p-6" onKeyDown={onKeyDown}>
      <h2 className="text-lg font-semibold mb-4">Agregar Edificio</h2>

      <div className="grid gap-4">
        {/* Imagen */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Imagen del edificio</Label>
          <div className="flex items-center gap-3">
            <div className="w-32 h-24 rounded-lg border bg-muted/30 grid place-items-center overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt="building" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-muted-foreground px-2 text-center">Sin imagen</div>
              )}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer">
              <Upload className="h-4 w-4" />
              <span>Subir</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={uploading} />
            </label>
            {imageUrl && (
              <Button variant="secondary" onClick={() => setImageUrl("")} disabled={uploading}>
                Quitar
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Se guarda en bucket público <code>public/buildings/…</code>. La URL se asociará al crear el edificio.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="b-name">Nombre</Label>
          <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Bloque A" autoFocus />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="b-code">Código (opcional)</Label>
          <Input id="b-code" value={buildingCode} onChange={(e) => setBuildingCode(e.target.value)} placeholder="Ej: A-01" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="b-desc">Descripción (opcional)</Label>
          <Textarea id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Información breve" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="b-floors">Pisos</Label>
            <Input
              id="b-floors"
              type="number"
              min={1}
              value={Number.isFinite(totalFloors) ? totalFloors : 1}
              onChange={(e) => {
                const v = parseInt(e.target.value || "1", 10);
                setTotalFloors(Number.isNaN(v) ? 1 : v);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="b-state">Estado</Label>
            <select
              id="b-state"
              className="h-9 px-3 rounded-md border bg-background"
              value={state}
              onChange={(e) => setState(e.target.value as BuildingState)}
            >
              <option value="HABILITADO">HABILITADO</option>
              <option value="REPARACIÓN">REPARACIÓN</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="b-lat">Latitud</Label>
            <Input
              id="b-lat"
              type="number"
              step="0.0000001"
              value={Number.isFinite(lat) ? lat : 0}
              onChange={(e) => setLat(parseFloat(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-lng">Longitud</Label>
            <Input
              id="b-lng"
              type="number"
              step="0.0000001"
              value={Number.isFinite(lng) ? lng : 0}
              onChange={(e) => setLng(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
