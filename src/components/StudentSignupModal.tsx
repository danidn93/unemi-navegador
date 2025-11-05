import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

const ALLOWED_DOMAIN = "unemi.edu.ec";

export default function StudentSignupModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      toast.error(`El correo debe terminar en @${ALLOWED_DOMAIN}`);
      return;
    }
    if (pw.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (pw !== pw2) return toast.error("Las contraseñas no coinciden");

    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { role: "student" },
        },
      });
      if (error) throw error;
      toast.success("Revisa tu correo para confirmar la cuenta");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card text-card-foreground w-[min(92vw,420px)] rounded-2xl shadow-2xl border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Crear cuenta (estudiante)</h3>
        <button className="p-1 rounded hover:bg-accent" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={signUp} className="p-4 grid gap-3">
        <div className="grid gap-1.5">
          <Label>Correo institucional</Label>
          <Input type="email" placeholder="tucorreo@unemi.edu.ec" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Contraseña</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Repetir contraseña</Label>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creando…" : "Crear cuenta"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Solo se permiten correos <b>@{ALLOWED_DOMAIN}</b>. Se enviará un correo de confirmación.
        </p>
      </form>
    </div>
  );
}
