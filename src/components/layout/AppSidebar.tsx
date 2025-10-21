import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  FileText, 
  TrendingUp,
  UserPlus,
  Package,
  Settings,
  FileCheck,
  DollarSign,
  Code2 // Icon baru untuk Developer
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useRoles, UserRole } from '@/hooks/useRoles';

// Tambahkan definisi roles yang diizinkan untuk setiap menu
const mainMenuItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Clients', url: '/clients', icon: Users, roles: ['admin', 'cs'] },
  { title: 'Projects', url: '/projects', icon: FolderKanban, roles: ['admin', 'cs', 'developer'] },
  { title: 'Invoices', url: '/invoices', icon: FileText, roles: ['admin', 'finance'] },
  { title: 'SPK', url: '/spk', icon: FileCheck, roles: ['admin', 'finance'] },
  { title: 'Finance', url: '/finance', icon: DollarSign, roles: ['admin', 'finance'] },
];

// Group Menu Baru
const teamItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
  { title: 'Developers', url: '/developers', icon: Code2, roles: ['admin', 'cs', 'finance'] }, 
];

const marketingItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
  { title: 'Leads', url: '/leads', icon: UserPlus, roles: ['admin', 'cs'] },
  { title: 'Packages', url: '/packages', icon: Package, roles: ['admin', 'cs'] },
];

const settingsItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['admin'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { roles, isLoading: rolesLoading } = useRoles();
  const collapsed = state === 'collapsed';

  // Fungsi untuk memeriksa akses berdasarkan role
  const hasAccess = (allowedRoles: UserRole[] | undefined) => {
    if (!allowedRoles) return true; 
    if (rolesLoading) return false;
    return allowedRoles.some(role => roles.includes(role));
  };
  
  const filteredMainMenu = mainMenuItems.filter(item => hasAccess(item.roles));
  const filteredTeamItems = teamItems.filter(item => hasAccess(item.roles)); 
  const filteredMarketingItems = marketingItems.filter(item => hasAccess(item.roles));
  const filteredSettingsItems = settingsItems.filter(item => hasAccess(item.roles));

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/50';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Main Menu */}
        {filteredMainMenu.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMainMenu.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Team Management - NEW GROUP */}
        {filteredTeamItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Team Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredTeamItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {/* Marketing */}
        {filteredMarketingItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Marketing & Sales</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMarketingItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings */}
        {filteredSettingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSettingsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}