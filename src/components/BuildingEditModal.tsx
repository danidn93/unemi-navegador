import { useEffect, useMemo, useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ────────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────────
type BuildingState = "HABILITADO" | "REPARACIÓN";

interface Props {
  buildingId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Building = {
  id: string;
  name: string;
  description: string | null;
  total_floors: number;
  latitude: number;
  longitude: number;
  building_code: string | null;
  state: BuildingState;
  image_url: string | null;
};

// Bucket configurable (por .env) o por defecto "building_maps"
const STORAGE_BUCKET =
  (import.meta as any).env?.VITE_STORAGE_BUCKET?.toString() || "building_maps";

// ────────────────────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────────────────────
export default function BuildingEditModal({ buildingId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [b, setB] = useState<Building | null>(null);
  const [name, setName] = useState("");
  const [buildingCode, setBuildingCode] = useState("");
  const [description, setDescription] = useState("");
  const [totalFloors, setTotalFloors] = useState<number>(1);
  const [state, setState] = useState<BuildingState>("HABILITADO");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Archivo & preview local
  const [file, setFile] = useState<File | null>(null);
  const filePreviewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  // Carga del edificio
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("buildings")
          .select(
            "id,name,description,total_floors,latitude,longitude,building_code,state,image_url"
          )
          .eq("id", buildingId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          toast.error("No se encontró el edificio");
          setLoading(false);
          return;
        }

        const bb = data as Building;
        setB(bb);
        setName(bb.name);
        setBuildingCode(bb.building_code || "");
        setDescription(bb.description || "");
        setTotalFloors(bb.total_floors || 1);
        setState((bb.state as BuildingState) || "HABILITADO");
        setImageUrl(bb.image_url || null);
      } catch (err) {
        console.error(err);
        toast.error("No se pudo cargar el edificio");
      } finally {
        setLoading(false);
      }
    })();
  }, [buildingId]);

  // Subida al bucket correcto
  const uploadFileIfAny = async (id: string): Promise<string | null> => {
    if (!file) return null;

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || `image/${ext}`,
      });

    if (error) {
      console.error(error);
      // Mensaje típico cuando el bucket no existe: "The resource was not found"
      if ((error as any)?.message?.toLowerCase?.().includes("not found")) {
        toast.error(
          `No se encontró el bucket "${STORAGE_BUCKET}". Verifica el nombre o el proyecto.`
        );
      } else {
        toast.error("No se pudo subir la imagen");
      }
      return null;
    }

    // URL pública (si el bucket es público). Si tu bucket es privado, cambia a createSignedUrl.
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return pub?.publicUrl || null;
  };

  const handleSave = async () => {
    if (!b) return;
    try {
      setSaving(true);

      let newImageUrl = imageUrl;
      if (file) {
        const u = await uploadFileIfAny(b.id);
        if (u) newImageUrl = u;
      }

      const { error } = await supabase
        .from("buildings")
        .update({
          name: name.trim(),
          building_code: buildingCode.trim() || null,
          description: description.trim() || null,
          total_floors: Number.isFinite(totalFloors) ? totalFloors : 1,
          state,
          image_url: newImageUrl,
        })
        .eq("id", b.id);

      if (error) throw error;

      toast.success("Edificio actualizado");
      onSaved?.();
      onClose?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg p-4 md:p-6"
        role="dialog"
        aria-labelledby="edit-building-title"
        aria-modal="true"
      >
        Cargando…
      </div>
    );
  }

  return (
    <div
      className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg p-4 md:p-6"
      role="dialog"
      aria-labelledby="edit-building-title"
      aria-modal="true"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 id="edit-building-title" className="text-lg font-semibold">
          Editar Edificio
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="b-name">Nombre</Label>
          <Input
            id="b-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Edificio Aulas Norte"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="b-code">Código (opcional)</Label>
          <Input
            id="b-code"
            value={buildingCode}
            onChange={(e) => setBuildingCode(e.target.value)}
            placeholder="BLQ-AN"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="b-desc">Descripción (opcional)</Label>
          <Textarea
            id="b-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción breve del edificio…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="b-floors">Pisos</Label>
            <Input
              id="b-floors"
              type="number"
              min={1}
              value={totalFloors}
              onChange={(e) =>
                setTotalFloors(parseInt(e.target.value || "1", 10))
              }
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

        <div className="grid gap-1.5">
          <Label>Foto del edificio</Label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded cursor-pointer">
              <ImageIcon className="h-4 w-4" />
              <span>Seleccionar archivo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {file ? (
              <span className="text-sm">{file.name}</span>
            ) : imageUrl ? (
              <a
                className="text-sm underline"
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
              >
                ver actual
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Sin imagen</span>
            )}
          </div>

          {/* Preview contenida dentro del modal */}
          {(filePreviewUrl || imageUrl) && (
            <div className="mt-2">
              <img
                src={filePreviewUrl || imageUrl || ""}
                alt="Previsualización del edificio"
                className="w-full max-h-40 object-contain rounded border"
              />
            </div>
          )}

        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
