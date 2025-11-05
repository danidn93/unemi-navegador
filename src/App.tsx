import { Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Index from "@/pages/Index";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import ChangePassword from "@/pages/ChangePassword";
import ProtectedRoute from "@/components/ProtectedRoute";
import ResetTempPassword from "./pages/ResetTempPassword";
import ResetPassword from "./pages/ResetPassword";
// import PublicNavigator from "@/components/PublicNavigator";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster richColors closeButton />
        <Routes>
          {/* Público */}
          {/* <Route path="/navegador" element={<PublicNavigator />} /> */}
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/reset-temp-password" element={<ResetTempPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Panel admin */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
