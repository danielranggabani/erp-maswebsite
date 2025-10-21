import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import Invoices from "./pages/Invoices";
import SPK from "./pages/SPK";
import Finance from "./pages/Finance";
import Leads from "./pages/Leads";
import Packages from "./pages/Packages";
import Settings from "./pages/Settings";
import Developers from "./pages/Developers";
import NotFound from "./pages/NotFound";
import { RoleGuard } from "@/components/layout/RoleGuard"; 
import { UserRole } from "./hooks/useRoles"; 

const queryClient = new QueryClient();

// Definisikan peran untuk setiap halaman
const ADMIN_ROLES: UserRole[] = ['admin'];
const CS_ROLES: UserRole[] = ['admin', 'cs'];
const DEVELOPER_ROLES: UserRole[] = ['admin', 'developer'];
const FINANCE_ROLES: UserRole[] = ['admin', 'finance'];
const CS_DEV_ROLES: UserRole[] = ['admin', 'cs', 'developer'];
const DEV_MGMT_ROLES: UserRole[] = ['admin', 'cs', 'finance']; 


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Rute yang Dilindungi */}
            <Route path="/dashboard" element={<Dashboard />} /> 
            
            <Route path="/clients" element={<RoleGuard allowedRoles={CS_ROLES}><Clients /></RoleGuard>} />
            <Route path="/projects" element={<RoleGuard allowedRoles={CS_DEV_ROLES}><Projects /></RoleGuard>} />
            <Route path="/invoices" element={<RoleGuard allowedRoles={FINANCE_ROLES}><Invoices /></RoleGuard>} />
            <Route path="/spk" element={<RoleGuard allowedRoles={FINANCE_ROLES}><SPK /></RoleGuard>} />
            <Route path="/finance" element={<RoleGuard allowedRoles={FINANCE_ROLES}><Finance /></RoleGuard>} />
            <Route path="/leads" element={<RoleGuard allowedRoles={CS_ROLES}><Leads /></RoleGuard>} />
            <Route path="/packages" element={<RoleGuard allowedRoles={CS_ROLES}><Packages /></RoleGuard>} />
            <Route path="/settings" element={<RoleGuard allowedRoles={ADMIN_ROLES}><Settings /></RoleGuard>} />
            <Route path="/developers" element={<RoleGuard allowedRoles={DEV_MGMT_ROLES}><Developers /></RoleGuard>} />

            {/* BARIS INI DINONAKTIFKAN SEMENTARA untuk menghentikan redirect 404 aplikasi */}
            {/* <Route path="*" element={<NotFound />} /> */} 
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;