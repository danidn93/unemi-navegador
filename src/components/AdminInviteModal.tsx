import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { X, Mail, Building2, User, Loader2, BadgeCheck } from "lucide-react";

type Props = { onClose: () => void };

// Clave interna SOLO para cumplir signUp. No se muestra ni se envía.
function genInternalPassword(len = 16) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const pool = letters + digits + symbols;
  let out = "";
  for (let i = 0; i < len; i++) out += pool[Math.floor(Math.random() * pool.length)];
  if (!/[!@#$%^&*]/.test(out)) out = out.slice(0, -1) + symbols[Math.floor(Math.random() * symbols.length)];
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + digits[Math.floor(Math.random() * digits.length)];
  return out;
}

export default function AdminInviteModal({ onClose }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { email: string }>(null);

  const canSubmit = useMemo(
    () => fullName.trim().length > 3 && /\S+@\S+\.\S+/.test(email) && dept.trim().length > 1,
    [fullName, email, dept]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const internalPw = genInternalPassword();
      const redirect = `https://navegador-unemi.onrender.com/reset-temp-password?email=${encodeURIComponent(email)}`;

      const { error } = await supabase.auth.signUp({
        email,
        password: internalPw,
        options: {
          data: {
            full_name: fullName,
            role: "admin",
            department: dept,
            require_password_change: true, // bandera opcional para tu UI
          },
          emailRedirectTo: redirect, // Confirm sign up → aterriza en /reset-temp-password
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("already")) {
          toast.error("Ese correo ya tiene cuenta. Usa 'Olvidé mi contraseña'.");
        } else {
          toast.error(error.message || "No se pudo invitar.");
        }
        setSubmitting(false);
        return;
      }

      setDone({ email });
      toast.success("Enviamos un correo para activar el acceso.");
    } catch (err: any) {
      toast.error(err?.message ?? "Error al invitar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-[min(92vw,560px)]">
      <Card className="bg-white/95 dark:bg-slate-900/95 border-white/20 shadow-2xl relative">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">Invitar administrador</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-grid place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <BadgeCheck className="h-5 w-5" />
              <p>¡Invitación enviada a <b>{done.email}</b>!</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Cuando confirme su correo, será llevado a <code>/reset-temp-password</code> para crear su contraseña.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: María Fernanda López" className="pl-9" required />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Correo institucional</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@unemi.edu.ec" className="pl-9" required />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dept">Dirección / Departamento</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                <Input id="dept" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Ej: Aseguramiento de la Calidad" className="pl-9" required />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Invitando…</>) : ("Invitar")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
