// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as any)?.from ?? "/";

  // --- LOGIN (admins) ---
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  const onSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });
      if (error) throw error;
      toast.success("Sesión iniciada");
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo iniciar sesión");
    } finally {
      setLoadingLogin(false);
    }
  };

  const onForgotPassword = async () => {
    const mail = email.trim();
    if (!mail) return toast.info("Ingresa tu correo institucional arriba para enviarte el enlace.");
    try {
      await supabase.auth.resetPasswordForEmail(mail, {
        // Pantalla donde el usuario definirá su nueva contraseña
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Te enviamos un enlace para restablecer la contraseña. Revisa tu correo (o SPAM).");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo enviar el enlace de recuperación");
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/bg-admin.png')` }}
    >
      {/* Overlay para contraste */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 text-white/90">
          <div className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center ring-1 ring-white/20">
            <LogIn className="h-5 w-5" />
          </div>
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">UNEMI Campus · Acceso</h1>
            <p className="text-xs text-white/75">Panel administrativo de navegación</p>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="relative z-10 min-h-[calc(100vh-64px)]">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6">
          <div className="flex h-[calc(100vh-64px)] items-center">
            <div className="hidden md:block md:basis-1/2 lg:basis-2/3" />
            <div className="w-full md:basis-1/2 lg:basis-1/3">
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 text-white shadow-2xl">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-semibold">Iniciar sesión</CardTitle>
                  <CardDescription className="text-white/80">
                    Usa tus credenciales institucionales para acceder al panel.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={onSubmitLogin} className="grid gap-5" autoComplete="on">
                    {/* Email */}
                    <div className="grid gap-2">
                      <label htmlFor="email" className="text-sm text-white/90">
                        Correo
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                        <Input
                          id="email"
                          type="email"
                          autoComplete="username"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tucorreo@unemi.edu.ec"
                          required
                          className="pl-9 bg-white/90 text-slate-900 placeholder:text-slate-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="grid gap-2">
                      <label htmlFor="password" className="text-sm text-white/90">
                        Contraseña
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                        <Input
                          id="password"
                          type={showPw ? "text" : "password"}
                          autoComplete="current-password"
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="pl-9 pr-10 bg-white/90 text-slate-900 placeholder:text-slate-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-900"
                          aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs text-white/80 hover:text-white underline underline-offset-2"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                      <Button type="submit" disabled={loadingLogin} className="bg-white text-slate-900 hover:bg-white/90">
                        {loadingLogin ? "Ingresando…" : "Ingresar"}
                      </Button>
                    </div>

                    <p className="text-center text-xs text-white/70 mt-2">
                      © {new Date().getFullYear()} Universidad Estatal de Milagro — Sistema de Navegación
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
