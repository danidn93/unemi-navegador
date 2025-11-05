import { ReactNode, useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Props = { children: ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean>(false);
  const [mustChange, setMustChange] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        const session = data.session;
        setAuthed(!!session);

        if (session?.user?.email) {
          const { data: u } = await supabase
            .from("app_users")
            .select("must_change_password")
            .eq("usuario", session.user.email)
            .maybeSingle();
          setMustChange(Boolean(u?.must_change_password));
        }
      } catch {
        setAuthed(false);
        setMustChange(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (mustChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
