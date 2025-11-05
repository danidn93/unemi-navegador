import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search as SearchIcon,
  MapPin,
  Building2,
  GraduationCap,
  Beaker,
  BookOpen,
  Users,
  PencilLine,
  AlertTriangle,
  List as ListIcon,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type BuildingState = "HABILITADO" | "REPARACIÓN";

type Room = {
  id: string;
  name: string;
  room_number?: string | null;
  description?: string | null;
  capacity?: number | null;
  keywords?: string[] | null;
  equipment?: string[] | null;
  floor: {
    id?: string;
    floor_number: number;
    floor_name?: string | null;
    building: {
      id?: string;
      name: string;
      building_code?: string | null;
      latitude?: number;
      longitude?: number;
      state: BuildingState;
    };
  };
  room_type: { name: string; description?: string | null } | null;
};

type Route = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

const roomTypeCategories = [
  { id: "all", name: "Todos", icon: Building2 },
  { id: "Aula", name: "Aulas", icon: BookOpen },
  { id: "Oficina", name: "Oficinas", icon: Building2 },
  { id: "Laboratorio", name: "Laboratorios", icon: Beaker },
  { id: "Facultad", name: "Facultades", icon: GraduationCap },
  { id: "Departamento", name: "Departamentos", icon: Users },
];

interface SearchPanelProps {
  onLocationSelect: (location: any) => void;
  selectedLocation?: any;
  onEditRoom?: (room: Room) => void;
  onEditRoute?: (id: string) => void;
  onDeleteRoute?: (id: string) => void;
  refreshToken?: number;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  onLocationSelect,
  selectedLocation,
  onEditRoom,
  onEditRoute,
  onDeleteRoute,
  refreshToken,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"locations" | "routes">("locations");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rooms")
        .select(
          `
          id, name, room_number, description, capacity, keywords, equipment,
          floor:floors(
            id, floor_number, floor_name,
            building:buildings(
              id, name, building_code, latitude, longitude, state
            )
          ),
          room_type:room_types(name, description)
        `
        )
        .order("name", { ascending: true });

      if (error) throw error;
      if (mountedRef.current) setRooms((data as unknown as Room[]) || []);
    } catch (err) {
      console.error("[SearchPanel] Error loading rooms:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from("routes")
        .select("id,name,description,is_active,created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setRoutes(data || []);
    } catch (err) {
      console.error("[SearchPanel] Error loading routes:", err);
      toast.error("No se pudo cargar recorridos");
    }
  };

  useEffect(() => {
    loadRooms();
    loadRoutes();
  }, []);

  useEffect(() => {
    if (refreshToken !== undefined) {
      loadRooms();
      loadRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  useEffect(() => {
    const channel = supabase
      .channel("rooms_searchpanel")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        window.setTimeout(() => loadRooms(), 150);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, () => {
        window.setTimeout(() => loadRoutes(), 150);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (selectedCategory !== "all") {
      list = list.filter((r) => r.room_type?.name === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const inName = r.name?.toLowerCase().includes(q);
        const inDesc = r.description?.toLowerCase().includes(q);
        const inNumber = r.room_number?.toLowerCase().includes(q);
        const inBldg = r.floor?.building?.name?.toLowerCase().includes(q);
        const inKeys = (r.keywords || []).some((k) => k.toLowerCase().includes(q));
        const inEquip = (r.equipment || []).some((e) => e.toLowerCase().includes(q));
        return inName || inDesc || inNumber || inBldg || inKeys || inEquip;
      });
    }
    return list;
  }, [rooms, selectedCategory, searchQuery]);

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes;
    const q = searchQuery.toLowerCase();
    return routes.filter((rt) => rt.name?.toLowerCase().includes(q) || (rt.description || "").toLowerCase().includes(q));
  }, [routes, searchQuery]);

  const handleGo = (room: Room) => {
    onLocationSelect({
      ...room,
      coordinates: [room.floor.building.longitude, room.floor.building.latitude],
      building_name: room.floor.building.name,
      floor_info: `Piso ${room.floor.floor_number}${room.floor.floor_name ? ` — ${room.floor.floor_name}` : ""}`,
    });
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm("¿Eliminar este recorrido? Esta acción no se puede deshacer.")) return;
    try {
      const { error } = await supabase.from("routes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Recorrido eliminado");
      loadRoutes();
      onDeleteRoute?.(id);
    } catch (err: any) {
      console.error("Error deleting route", err);
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <Card className="w-full h-full flex flex-col bg-[#0F2430]/80 backdrop-blur-sm border border-[#0B1A23]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-[#E6EDF3]">
          <div className="w-9 h-9 bg-[#FF6900] rounded-full grid place-items-center">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          UNEMI Navigator
        </CardTitle>
        <p className="text-sm text-[#9FB3BF]">Encuentra ubicaciones o recorridos en el campus</p>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9FB3BF]" />
          <Input
            placeholder="Buscar aulas, oficinas, laboratorios o recorridos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0F2430] border-[#183648] text-[#E6EDF3] placeholder:text-[#87A0AC]"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setActiveTab("locations")}
            className={`px-3 py-1 rounded ${activeTab === "locations" ? "bg-[#FF6900] text-white" : "bg-[#0F2430] text-[#E6EDF3] border border-[#183648]"}`}
          >
            Ubicaciones
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`px-3 py-1 rounded ${activeTab === "routes" ? "bg-[#FF6900] text-white" : "bg-[#0F2430] text-[#E6EDF3] border border-[#183648]"}`}
          >
            Recorridos
          </button>
        </div>

        {activeTab === "locations" && (
          <>
            <div className="mt-4">
              <p className="text-sm font-medium text-[#E6EDF3] mb-2">Categorías</p>
              <div className="flex flex-wrap gap-2">
                {roomTypeCategories.map((cat) => {
                  const Icon = cat.icon;
                  const active = selectedCategory === cat.id;
                  return (
                    <Badge
                      key={cat.id}
                      variant={active ? "default" : "secondary"}
                      className={
                        active
                          ? "bg-[#FF6900] text-white hover:bg-[#FF6900]/90"
                          : "bg-[#0F2430] text-[#E6EDF3] border border-[#183648] hover:bg-[#132C3A]"
                      }
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {cat.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </CardContent>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-28">
        <div className="px-4">
          {activeTab === "locations" && (
            <>
              <p className="text-sm font-medium text-[#9FB3BF] mb-3">Ubicaciones ({filteredRooms.length})</p>

              {loading ? (
                <div className="text-center py-10 text-[#87A0AC]">Cargando ubicaciones…</div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-10 text-[#87A0AC]">No se encontraron ubicaciones</div>
              ) : (
                <div className="space-y-4">
                  {filteredRooms.map((room) => {
                    const isSelected = selectedLocation?.id === room.id;
                    const bState = room.floor?.building?.state ?? "HABILITADO";
                    const buildingDisabled = bState !== "HABILITADO";
                    return (
                      <div
                        key={room.id}
                        className={[
                          "rounded-xl border p-4 transition-all",
                          "bg-[#102A36] border-[#183648] shadow-sm",
                          isSelected ? "ring-2 ring-[#FF6900]/70" : "",
                        ].join(" ")}
                      >
                        {/* header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#0B1F2A] border border-[#183648] grid place-items-center flex-shrink-0">
                              <MapPin className="h-4 w-4 text-[#FF6900]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-[17px] text-[#E6EDF3] truncate">
                                  {room.name}
                                </h3>
                                {room.room_number && (
                                  <span className="text-xs text-[#9FB3BF]">
                                    ({room.room_number})
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[#9FB3BF]">
                                {room.floor.building.name} — Piso {room.floor.floor_number}
                              </p>

                              {buildingDisabled && (
                                <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40">
                                  <AlertTriangle className="h-3 w-3" />
                                  Edificio en {bState === "REPARACIÓN" ? "reparación" : "estado no habilitado"}
                                </div>
                              )}
                            </div>
                          </div>

                          {onEditRoom && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onEditRoom(room)}
                              className="bg-[#0F2430] text-[#E6EDF3] border border-[#183648] hover:bg-[#132C3A]"
                            >
                              <PencilLine className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          )}
                        </div>

                        {/* chips */}
                        <div className="flex items-center gap-2 flex-wrap mt-3">
                          <Badge className="bg-[#0F2430] text-[#E6EDF3] border border-[#183648]">
                            {room.room_type?.name || "Tipo no definido"}
                          </Badge>
                          {room.capacity != null && (
                            <Badge variant="outline" className="text-[#E6EDF3] border-[#183648]">
                              {room.capacity} personas
                            </Badge>
                          )}
                          {(room.keywords || []).slice(0, 3).map((k) => (
                            <span
                              key={k}
                              className="text-xs bg-[#0F2430] text-[#C7D4DB] border border-[#183648] rounded px-2 py-0.5"
                            >
                              {k}
                            </span>
                          ))}
                        </div>

                        {/* botón Ir */}
                        <div className="mt-4">
                          <Button
                            className="bg-[#FF6900] hover:bg-[#FF6900]/90 text-white w-full justify-center"
                            onClick={() => handleGo(room)}
                          >
                            <span className="truncate">Ir a {room.name}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="h-4" />
                </div>
              )}
            </>
          )}

          {activeTab === "routes" && (
            <>
              <p className="text-sm font-medium text-[#9FB3BF] mb-3">Recorridos ({filteredRoutes.length})</p>

              {routes.length === 0 ? (
                <div className="text-center py-10 text-[#87A0AC]">No hay recorridos</div>
              ) : (
                <div className="space-y-3">
                  {filteredRoutes.map((rt) => (
                    <div key={rt.id} className="rounded-xl border p-3 bg-[#102A36] border-[#183648]">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-[#E6EDF3]">{rt.name}</div>
                          <div className="text-xs text-[#9FB3BF]">{rt.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {onEditRoute && (
                            <Button size="sm" variant="secondary" onClick={() => onEditRoute(rt.id)}>
                              <PencilLine className="h-4 w-4 mr-1" />
                              Editar / pasos
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteRoute(rt.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SearchPanel;
