import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Code2, FolderKanban, DollarSign, Clock, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';

// Definisikan Tipe Data yang dibutuhkan
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type UserRole = Database['public']['Enums']['user_role'];

// Data Gabungan untuk Developer (Profile + Statistik)
interface DeveloperStats extends Profile {
    role: UserRole;
    active_projects_count: number;
    completed_projects_count: number;
    pending_fee: number; // BARU: Total fee dari proyek yang belum selesai
    total_fee_paid: number; // BARU: Total fee yang sudah dibayarkan (simulasi)
}

// ======================= UTILITY: FORMATTING =======================
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};
// ===================================================================


// ======================= DATA FETCHING & PROCESSING =======================
const useDeveloperStats = () => {
    const { toast } = useToast();
    
    return useQuery({
        queryKey: ['developer-stats'],
        queryFn: async () => {
            const [profilesRes, projectsRes, rolesRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, avatar_url'),
                // Ambil fee_developer dari projects
                supabase.from('projects').select('developer_id, fee_developer, status'),
                supabase.from('user_roles').select('user_id, role').eq('role', 'developer'), 
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (projectsRes.error) throw projectsRes.error;
            if (rolesRes.error) throw rolesRes.error;
            
            const developerUserIds = rolesRes.data.map(r => r.user_id);
            const profilesMap = new Map(profilesRes.data.map(p => [p.id, p]));
            const projects = projectsRes.data as ProjectRow[];
            
            const statsMap = new Map<string, DeveloperStats>();
            
            // Inisialisasi dan hitung statistik
            developerUserIds.forEach(id => {
                const profile = profilesMap.get(id);
                if (profile) {
                    const devProjects = projects.filter(p => p.developer_id === id);
                    
                    const activeProjectsCount = devProjects.filter(p => p.status !== 'selesai').length;
                    const completedProjectsCount = devProjects.filter(p => p.status === 'selesai').length;
                    
                    // Hitung total pending fee
                    const pendingFee = devProjects
                        .filter(p => p.status !== 'selesai')
                        .reduce((sum, p) => sum + Number(p.fee_developer || 0), 0);
                        
                    // Hitung total fee yang sudah dibayarkan (simulasi: diasumsikan semua yang selesai sudah dibayar)
                    const totalFeePaid = devProjects
                        .filter(p => p.status === 'selesai')
                        .reduce((sum, p) => sum + Number(p.fee_developer || 0), 0);

                    statsMap.set(id, {
                        ...profile,
                        role: 'developer' as UserRole, 
                        active_projects_count: activeProjectsCount,
                        completed_projects_count: completedProjectsCount,
                        pending_fee: pendingFee,
                        total_fee_paid: totalFeePaid,
                    } as DeveloperStats);
                }
            });

            return Array.from(statsMap.values()).sort((a, b) => b.pending_fee - a.pending_fee);
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: 'Gagal memuat data developer: ' + error.message, variant: 'destructive' });
        }
    });
};


// ======================= KOMPONEN UTAMA =======================
export default function Developers() {
    const { data: developerStats, isLoading } = useDeveloperStats();
    
    // Menghitung ringkasan di dashboard developer (Fokus pada fee dan proyek)
    const totalDev = developerStats?.length || 0;
    const totalPendingFee = developerStats?.reduce((sum, dev) => sum + dev.pending_fee, 0) || 0;
    const totalPaidFee = developerStats?.reduce((sum, dev) => sum + dev.total_fee_paid, 0) || 0;


    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        <h1 className="text-3xl font-bold">Manajemen Pembayaran Developer</h1>
                    </div>
                </div>
                <p className="text-muted-foreground">
                    Laporan komisi dan penugasan proyek tim.
                </p>

                {/* STATS CARDS (Fokus pada Keuangan Developer) */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Developer Aktif</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalDev}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Pending Fee</CardTitle>
                            <DollarSign className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-orange-600">{formatCurrency(totalPendingFee)}</div>
                            <p className="text-xs text-muted-foreground">Potensi pembayaran yang akan datang.</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Fee Terbayar</CardTitle>
                            <DollarSign className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-green-600">{formatCurrency(totalPaidFee)}</div>
                            <p className="text-xs text-muted-foreground">Fee dari proyek yang sudah diselesaikan.</p>
                        </CardContent>
                    </Card>
                </div>

                {/* DEVELOPER LIST */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Komisi Developer</CardTitle>
                        <CardContent className="p-0 pt-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Developer</TableHead>
                                            <TableHead>Proyek Aktif</TableHead>
                                            <TableHead>Proyek Selesai</TableHead>
                                            <TableHead>Pending Fee</TableHead> {/* BARU */}
                                            <TableHead>Fee Terbayar</TableHead> {/* BARU */}
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
                                                        {dev.full_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className='bg-yellow-100 text-yellow-800 hover:bg-yellow-200'>{dev.active_projects_count} Proyek</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className='bg-green-100 text-green-800 hover:bg-green-200'>{dev.completed_projects_count} Proyek</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-bold text-orange-600">
                                                            {formatCurrency(dev.pending_fee)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-bold text-green-600">
                                                            {formatCurrency(dev.total_fee_paid)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="outline" size="sm" disabled={dev.pending_fee === 0}>Bayar Komisi</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </CardHeader>
                </Card>
            </div>
        </DashboardLayout>
    );
}