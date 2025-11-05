import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ChangePassword() {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;

      // limpiar bandera must_change_password en app_users
      const { data: session } = await supabase.auth.getUser();
      const email = session.user?.email;
      if (email) {
        const { error: upErr } = await supabase
          .from("app_users")
          .update({ must_change_password: false })
          .eq("usuario", email);
        if (upErr) throw upErr;
      }

      toast.success("Contraseña actualizada");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="w-[min(92vw,420px)]">
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <Input
              type="password"
              placeholder="Nueva contraseña"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
