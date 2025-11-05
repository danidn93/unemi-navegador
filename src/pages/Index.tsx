// src/pages/Index.tsx
import { useEffect, useState } from "react";
import {
  MapPin,
  Plus,
  ChevronDown,
  LogOut,
  ParkingSquare,
  MapPinned,
  DoorOpen,
  GitBranch,
  List as ListIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import MapComponent, {
  type MapMode,
  type FootwayTransit,
  type EntranceType,
  type ParkingType,
} from "@/components/MapComponent";
import SearchPanel from "@/components/SearchPanel";
import BuildingForm from "@/components/BuildingForm";
import RoomForm from "@/components/RoomForm";
import BuildingEditModal from "@/components/BuildingEditModal";
import RoomEditModal from "@/components/RoomEditModal";
import FootwayEditModal from "@/components/FootwayEditModal";
import EntranceEditModal from "@/components/EntranceEditModal";
import ParkingEditModal from "@/components/ParkingEditModal";
import LandmarkEditModal from "@/components/LandmarkEditModal";
import RouteCreateModal from "@/components/RouteCreateModal";
import RouteEditModal from "@/components/RouteEditModal";
import AdminInviteModal from "@/components/AdminInviteModal";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const P7463 = "#002E45";
const ORANGE = "#FF6900";
const NEUTRAL = "#222223";

// Tipado para el callback requestReason (para RoomEditModal)
type ReasonSeverity = "info" | "warn" | "critical";
type ReasonRequest = {
  action: string;
  entityTable: string;
  entityId: string;
  defaultSeverity?: ReasonSeverity;
};

export default function Index() {
  const [mapMode, setMapMode] = useState<MapMode>("idle");

  // Tipos para modos de creación
  const [footwayTransit, setFootwayTransit] = useState<FootwayTransit>("pedestrian");
  const [entranceType, setEntranceType] = useState<EntranceType>("pedestrian");
  const [parkingType, setParkingType] = useState<ParkingType>("car");

  const [openActions, setOpenActions] = useState(false);
  const [submenu, setSubmenu] = useState<"vias" | "puertas" | "parqueaderos" | null>(null);

  const [clock, setClock] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");

  const [showSidebar, setShowSidebar] = useState(true);

  // Crear
  const [addBuildingAt, setAddBuildingAt] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);

  // Editar
  const [editBuildingId, setEditBuildingId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<{ id: string } | null>(null);

  const [editFootwayId, setEditFootwayId] = useState<string | null>(null);
  const [editEntranceId, setEditEntranceId] = useState<string | null>(null);
  const [editParkingId, setEditParkingId] = useState<string | null>(null);
  const [editLandmarkId, setEditLandmarkId] = useState<string | null>(null);

  // Recorridos
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);

  const [showInviteAdmin, setShowInviteAdmin] = useState(false);

  const [refreshToken, setRefreshToken] = useState(0);

  // reloj
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setClock(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
          d.getSeconds()
        ).padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // usuario
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email || "";
      const { data } = await supabase
        .from("app_users")
        .select("nombre,direccion")
        .eq("usuario", email)
        .maybeSingle();
      setDisplayName(data?.nombre || email);
      setDireccion(data?.direccion || "—");
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // === Crear edificio ===
  const startAddBuilding = () => {
    setMapMode("addBuilding");
    setOpenActions(false);
    setSubmenu(null);
    toast("Haz clic en el mapa para ubicar el edificio.");
  };

  const onMapPickBuilding = (coords: { latitude: number; longitude: number }) => {
    if (mapMode !== "addBuilding") return;
    setAddBuildingAt(coords);
    setShowBuildingForm(true);
    setMapMode("idle");
  };

  // === Editar room desde SearchPanel ===
  const handleEditRoomFromSearch = (room: any) => {
    // guardamos mínimo el id que necesita RoomEditModal
    setEditRoom({ id: room.id });
  };

  // calcular si hay modal abierto para desactivar mapa
  const modalOpen = Boolean(
    showBuildingForm ||
      showRoomForm ||
      editBuildingId ||
      editRoom ||
      editFootwayId ||
      editEntranceId ||
      editParkingId ||
      editLandmarkId ||
      showRouteForm ||
      editRouteId ||
      showInviteAdmin
  );

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: "#0b1a22" }}>
      {/* ===== Header ===== */}
      <header className="absolute top-0 left-0 right-0 z-20 shadow-lg" style={{ backgroundColor: P7463, color: "white" }}>
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center ring-1" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold text-base leading-tight">UNEMI Campus · Admin</h1>
              <p className="text-[11px] opacity-80">Universidad Estatal de Milagro</p>
            </div>
          </div>

          <div className="hidden md:flex items-center text-sm font-medium tracking-widest" style={{ color: "rgba(255,255,255,0.9)" }}>
            {clock}
          </div>

          <div className="flex items-center gap-2">
            {/* Acciones */}
            <div className="relative">
              <Button
                onClick={() => {
                  setOpenActions((o) => !o);
                  setSubmenu(null);
                }}
                className="h-9 px-3"
                style={{ backgroundColor: ORANGE, color: NEUTRAL }}
              >
                Acciones
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>

              {openActions && (
                <div
                  className="absolute right-0 mt-2 w-72 rounded-lg shadow-xl border p-2 z-40"
                  style={{ backgroundColor: "#0f2230", borderColor: "rgba(255,255,255,0.12)", color: "white" }}
                  onMouseLeave={() => {
                    setOpenActions(false);
                    setSubmenu(null);
                  }}
                >
                  <div className="px-2 py-1 text-[11px] opacity-70">Agregar</div>

                  <button className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex items-center gap-2" onClick={startAddBuilding}>
                    <Plus className="h-4 w-4" /> Edificio (clic en mapa)
                  </button>

                  {/* Submenú de Vías */}
                  <div className="relative">
                    <button
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex justify-between"
                      onMouseEnter={() => setSubmenu("vias")}
                    >
                      <span className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" /> Calle
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>

                    {submenu === "vias" && (
                      <div
                        className="absolute left-full top-0 ml-1 w-56 rounded-lg border p-2 shadow-lg"
                        style={{ backgroundColor: "#0f2230", borderColor: "rgba(255,255,255,0.1)" }}
                      >
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setFootwayTransit("pedestrian");
                            setMapMode("footwayAB");
                            setOpenActions(false);
                          }}
                        >
                          Peatonal
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setFootwayTransit("vehicular");
                            setMapMode("footwayAB");
                            setOpenActions(false);
                          }}
                        >
                          Vehicular
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setFootwayTransit("both");
                            setMapMode("footwayAB");
                            setOpenActions(false);
                          }}
                        >
                          Mixta
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submenú de Puertas */}
                  <div className="relative">
                    <button
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex justify-between"
                      onMouseEnter={() => setSubmenu("puertas")}
                    >
                      <span className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4" /> Entrada
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>

                    {submenu === "puertas" && (
                      <div
                        className="absolute left-full top-0 ml-1 w-56 rounded-lg border p-2 shadow-lg"
                        style={{ backgroundColor: "#0f2230", borderColor: "rgba(255,255,255,0.1)" }}
                      >
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setEntranceType("pedestrian");
                            setMapMode("entrance");
                            setOpenActions(false);
                          }}
                        >
                          Peatonal
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setEntranceType("vehicular");
                            setMapMode("entrance");
                            setOpenActions(false);
                          }}
                        >
                          Vehicular
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setEntranceType("both");
                            setMapMode("entrance");
                            setOpenActions(false);
                          }}
                        >
                          Mixta
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submenú de Parqueaderos */}
                  <div className="relative">
                    <button
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex justify-between"
                      onMouseEnter={() => setSubmenu("parqueaderos")}
                    >
                      <span className="flex items-center gap-2">
                        <ParkingSquare className="h-4 w-4" /> Parqueadero
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>

                    {submenu === "parqueaderos" && (
                      <div
                        className="absolute left-full top-0 ml-1 w-56 rounded-lg border p-2 shadow-lg"
                        style={{ backgroundColor: "#0f2230", borderColor: "rgba(255,255,255,0.1)" }}
                      >
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setParkingType("car");
                            setMapMode("parking");
                            setOpenActions(false);
                          }}
                        >
                          Autos
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setParkingType("motorcycle");
                            setMapMode("parking");
                            setOpenActions(false);
                          }}
                        >
                          Motos
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                          onClick={() => {
                            setParkingType("mixed");
                            setMapMode("parking");
                            setOpenActions(false);
                          }}
                        >
                          Mixto
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Referencia */}
                  <button className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex items-center gap-2" onClick={() => { setMapMode("landmark"); setOpenActions(false); }}>
                    <MapPinned className="h-4 w-4" /> Punto de referencia
                  </button>

                  {/* Habitación */}
                  <button className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex items-center gap-2" onClick={() => { setShowRoomForm(true); setOpenActions(false); }}>
                    <Plus className="h-4 w-4" /> Habitación
                  </button>

                  {/* Recorrido - abre modal real */}
                  <button className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 flex items-center gap-2" onClick={() => { setShowRouteForm(true); setOpenActions(false); }}>
                    <ListIcon className="h-4 w-4" /> Recorrido
                  </button>
                </div>
              )}
            </div>

            {/* Usuario y logout */}
            <div className="hidden md:flex flex-col items-end leading-tight">
              <div className="text-sm font-semibold">{displayName || "Usuario"}</div>
              <div className="text-[11px] opacity-80">Dirección: {direccion || "—"}</div>
            </div>

            {/* Invitar admin */}
            {direccion === "Talento Humano" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInviteAdmin(true)}
                className="border-0"
                style={{ backgroundColor: "white", color: NEUTRAL }}
              >
                Invitar admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} className="border-0" style={{ backgroundColor: "white", color: NEUTRAL }}>
              <LogOut className="h-4 w-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Layout principal ===== */}
      <div className="flex h-full pt-16">
        {/* Sidebar con SearchPanel */}
        <aside className={`absolute md:relative z-10 transition-transform duration-300 ${showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"} w-full md:w-[380px]`}>
          <div className="h-full flex flex-col border-r" style={{ backgroundColor: "#0f2230", borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="flex-1 overflow-y-auto p-4">
              <SearchPanel
                onLocationSelect={() => {}}
                onEditRoom={handleEditRoomFromSearch}
                onEditRoute={(id) => setEditRouteId(id)}
                onDeleteRoute={() => setRefreshToken((x) => x + 1)}
                refreshToken={refreshToken}
              />
            </div>
          </div>
        </aside>

        {/* Mapa */}
        <main className="flex-1 relative overflow-hidden">
          <MapComponent
            isAdmin
            externalMode={mapMode}
            entranceType={entranceType}
            footwayTransit={footwayTransit}
            parkingType={parkingType}
            onModeReset={() => setMapMode("idle")}
            onLocationSelect={onMapPickBuilding} // para "Agregar edificio"
            onBuildingEdit={(buildingId) => setEditBuildingId(buildingId)} // clic marcador edificio
            onFootwayEdit={(id) => setEditFootwayId(id)} // clic vía
            onEntranceEdit={(id) => setEditEntranceId(id)} // clic entrada
            onParkingEdit={(id) => setEditParkingId(id)} // clic parqueadero
            onLandmarkEdit={(id) => setEditLandmarkId(id)} // clic referencia
            modalOpen={modalOpen}
          />
        </main>
      </div>

      {/* ===== Crear edificio ===== */}
      {showBuildingForm && addBuildingAt && (
        <div className="fixed inset-0 z-[2000] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setShowBuildingForm(false)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <BuildingForm onClose={() => setShowBuildingForm(false)} onBuildingAdded={() => setRefreshToken((x) => x + 1)} initialCoords={addBuildingAt} />
          </div>
        </div>
      )}

      {/* ===== Crear habitación ===== */}
      {showRoomForm && (
        <div className="fixed inset-0 z-[2000] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setShowRoomForm(false)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <RoomForm onClose={() => setShowRoomForm(false)} onRoomAdded={() => setRefreshToken((x) => x + 1)} />
          </div>
        </div>
      )}

      {/* ===== Editar edificio ===== */}
      {editBuildingId && (
        <div className="fixed inset-0 z-[2100] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditBuildingId(null)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <BuildingEditModal buildingId={editBuildingId} onClose={() => setEditBuildingId(null)} onSaved={() => setRefreshToken((x) => x + 1)} />
          </div>
        </div>
      )}

      {/* ===== Editar habitación ===== */}
      {editRoom && (
        <div className="fixed inset-0 z-[2100] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditRoom(null)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <RoomEditModal
              roomId={editRoom.id}
              onClose={() => setEditRoom(null)}
              onSaved={() => setRefreshToken((x) => x + 1)}
              requestReason={async (req: ReasonRequest) => {
                const reason = prompt(`Motivo para ${req.action} (${req.entityTable} ${req.entityId}):`);
                if (!reason || reason.trim().length < 3) throw new Error("Motivo requerido");
                return { reason, severity: (req.defaultSeverity ?? "info") as ReasonSeverity };
              }}
            />
          </div>
        </div>
      )}

      {/* ===== Editores extra ===== */}
      {editFootwayId && (
        <div className="fixed inset-0 z-[2100] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditFootwayId(null)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <FootwayEditModal footwayId={editFootwayId} onClose={() => setEditFootwayId(null)} onSaved={() => setRefreshToken((x) => x + 1)} />
          </div>
        </div>
      )}

      {editEntranceId && (
        <div className="fixed inset-0 z-[2100] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditEntranceId(null)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <EntranceEditModal entranceId={editEntranceId} onClose={() => setEditEntranceId(null)} onSaved={() => setRefreshToken((x) => x + 1)} />
          </div>
        </div>
      )}

      {editParkingId && (
        <div className="fixed inset-0 z-[2100] grid place-items-center p-4">
        <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditParkingId(null)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <ParkingEditModal parkingId={editParkingId} onClose={() => setEditParkingId(null)} onSaved={() => setRefreshToken((x) => x + 1)} />
          </div>
        </div>
      )}

      {editLandmarkId && (
        <div className="fixed inset-0 z-[2100] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditLandmarkId(null)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <LandmarkEditModal landmarkId={editLandmarkId} onClose={() => setEditLandmarkId(null)} onSaved={() => setRefreshToken((x) => x + 1)} />
          </div>
        </div>
      )}

      {/* ===== Crear recorrido (modal real) ===== */}
      {showRouteForm && (
        <div className="fixed inset-0 z-[2200] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setShowRouteForm(false)} />
          <div className="relative z-50 w-[min(92vw,900px)]" onClick={(e) => e.stopPropagation()}>
            <RouteCreateModal
              isOpen={true}
              onClose={() => setShowRouteForm(false)}
              onCreated={() => {
                setRefreshToken((x) => x + 1);
                setShowRouteForm(false);
              }}
            />
          </div>
        </div>
      )}

      {/* ===== Editar recorrido (modal real) ===== */}
      {editRouteId && (
        <div className="fixed inset-0 z-[2200] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setEditRouteId(null)} />
          <div className="relative z-50 w-[min(92vw,900px)]" onClick={(e) => e.stopPropagation()}>
            <RouteEditModal
              routeId={editRouteId}
              onClose={() => setEditRouteId(null)}
              onSaved={() => setRefreshToken((x) => x + 1)}
              onDeleted={() => setRefreshToken((x) => x + 1)}
            />
          </div>
        </div>
      )}

      {/* ===== Invitar administrador ===== */}
      {showInviteAdmin && (
        <div className="fixed inset-0 z-[2300] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setShowInviteAdmin(false)} />
          <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
            <AdminInviteModal onClose={() => setShowInviteAdmin(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
