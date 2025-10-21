import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Code2, FolderKanban, TrendingUp, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

// Definisikan Tipe Data yang dibutuhkan
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type UserRole = Database['public']['Enums']['user_role'];

// Data Gabungan untuk Developer (Profile + Statistik)
interface DeveloperStats extends Profile {
    role: UserRole;
    active_projects: number;
    completed_projects: number;
    total_revenue_potential: number;
    performance_score: number; // Simulated score
}

// ======================= DATA FETCHING & PROCESSING =======================
const useDeveloperStats = () => {
    const { toast } = useToast();
    
    return useQuery({
        queryKey: ['developer-stats'],
        queryFn: async () => {
            const [profilesRes, projectsRes, rolesRes] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('projects').select('developer_id, harga, status'),
                // Hanya ambil yang memiliki role 'developer'
                supabase.from('user_roles').select('user_id, role').eq('role', 'developer'), 
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (projectsRes.error) throw projectsRes.error;
            if (rolesRes.error) throw rolesRes.error;
            
            const developers = rolesRes.data.map(r => r.user_id);
            const profilesMap = new Map(profilesRes.data.map(p => [p.id, p]));
            const projects = projectsRes.data as ProjectRow[];
            
            const statsMap = new Map<string, DeveloperStats>();

            // Inisialisasi dan hitung statistik
            developers.forEach(id => {
                const profile = profilesMap.get(id);
                if (profile) {
                    const devProjects = projects.filter(p => p.developer_id === id);
                    
                    const activeProjects = devProjects.filter(p => !['launch', 'selesai'].includes(p.status || '')).length;
                    const completedProjects = devProjects.filter(p => p.status === 'selesai').length;
                    // Hitung total potensi revenue (harga dari semua proyek)
                    const totalRevenuePotential = devProjects.reduce((sum, p) => sum + Number(p.harga), 0); 
                    
                    // Simulasi skor performa sederhana
                    const performanceScore = completedProjects * 5 + (activeProjects * 2);

                    statsMap.set(id, {
                        ...profile,
                        role: 'developer',
                        active_projects: activeProjects,
                        completed_projects: completedProjects,
                        total_revenue_potential: totalRevenuePotential,
                        performance_score: performanceScore,
                    });
                }
            });

            return Array.from(statsMap.values()).sort((a, b) => b.performance_score - a.performance_score); // Urutkan berdasarkan skor performa
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: 'Gagal memuat data developer: ' + error.message, variant: 'destructive' });
        }
    });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

// ======================= KOMPONEN UTAMA =======================
export default function Developers() {
  const { data: developerStats, isLoading } = useDeveloperStats();

  // Menghitung ringkasan di dashboard developer
  const totalDev = developerStats?.length || 0;
  const totalActiveProjects = developerStats?.reduce((sum, dev) => sum + dev.active_projects, 0) || 0;
  const totalRevenuePotential = developerStats?.reduce((sum, dev) => sum + dev.total_revenue_potential, 0) || 0;
  const avgScore = totalDev > 0 ? developerStats?.reduce((sum, dev) => sum + dev.performance_score, 0) / totalDev : 0;


  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
            <Code2 className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Manajemen Developer</h1>
        </div>
        <p className="text-muted-foreground">
            Laporan performa dan penugasan tim developer.
        </p>

        {/* STATS CARDS */}
        <div className="grid gap-4 md:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Developer</CardTitle>
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalDev}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Proyek Aktif Total</CardTitle>
                    <FolderKanban className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalActiveProjects}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Potensi Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl font-bold">{formatCurrency(totalRevenuePotential)}</div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rata-rata Performa</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{avgScore.toFixed(1)}</div>
                </CardContent>
            </Card>
        </div>

        {/* DEVELOPER LIST */}
        <Card>
          <CardHeader>
            <CardTitle>Performa Tim</CardTitle>
            <CardDescription>Daftar developer dengan statistik kinerja mereka.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Developer</TableHead>
                            <TableHead>Proyek Aktif</TableHead>
                            <TableHead>Proyek Selesai</TableHead>
                            <TableHead>Revenue Potensi</TableHead>
                            <TableHead>Skor Performa</TableHead>
                            <TableHead>Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                        ) : developerStats?.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Tidak ada developer yang terdaftar.</TableCell></TableRow>
                        ) : (
                            developerStats?.map(dev => (
                                <TableRow key={dev.id}>
                                    <TableCell className="flex items-center gap-3 font-medium">
                                        <Avatar>
                                            <AvatarFallback>{dev.full_name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                                        </Avatar>
                                        {dev.full_name}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold text-yellow-600">{dev.active_projects}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold text-green-600">{dev.completed_projects}</span>
                                    </TableCell>
                                    <TableCell>{formatCurrency(dev.total_revenue_potential)}</TableCell>
                                    <TableCell>
                                        <span className="font-bold text-blue-600">{dev.performance_score}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" disabled>Detail & Bayar</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}