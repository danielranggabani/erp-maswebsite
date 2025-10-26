import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, user_role, FinanceInsert } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge'; // Badge tidak terpakai di versi ini, bisa dihapus
import { useAuth } from '@/lib/auth';
import { useRoles } from '@/hooks/useRoles';
import { useEffect } from 'react';

// --- TIPE DATA (Sesuai Skema User) ---
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type PaymentRow = Database['public']['Tables']['developer_payments_tracking']['Row'];

interface DeveloperStats extends Profile {
    role: user_role;
    active_projects_count: number;
    completed_projects_count: number;
    pending_fee: number;
    total_fee_earned: number; // Dari tracking.amount_paid
    total_fee_paid: number;   // Sama dengan earned
    payment_records: PaymentRow[];
}

// --- UTILITY: FORMATTING ---
const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || amount === 0) return 'Rp 0';
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(numAmount);
};

// --- DATA FETCHING (Fix Typo & Kolom DB Asli) ---
const useDeveloperStats = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles();

    useEffect(() => {
        console.log('[useDeveloperStats Effect] User:', user?.id, 'Roles:', roles);
    }, [user, roles]);

    return useQuery<{ developers: DeveloperStats[], totals: { pending: number, earned: number, paid: number } }, Error>({
        queryKey: ['developer-stats', user?.id, roles.join(',')],
        queryFn: async () => {
            console.log('[useDeveloperStats QueryFn] Running fetch...');
            if (!user || rolesLoading) {
                 console.log('[useDeveloperStats QueryFn] Waiting...');
                 return { developers: [], totals: { pending: 0, earned: 0, paid: 0 } };
            }

            const isFullAccess = roles.includes('admin') || roles.includes('finance');
            const developerIdToShow = isFullAccess ? null : user.id;
            console.log('[useDeveloperStats QueryFn] IsFullAccess:', isFullAccess, 'DevID:', developerIdToShow);

            // 1. Get Developer Profiles
            let profilesQuery = supabase.from('profiles').select('id, full_name, avatar_url');
            let developerIds: string[] = [];
            if (developerIdToShow) {
                profilesQuery = profilesQuery.eq('id', developerIdToShow);
                developerIds = [developerIdToShow];
            } else {
                const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'developer');
                if (roleError) {
                    console.error("Role Error:", roleError);
                    toast({ title: 'Error Akses Roles', description: `Gagal ambil dev: ${roleError.message}. Cek RLS SELECT 'user_roles' Admin.`, variant: 'destructive', duration: 15000 });
                    return { developers: [], totals: { pending: 0, earned: 0, paid: 0 } }; // Return empty on error
                }
                developerIds = roleData.map(r => r.user_id);
                console.log('[useDeveloperStats QueryFn] Admin - Developer IDs:', developerIds);
                if (developerIds.length === 0) return { developers: [], totals: { pending: 0, earned: 0, paid: 0 } };
                profilesQuery = profilesQuery.in('id', developerIds);
            }
            const { data: profilesRes, error: profilesError } = await profilesQuery;
            // Handle profile fetch error more gracefully
            if (profilesError) {
                 console.error("Profile Error:", profilesError);
                 toast({ title: 'Error Profil Dev', description: profilesError.message, variant: 'destructive' });
                 return { developers: [], totals: { pending: 0, earned: 0, paid: 0 } }; // Return empty
            }
            if (!profilesRes || profilesRes.length === 0) {
                 console.log('[useDeveloperStats QueryFn] No matching profiles found.');
                 return { developers: [], totals: { pending: 0, earned: 0, paid: 0 } };
            }
            console.log('[useDeveloperStats QueryFn] Fetched Profiles:', profilesRes.length);

            // 2. Get Relevant Projects
            let projects: ProjectRow[] = [];
            if (developerIds.length > 0) {
                let projectsQuery = supabase.from('projects').select('id, developer_id, fee_developer, status')
                                    .in('developer_id', developerIds);
                const { data: projectsData, error: projectsError } = await projectsQuery;
                if (projectsError) { console.error("Project Error:", projectsError); throw projectsError; } // Let React Query handle this
                projects = (projectsData || []) as ProjectRow[];
            }
            console.log('[useDeveloperStats QueryFn] Fetched Projects:', projects.length);

            // 3. Get Relevant Payment Tracking Records
            let payments: PaymentRow[] = [];
            if (developerIds.length > 0) {
                let paymentQuery = supabase.from('developer_payments_tracking')
                                    .select('id, developer_id, amount_paid, paid_at, project_id') // <-- Kolom asli
                                    .in('developer_id', developerIds);
                const { data: paymentsRes, error: paymentsError } = await paymentQuery;
                if (paymentsError) {
                    console.error("Payment Tracking Error:", paymentsError);
                    toast({ title: 'Error Data Pembayaran', description: paymentsError.message + ". Cek RLS SELECT 'dev_payments'.", variant: 'destructive', duration: 10000 });
                    // Continue with empty payments array
                } else {
                    payments = (paymentsRes || []) as PaymentRow[];
                }
            }
            console.log('[useDeveloperStats QueryFn] Fetched Payment Records:', payments.length);

            // 4. Calculate Stats
            let totalPendingOverall = 0;
            let totalEarnedOverall = 0;
            // *** FIX: totalPaidOverall dideklarasikan di scope ini ***
            let totalPaidOverall = 0;

            const developerStatsPromises = profilesRes.map(async (profile) => {
                const devProjects = projects.filter(p => p.developer_id === profile.id);
                const devPayments = payments.filter(p => p.developer_id === profile.id);

                const activeProjectsCount = devProjects.filter(p => p.status !== 'selesai').length;
                const completedProjectsCount = devProjects.filter(p => p.status === 'selesai').length;

                const pendingFee = devProjects
                    .filter(p => p.status !== 'selesai')
                    .reduce((sum, p) => sum + Number(p.fee_developer || 0), 0);

                // Fee Diperoleh (Earned): Sum amount_paid dari tabel tracking
                const totalFeeEarned = devPayments
                    // *** Gunakan p.amount_paid ***
                    .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

                // Fee Terbayar (Paid): Asumsikan sama dengan Earned
                const totalFeePaid = totalFeeEarned;

                const { data: roleInfo } = await supabase.from('user_roles').select('role').eq('user_id', profile.id).limit(1).single();
                console.log(`[Stats for ${profile.full_name}] Pending: ${pendingFee}, Earned: ${totalFeeEarned}, Paid: ${totalFeePaid}, Records: ${devPayments.length}`);

                return {
                    ...profile, role: roleInfo?.role ?? 'developer' as user_role,
                    active_projects_count: activeProjectsCount, completed_projects_count: completedProjectsCount,
                    pending_fee: pendingFee, total_fee_earned: totalFeeEarned, total_fee_paid: totalFeePaid,
                    payment_records: devPayments,
                } as DeveloperStats;
            });

            const developerStats = await Promise.all(developerStatsPromises);

            // Kalkulasi total KESELURUHAN
            developerStats.forEach(dev => {
                totalPendingOverall += dev.pending_fee;
                totalEarnedOverall += dev.total_fee_earned;
                // *** FIX: Gunakan += BUKAN = ***
                totalPaidOverall += dev.total_fee_paid;
            });

            console.log('[useDeveloperStats QueryFn] Final Stats:', developerStats);
            console.log('[useDeveloperStats QueryFn] Final Totals:', { pending: totalPendingOverall, earned: totalEarnedOverall, paid: totalPaidOverall });

            return {
                developers: developerStats.sort((a, b) => (b.pending_fee ?? 0) - (a.pending_fee ?? 0)),
                totals: { pending: totalPendingOverall, earned: totalEarnedOverall, paid: totalPaidOverall }
            };
        },
        enabled: !!user && !rolesLoading,
        staleTime: 60 * 1000,
        retry: 1,
        onError: (error: any) => {
            console.error("[useDeveloperStats Hook] Overall Query Error:", error);
        }
    });
};
// ===================================================================

// --- MUTASI PEMBAYARAN ---
const usePaymentMutations = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();
    const { roles } = useRoles();

     const recordPaymentExpenseMutation = useMutation({
        mutationFn: async ({ developerId, developerName, totalAmountToPay, paymentRecordIds }: { developerId: string; developerName: string; totalAmountToPay: number; paymentRecordIds: string[] }) => {
            if (totalAmountToPay <= 0) throw new Error("Jumlah pembayaran > 0.");
            console.log(`[recordPayment] Recording expense for ${developerName}, Amount: ${totalAmountToPay}`);

            const financeData: FinanceInsert = {
                tipe: 'expense', kategori: 'gaji', nominal: totalAmountToPay,
                tanggal: new Date().toISOString().split('T')[0],
                keterangan: `Bayar fee ${developerName} (Ref:${paymentRecordIds.length} tasks)`,
                created_by: user?.id,
            };
            const { error: financeError } = await supabase.from('finances').insert(financeData);
            if (financeError) { console.error("[recordPayment] Insert Finance Error:", financeError); throw financeError; }
            console.log('[recordPayment] Expense recorded.');
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['developer-stats', user?.id, roles.join(',')] });
            queryClient.invalidateQueries({ queryKey: ['finances'] });
            toast({ title: 'Sukses', description: `Expense fee ${variables.developerName} (${formatCurrency(variables.totalAmountToPay)}) dicatat.` });
        },
        onError: (error: any) => {
            toast({ title: 'Error Catat Expense', description: `Gagal: ${error.message}. Cek RLS INSERT (finances).`, variant: 'destructive' });
        }
    });

     return { payFeeMutation: recordPaymentExpenseMutation };
}
// ===================================================================

// --- KOMPONEN UTAMA ---
export default function Developers() {
    const { data, isLoading: isLoadingStats, error: queryError } = useDeveloperStats();
    const { payFeeMutation } = usePaymentMutations();
    const { roles, isLoading: rolesLoading } = useRoles();

    const developerStats = data?.developers ?? [];
    const totals = data?.totals ?? { pending: 0, earned: 0, paid: 0 };
    const isFullAccess = !rolesLoading && (roles.includes('admin') || roles.includes('finance'));
    const isLoading = isLoadingStats || rolesLoading;

    console.log('[Developers Component Render] isLoading:', isLoading, 'isFullAccess:', isFullAccess, 'Stats Count:', developerStats.length);

     const handlePayEarnedFees = (developer: DeveloperStats) => {
         const earnedPaymentRecords = developer.payment_records;
         const earnedPaymentIds = earnedPaymentRecords.map(p => p.id);
         const totalAmountToPay = developer.total_fee_earned;

         if (earnedPaymentIds.length === 0 || totalAmountToPay <= 0) {
             toast({ title: "Info", description: "Tidak ada fee (earned) untuk dicatat." }); return;
         }
         if (confirm(`Catat expense ${formatCurrency(totalAmountToPay)} untuk ${developer.full_name}?`)) {
             payFeeMutation.mutate({
                 developerId: developer.id, developerName: developer.full_name,
                 totalAmountToPay: totalAmountToPay, paymentRecordIds: earnedPaymentIds
             });
         }
     };

    if (isLoading) {
         return <DashboardLayout><div className="flex justify-center items-center h-screen"><p className="text-muted-foreground animate-pulse">Memuat...</p></div></DashboardLayout>;
    }
     if (queryError && !isLoadingStats) {
         return ( <DashboardLayout><div className="container p-6 text-center"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h1 className="text-2xl font-bold text-destructive">Gagal Memuat</h1><p className="text-muted-foreground">Error data dev.</p><pre className="mt-2 text-xs text-left bg-muted p-2 rounded">{queryError.message}</pre><p className="text-sm mt-2">Cek RLS & nama kolom DB.</p></div></DashboardLayout>)
     }

    // Developer View
    if (!isFullAccess && developerStats.length === 1) {
        const dev = developerStats[0];
        console.log('[Developers Component] Rendering Developer View:', dev);
        return (
             <DashboardLayout>
                 <div className="container mx-auto p-6 space-y-6">
                     <div className="flex items-center gap-2"><DollarSign className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold">Laporan Fee Saya</h1></div>
                     <p className="text-muted-foreground">Ringkasan fee ({dev.full_name}).</p>
                      <div className="grid gap-4 md:grid-cols-3">
                         <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className='w-4 h-4 text-orange-600'/> Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-600">{formatCurrency(dev.pending_fee)}</p><p className="text-xs text-muted-foreground">{dev.active_projects_count} proyek aktif.</p></CardContent></Card>
                         <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className='w-4 h-4 text-blue-600'/> Diperoleh</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{formatCurrency(dev.total_fee_earned)}</p><p className="text-xs text-muted-foreground">{dev.completed_projects_count} proyek selesai.</p></CardContent></Card>
                         <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className='w-4 h-4 text-green-600'/> Est. Dibayar</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(dev.total_fee_paid)}</p><p className="text-xs text-muted-foreground">Jumlah tercatat.</p></CardContent></Card>
                     </div>
                      <Card>
                         <CardHeader><CardTitle>Riwayat Fee Diperoleh</CardTitle></CardHeader>
                         <CardContent>
                             <div className="rounded-md border overflow-x-auto">
                                 <Table>
                                     <TableHeader><TableRow><TableHead>Proyek ID</TableHead><TableHead>Jumlah Fee</TableHead><TableHead>Tgl. Dicatat</TableHead></TableRow></TableHeader>
                                     <TableBody>
                                         {dev.payment_records.length === 0 ? (
                                             <TableRow><TableCell colSpan={3} className='text-center text-muted-foreground py-6'>Belum ada fee.</TableCell></TableRow>
                                         ) : (
                                             [...dev.payment_records].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()).map(p => (
                                                 <TableRow key={p.id}>
                                                     <TableCell className="font-mono text-xs">{p.project_id.substring(0, 8)}...</TableCell>
                                                     <TableCell>{formatCurrency(p.amount_paid)}</TableCell> {/* Use amount_paid */}
                                                     <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('id-ID') : '-'}</TableCell> {/* Use paid_at */}
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
    } else if (!isFullAccess && developerStats.length === 0 && !isLoading) {
        // Developer login tapi tidak ada data
        return ( <DashboardLayout><div className="container p-6 text-center"><DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h1 className="text-2xl font-bold">Laporan Fee</h1><p className="text-muted-foreground">Anda belum memiliki data fee.</p></div></DashboardLayout>)
    }

    // Admin/Finance View
    console.log('[Developers Component] Rendering Admin/Finance View. Count:', developerStats.length);
    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between"> <div className="flex items-center gap-2"><Users className="h-8 w-8" /><h1 className="text-3xl font-bold">Pembayaran Developer</h1></div></div>
                <p className="text-muted-foreground">Ringkasan komisi dan status pembayaran.</p>
                {/* STATS CARDS */}
                 <div className="grid gap-4 md:grid-cols-4">
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Dev</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{developerStats.length}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Pending</CardTitle><Clock className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-xl font-bold text-orange-600">{formatCurrency(totals.pending)}</div><p className="text-xs text-muted-foreground">Proyek aktif.</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Diperoleh</CardTitle><DollarSign className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-xl font-bold text-blue-600">{formatCurrency(totals.earned)}</div><p className="text-xs text-muted-foreground">Proyek selesai.</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Expense</CardTitle><DollarSign className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(totals.paid)}</div><p className="text-xs text-muted-foreground">Tercatat.</p></CardContent></Card>
                </div>
                {/* DEVELOPER LIST TABLE */}
                <Card>
                    <CardHeader><CardTitle>Rincian Fee per Developer</CardTitle></CardHeader>
                     <CardContent className="p-0 pt-4">
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Developer</TableHead><TableHead>Pending</TableHead><TableHead>Diperoleh</TableHead>
                                        <TableHead>Est. Dibayar</TableHead><TableHead className='text-right min-w-[180px]'>Aksi Catat Bayar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {developerStats.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada developer.</TableCell></TableRow>
                                    ) : (
                                        developerStats.map(dev => {
                                            const earnedAmount = dev.total_fee_earned;
                                            const canPay = earnedAmount > 0;
                                            const isPayingThisDev = payFeeMutation.isPending && payFeeMutation.variables?.developerName === dev.full_name;
                                            return (
                                            <TableRow key={dev.id}>
                                                <TableCell className="font-medium">{dev.full_name}</TableCell>
                                                <TableCell className="font-semibold text-orange-600">{formatCurrency(dev.pending_fee)}</TableCell>
                                                <TableCell className="font-semibold text-blue-600">{formatCurrency(dev.total_fee_earned)}</TableCell>
                                                <TableCell className="font-semibold text-green-600">{formatCurrency(dev.total_fee_paid)}</TableCell>
                                                <TableCell className='text-right'>
                                                     <Button variant="default" size="sm" onClick={() => handlePayEarnedFees(dev)} disabled={!canPay || isPayingThisDev} title={!canPay ? "Belum ada fee" : `Catat Pembayaran ${formatCurrency(earnedAmount)}`} >
                                                         {isPayingThisDev ? 'Mencatat...' : `Catat Bayar (${formatCurrency(earnedAmount)})`}
                                                     </Button>
                                                </TableCell>
                                            </TableRow>
                                        )})
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                 {developerStats.length === 0 && !isLoading && isFullAccess && (
                     <Card className='border-yellow-500 bg-yellow-50 mt-4'><CardHeader className='flex-row items-center gap-2'><AlertCircle className='w-5 h-5'/><CardTitle>Info</CardTitle></CardHeader><CardContent>Tidak ada user 'developer'.</CardContent></Card>
                 )}
                  <Card className='border-blue-500 bg-blue-50 mt-4'>
                         <CardHeader className='flex-row items-center gap-2'><AlertCircle className='w-5 h-5'/><CardTitle>Info: Status Pembayaran</CardTitle></CardHeader>
                         <CardContent className='text-sm'>Kolom "Est. Dibayar" = "Diperoleh". Tombol "Catat Bayar" hanya membuat expense. **Rekomendasi:** Tambah kolom `payment_status` di `developer_payments_tracking`.</CardContent>
                     </Card>
            </div>
        </DashboardLayout>
    );
}