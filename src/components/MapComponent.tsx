// src/components/MapComponent.tsx
import React, { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Fix iconos Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export type BuildingState = "HABILITADO" | "REPARACIÓN";

export type FootwayTransit = "pedestrian" | "vehicular" | "both";
export type EntranceType = "pedestrian" | "vehicular" | "both";
export type ParkingType = "car" | "motorcycle" | "mixed";
export type LandmarkType = "plazoleta" | "bar" | "corredor" | "otro";

export type MapMode = "idle" | "addBuilding" | "footwayAB" | "entrance" | "parking" | "landmark";

type Building = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  total_floors: number;
  building_code: string | null;
  state: BuildingState;
};

type Footway = {
  id: string;
  name: string | null;
  state: "ABIERTO" | "CERRADO";
  access_type: FootwayTransit;
  geom: { type: "LineString"; coordinates: [number, number][] };
};

type Entrance = {
  id: string;
  name: string | null;
  type: EntranceType;
  is_active?: boolean | null;
  location: { type: "Point"; coordinates: [number, number] };
};

type Parking = {
  id: string;
  name: string | null;
  type: ParkingType;
  is_active?: boolean | null;
  capacity: number | null;
  location: { type: "Point"; coordinates: [number, number] };
};

type Landmark = {
  id: string;
  name: string | null;
  type: LandmarkType;
  is_active?: boolean | null;
  location: { type: "Point"; coordinates: [number, number] };
};

export interface MapComponentProps {
  isAdmin?: boolean;
  externalMode?: MapMode;
  onModeReset?: () => void;

  footwayTransit?: FootwayTransit;
  entranceType?: EntranceType;
  parkingType?: ParkingType;
  landmarkType?: LandmarkType;

  /** Para “Agregar edificio”: se llama solo en modo addBuilding */
  onLocationSelect?: (coords: { latitude: number; longitude: number }) => void;

  /** Editar al hacer clic */
  onBuildingEdit?: (id: string) => void;
  onFootwayEdit?: (id: string) => void;
  onEntranceEdit?: (id: string) => void;
  onParkingEdit?: (id: string) => void;
  onLandmarkEdit?: (id: string) => void;

  /** Si hay un modal abierto (para desactivar la interacción del mapa) */
  modalOpen?: boolean;
}

const UNEMI_CENTER: [number, number] = [-2.14898719, -79.60420553];

// refs de modo/tipos
const SNAP_PX = 10;

const MapComponent: React.FC<MapComponentProps> = ({
  isAdmin = false,
  externalMode = "idle",
  onModeReset,
  footwayTransit = "pedestrian",
  entranceType = "pedestrian",
  parkingType = "car",
  landmarkType = "plazoleta",
  onLocationSelect,
  onBuildingEdit,
  onFootwayEdit,
  onEntranceEdit,
  onParkingEdit,
  onLandmarkEdit,
  modalOpen = false,
}) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [footways, setFootways] = useState<Footway[]>([]);
  const [entrances, setEntrances] = useState<Entrance[]>([]);
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  const modeRef = useRef<MapMode>("idle");
  const [mode, setMode] = useState<MapMode>("idle");

  const footwayTransitRef = useRef<FootwayTransit>("pedestrian");
  const entranceTypeRef = useRef<EntranceType>("pedestrian");
  const parkingTypeRef = useRef<ParkingType>("car");
  const landmarkTypeRef = useRef<LandmarkType>("plazoleta");

  // A/B quick for footway
  const pointARef = useRef<L.Marker | null>(null);
  const pointBRef = useRef<L.Marker | null>(null);
  const quickARef = useRef<L.LatLng | null>(null);
  const quickBRef = useRef<L.LatLng | null>(null);

  // pending mini form
  type PendingForm =
    | { kind: "entrance" | "parking" | "landmark"; latlng: L.LatLng; name: string; buildingId: string | null }
    | null;
  const [pending, setPending] = useState<PendingForm>(null);

  // markers caches
  const buildingMarkers = useRef<L.Marker[]>([]);
  const entrancesMap = useRef<Map<string, L.Marker>>(new Map());
  const parkingsMap = useRef<Map<string, L.Marker>>(new Map());
  const landmarksMap = useRef<Map<string, L.Marker>>(new Map());

  const verticesLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.FeatureGroup | null>(null);

  // ====== data loads ======
  const loadBuildings = async () => {
    const { data, error } = await supabase
      .from("buildings")
      .select("id,name,latitude,longitude,total_floors,building_code,state")
      .order("name", { ascending: true });
    if (!error) setBuildings((data || []) as Building[]);
  };
  const loadFootways = async () => {
    const { data, error } = await supabase
      .from("footways")
      .select("id,name,state,access_type,geom");
    if (!error) setFootways((data || []) as Footway[]);
  };
  const loadEntrances = async () => {
    const { data, error } = await supabase
      .from("entrances")
      .select("id,name,type,is_active,location");
    if (!error) setEntrances((data || []) as Entrance[]);
  };
  const loadParkings = async () => {
    const { data, error } = await supabase
      .from("parkings")
      .select("id,name,type,is_active,capacity,location");
    if (!error) setParkings((data || []) as Parking[]);
  };
  const loadLandmarks = async () => {
    const { data, error } = await supabase
      .from("landmarks")
      .select("id,name,type,is_active,location");
    if (!error) setLandmarks((data || []) as Landmark[]);
  };

  // ====== map init ======
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView(UNEMI_CENTER, 18);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 20,
    }).addTo(map);

    linesLayerRef.current = L.featureGroup().addTo(map);

    // inicial render vacio: actualizaciones posteriores manejarán render
    map.on("click", handleMapClick);

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        cancelAB();
        setPending(null);
        setMode("idle");
        modeRef.current = "idle";
        onModeReset?.();
        toast("Modo cancelado");
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      if (!mapRef.current) return;
      mapRef.current.off("click", handleMapClick);
      buildingMarkers.current.forEach((m) => mapRef.current?.removeLayer(m));
      if (linesLayerRef.current) mapRef.current.removeLayer(linesLayerRef.current);
      if (verticesLayerRef.current) mapRef.current.removeLayer(verticesLayerRef.current);
      for (const mk of entrancesMap.current.values()) mapRef.current.removeLayer(mk);
      for (const mk of parkingsMap.current.values()) mapRef.current.removeLayer(mk);
      for (const mk of landmarksMap.current.values()) mapRef.current.removeLayer(mk);
      entrancesMap.current.clear();
      parkingsMap.current.clear();
      landmarksMap.current.clear();
      mapRef.current.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initial loads
  useEffect(() => {
    loadBuildings();
    loadFootways();
    loadEntrances();
    loadParkings();
    loadLandmarks();
  }, []);

  // external mode/props
  useEffect(() => {
    setMode(externalMode);
    modeRef.current = externalMode;
    footwayTransitRef.current = footwayTransit;
    entranceTypeRef.current = entranceType;
    parkingTypeRef.current = parkingType;
    landmarkTypeRef.current = landmarkType;

    if (externalMode === "footwayAB") {
      toast(`Dibujar calle ${labelTransit(footwayTransit)} (A→B): clic vértices o mapa.`);
    }
  }, [externalMode, footwayTransit, entranceType, parkingType, landmarkType]);

  // ===== re-render cuando cambian datasets =====
  useEffect(() => {
    renderBuildings();
    // pan/zoom not changed
  }, [buildings]);

  useEffect(() => {
    renderFootways();
  }, [footways, isAdmin]);

  useEffect(() => {
    renderEntrances();
  }, [entrances]);

  useEffect(() => {
    renderParkings();
  }, [parkings]);

  useEffect(() => {
    renderLandmarks();
  }, [landmarks]);

  // ===== cuando modal está abierto: desactivar interacciones del mapa =====
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (modalOpen) {
      try {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
      } catch {}
    } else {
      try {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
      } catch {}
    }
    // no cleanup: effect toggles on changes
  }, [modalOpen]);

  // ===== render helpers =====
  const labelTransit = (t: FootwayTransit) =>
    t === "pedestrian" ? "peatonal" : t === "vehicular" ? "vehicular" : "mixta";

  const renderBuildings = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    // limpiar previos
    buildingMarkers.current.forEach((m) => { try { map.removeLayer(m); } catch {} });
    buildingMarkers.current = [];

    buildings.forEach((b) => {
      if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return;
      const color = b.state === "REPARACIÓN" ? "#f59e0b" : "var(--primary)";
      const icon = L.divIcon({
        className: "custom-building-marker",
        html: `<div style="background:${color}" class="text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg border-2 border-background">${b.total_floors}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([b.latitude, b.longitude], { icon, title: b.name || "Edificio" })
        .addTo(map);

      marker.on("click", (ev) => {
        ev.originalEvent.stopPropagation();
        onBuildingEdit?.(b.id);
      });

      buildingMarkers.current.push(marker);
    });
  };

  const footwayStroke = (fw: Footway): L.PolylineOptions => {
    const base =
      fw.access_type === "pedestrian" ? "#10b981" :
      fw.access_type === "vehicular"  ? "#0ea5e9" :
                                        "#f59e0b";
    const color = fw.state === "CERRADO" ? "#ef4444" : base;
    const dash = fw.state === "CERRADO" ? "6 6" : undefined;
    return { color, weight: 4, opacity: isAdmin ? 0.95 : 0.8, dashArray: dash as any };
  };

  const renderFootways = () => {
    if (!mapRef.current || !linesLayerRef.current) return;
    linesLayerRef.current.clearLayers();

    footways.forEach((fw) => {
      const coords = fw.geom?.coordinates || [];
      if (!coords.length) return;
      const latlngs = coords.map(([lng, lat]) => [lat, lng]) as L.LatLngExpression[];
      const poly = L.polyline(latlngs, footwayStroke(fw)).addTo(linesLayerRef.current!);
      poly.on("click", (ev) => {
        (ev as any).originalEvent?.stopPropagation?.();
        onFootwayEdit?.(fw.id);
      });
    });

    renderVerticesLayer();
  };

  const renderVerticesLayer = () => {
    if (!mapRef.current) return;
    if (verticesLayerRef.current) {
      verticesLayerRef.current.clearLayers();
      try { mapRef.current.removeLayer(verticesLayerRef.current); } catch {}
    }
    verticesLayerRef.current = L.layerGroup().addTo(mapRef.current);

    let idx = 1;
    for (const fw of footways) {
      const coords = fw.geom?.coordinates || [];
      coords.forEach(([lng, lat]) => {
        const icon = L.divIcon({
          className: "vertex-pin",
          html: `<div style="background:#f59e0b;color:#111;font-weight:700" class="rounded-full w-5 h-5 text-[11px] flex items-center justify-center shadow">${idx}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const mk = L.marker([lat, lng], { icon, interactive: true }).addTo(verticesLayerRef.current!);
        mk.on("click", (ev) => {
          (ev as any).originalEvent?.stopPropagation?.();
          if (modeRef.current !== "footwayAB") return;
          pickVertexAsAB(L.latLng(lat, lng));
        });
        idx++;
      });
    }
  };

  const renderEntrances = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    for (const mk of entrancesMap.current.values()) map.removeLayer(mk);
    entrancesMap.current.clear();

    entrances.forEach((e) => {
      const [lng, lat] = e.location.coordinates;
      const color = e.type === "vehicular" ? "#ef4444" : e.type === "both" ? "#f59e0b" : "#10b981";
      const icon = L.divIcon({
        className: "entrance-pin",
        html: `<div style="background:${color};color:white" class="rounded-full w-5 h-5 shadow border-2 border-white"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const mk = L.marker([lat, lng], { icon, title: e.name || `Entrada ${e.type}` })
        .addTo(map);

      mk.on("click", (ev) => {
        (ev as any).originalEvent?.stopPropagation();
        onEntranceEdit?.(e.id);
      });

      entrancesMap.current.set(e.id, mk);
    });
  };

  const renderParkings = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    for (const mk of parkingsMap.current.values()) map.removeLayer(mk);
    parkingsMap.current.clear();

    parkings.forEach((p) => {
      const [lng, lat] = p.location.coordinates;
      const icon = L.divIcon({
        className: "parking-pin",
        html: `<div class="${p.is_active === false ? "opacity-40" : ""} bg-blue-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5 shadow">P</div>`,
        iconSize: [18, 14],
        iconAnchor: [9, 7],
      });
      const mk = L.marker([lat, lng], { icon, title: p.name || "Parqueadero" })
        .addTo(map);
      mk.on("click", (ev) => {
        (ev as any).originalEvent?.stopPropagation();
        onParkingEdit?.(p.id);
      });
      parkingsMap.current.set(p.id, mk);
    });
  };

  const renderLandmarks = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    for (const mk of landmarksMap.current.values()) map.removeLayer(mk);
    landmarksMap.current.clear();

    landmarks.forEach((l) => {
      const [lng, lat] = l.location.coordinates;
      const label =
        l.type === "plazoleta" ? "Plz" :
        l.type === "bar" ? "Bar" :
        l.type === "corredor" ? "Cor" : "Ref";
      const icon = L.divIcon({
        className: "landmark-pin",
        html: `<div class="${l.is_active === false ? "opacity-40" : ""} bg-purple-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5 shadow">${label}</div>`,
        iconSize: [18, 14],
        iconAnchor: [9, 7],
      });
      const mk = L.marker([lat, lng], { icon, title: l.name || `Referencia: ${l.type}` })
        .addTo(map);
      mk.on("click", (ev) => {
        (ev as any).originalEvent?.stopPropagation();
        onLandmarkEdit?.(l.id);
      });
      landmarksMap.current.set(l.id, mk);
    });
  };

  // ===== utilities =====
  const getAllVertices = (): L.LatLng[] => {
    const arr: L.LatLng[] = [];
    for (const fw of footways) {
      for (const [lng, lat] of fw.geom?.coordinates || []) {
        if (isFinite(lat) && isFinite(lng)) arr.push(L.latLng(lat, lng));
      }
    }
    return arr;
  };

  const snapLatLngToVertex = (ll: L.LatLng): L.LatLng => {
    if (!mapRef.current) return ll;
    const map = mapRef.current;
    const clickPt = map.latLngToLayerPoint(ll);
    let best: { v: L.LatLng; dpx: number } | null = null;
    for (const v of getAllVertices()) {
      const pt = map.latLngToLayerPoint(v);
      const dpx = Math.hypot(pt.x - clickPt.x, pt.y - clickPt.y);
      if (dpx <= SNAP_PX && (!best || dpx < best.dpx)) best = { v, dpx };
    }
    return best ? best.v : ll;
  };

  const cancelAB = () => {
    if (!mapRef.current) return;
    if (pointARef.current) mapRef.current.removeLayer(pointARef.current);
    if (pointBRef.current) mapRef.current.removeLayer(pointBRef.current);
    pointARef.current = null;
    pointBRef.current = null;
    quickARef.current = null;
    quickBRef.current = null;
  };

  // pick vertex as A/B
  const pickVertexAsAB = (ll: L.LatLng) => {
    const m = modeRef.current;
    if (m !== "footwayAB") return;
    if (!quickARef.current) {
      quickARef.current = ll;
      const icon = L.divIcon({
        className: "p2p-pin",
        html: `<div class="bg-orange-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">A</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      pointARef.current = L.marker(ll, { icon }).addTo(mapRef.current!);
      toast("Punto A fijado. Haz clic para el punto B o toca un vértice.");
      return;
    }
    if (!quickBRef.current) {
      quickBRef.current = ll;
      const icon = L.divIcon({
        className: "p2p-pin",
        html: `<div class="bg-orange-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">B</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      pointBRef.current = L.marker(ll, { icon }).addTo(mapRef.current!);

      const A = quickARef.current!;
      const B = quickBRef.current!;
      const geojson = {
        type: "LineString" as const,
        coordinates: [[A.lng, A.lat], [B.lng, B.lat]] as [number, number][],
      };

      (async () => {
        const { error } = await supabase.from("footways").insert({
          name: null,
          state: "ABIERTO",
          access_type: footwayTransitRef.current,
          geom: geojson
        });
        if (error) { toast.error("No se pudo guardar la calle"); }
        else { toast.success("Calle creada"); await loadFootways(); }
        cancelAB();
        onModeReset?.();
      })();
    }
  };

  // ===== clicks =====
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    const ll = snapLatLngToVertex(e.latlng);
    const m = modeRef.current;

    // Agregar edificio solo si el modo corresponde
    if (m === "addBuilding") {
      onLocationSelect?.({ latitude: ll.lat, longitude: ll.lng });
      onModeReset?.();
      return;
    }

    // Footway A→B
    if (m === "footwayAB") {
      if (!quickARef.current) {
        quickARef.current = ll;
        const icon = L.divIcon({
          className: "p2p-pin",
          html: `<div class="bg-orange-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">A</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        pointARef.current = L.marker(ll, { icon }).addTo(mapRef.current!);
        toast("Punto A fijado. Haz clic para el punto B o toca un vértice.");
        return;
      }
      if (!quickBRef.current) {
        quickBRef.current = ll;
        const icon = L.divIcon({
          className: "p2p-pin",
          html: `<div class="bg-orange-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">B</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        pointBRef.current = L.marker(ll, { icon }).addTo(mapRef.current!);

        const A = quickARef.current!;
        const B = quickBRef.current!;
        const geojson = {
          type: "LineString" as const,
          coordinates: [[A.lng, A.lat], [B.lng, B.lat]] as [number, number][],
        };

        const { error } = await supabase.from("footways").insert({
          name: null,
          state: "ABIERTO",
          access_type: footwayTransitRef.current,
          geom: geojson
        });
        if (error) { toast.error("No se pudo guardar la calle"); }
        else { toast.success("Calle creada"); await loadFootways(); }
        cancelAB();
        onModeReset?.();
      }
      return;
    }

    // Entrada / Parqueadero / Referencia
    if (m === "entrance" || m === "parking" || m === "landmark") {
      setPending({ kind: m, latlng: ll, name: "", buildingId: nearestBuildingId(ll) });
      return;
    }

    // Si el modo es idle y el usuario hace click en mapa (fuera de objetos),
    // no hacemos nada. Edición de objetos ocurre en los handlers de los markers/polylines.
  };

  const nearestBuildingId = (ll: L.LatLng): string | null => {
    if (!buildings.length) return null;
    const sorted = [...buildings]
      .map((b) => ({ b, d: ll.distanceTo([b.latitude, b.longitude]) }))
      .sort((a, b) => a.d - b.d);
    return sorted[0]?.b.id ?? null;
  };

  // ===== pending save =====
  const sortedBuildingsFor = (ll: L.LatLng) =>
    [...buildings]
      .map((b) => ({ b, d: ll.distanceTo([b.latitude, b.longitude]) }))
      .sort((a, b) => a.d - b.d)
      .map(({ b }) => b);

  const submitPending = async () => {
    if (!pending) return;
    const ll = pending.latlng;
    const coords: [number, number] = [ll.lng, ll.lat];

    if (pending.kind === "entrance") {
      const { error } = await supabase.from("entrances").insert({
        name: pending.name || null,
        building_id: pending.buildingId,
        type: entranceTypeRef.current,
        is_active: true,
        location: { type: "Point", coordinates: coords },
      });
      if (error) return toast.error("No se pudo guardar la entrada");
      toast.success("Entrada guardada");
      await loadEntrances();
    }

    if (pending.kind === "parking") {
      const { error } = await supabase.from("parkings").insert({
        name: pending.name || null,
        building_id: pending.buildingId,
        type: parkingTypeRef.current,
        capacity: null,
        is_active: true,
        location: { type: "Point", coordinates: coords },
      });
      if (error) return toast.error("No se pudo guardar el parqueadero");
      toast.success("Parqueadero guardado");
      await loadParkings();
    }

    if (pending.kind === "landmark") {
      const { error } = await supabase.from("landmarks").insert({
        name: pending.name || null,
        type: landmarkTypeRef.current,
        is_active: true,
        location: { type: "Point", coordinates: coords },
      });
      if (error) return toast.error("No se pudo guardar la referencia");
      toast.success("Referencia guardada");
      await loadLandmarks();
    }

    setPending(null);
    onModeReset?.();
  };

  // ====== render ======
  return (
    <div className="relative w-full h-full">
      <div ref={mapEl} className="absolute inset-0 rounded-lg shadow-lg z-0" />
      {/* solo un degradado estético, sin pointer events */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/5 rounded-lg z-[1]" />

      {mode !== "idle" && !pending && (
        <div className="absolute top-3 right-3 z-[1200] pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-amber-500 text-amber-950 text-sm font-semibold shadow">
            {mode === "footwayAB" && `Dibujar calle ${labelTransit(footwayTransitRef.current)} (A→B) • Click vértices o mapa`}
            {mode === "entrance" && `Nueva entrada (${entranceTypeRef.current}) • Click mapa`}
            {mode === "parking" && `Nuevo parqueadero (${parkingTypeRef.current}) • Click mapa`}
            {mode === "landmark" && "Nueva referencia • Click mapa"}
            {mode === "addBuilding" && "Agregar edificio • Click mapa"}
          </div>
        </div>
      )}

      {pending && (
        <div className="absolute top-4 left-4 z-[1300] w-[min(92vw,420px)] pointer-events-auto">
          <div className="bg-card/95 backdrop-blur rounded-xl border shadow-xl p-3 space-y-3">
            <div className="text-sm font-semibold">
              {pending.kind === "entrance" && "Nueva entrada"}
              {pending.kind === "parking" && "Nuevo parqueadero"}
              {pending.kind === "landmark" && "Nuevo punto de referencia"}
            </div>

            <div className="grid gap-2 text-sm">
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Nombre (opcional)</span>
                <input
                  className="px-2 py-1.5 rounded border bg-background"
                  value={pending.name}
                  onChange={(e) => setPending({ ...pending, name: e.target.value })}
                  placeholder="Ej: Puerta principal"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Vincular a edificio</span>
                <select
                  className="px-2 py-1.5 rounded border bg-background"
                  value={pending.buildingId ?? ""}
                  onChange={(e) => setPending({ ...pending, buildingId: e.target.value || null })}
                >
                  <option value="">— Sin enlace —</option>
                  {sortedBuildingsFor(pending.latlng).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded border" onClick={() => { setPending(null); onModeReset?.(); }}>
                Cancelar
              </button>
              <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground" onClick={submitPending}>
                Guardar
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Lat: {pending.latlng.lat.toFixed(6)} · Lon: {pending.latlng.lng.toFixed(6)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
