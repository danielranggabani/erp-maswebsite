import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  FolderKanban,
  FileText,
  TrendingUp,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign // Tambahkan DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Tabel
import { Badge } from "@/components/ui/badge"; // Import Badge
import type { Database } from '@/integrations/supabase/types'; // Import tipe Database

type Finance = Database['public']['Tables']['finances']['Row']; // Tipe untuk finance

// Utility untuk format mata uang
const formatCurrency = (amount: number | null | undefined, unit: boolean = true) => {
  if (amount == null || isNaN(Number(amount))) return 'Rp 0';
  const numAmount = Number(amount);
  if (unit) {
    if (numAmount >= 1000000) {
        return 'Rp ' + (numAmount / 1000000).toFixed(1) + 'M';
    }
    if (numAmount >= 1000) {
        return 'Rp ' + (numAmount / 1000).toFixed(1) + 'K';
    }
  }
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(numAmount);
}


export default function Dashboard() {
  const navigate = useNavigate();

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  // Fetch stats utama
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [clientsRes, projectsRes, invoicesRes, financesRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id, status', { count: 'exact' }).not('status', 'in', '("selesai", "launch")'), // Hitung proyek aktif
        supabase.from('invoices').select('amount', { count: 'exact' }).in('status', ['menunggu_dp', 'overdue']), // Hitung invoice pending
        supabase.from('finances').select('nominal').eq('tipe', 'income').gte('tanggal', startOfMonth),
      ]);

      const totalClients = clientsRes.count || 0;
      const activeProjects = projectsRes.count || 0; // Langsung pakai count dari query
      const pendingInvoicesAmount = invoicesRes.data?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const pendingInvoicesCount = invoicesRes.count || 0; // Ambil jumlah invoice pending
      const revenue = financesRes.data?.reduce((sum, f) => sum + Number(f.nominal), 0) || 0;

      return {
        totalClients,
        activeProjects,
        pendingInvoicesAmount,
        pendingInvoicesCount,
        revenue,
      };
    },
    refetchInterval: 60000,
  });

  // Fetch pending developer fees
  const { data: devData, isLoading: isLoadingDevStats } = useQuery({
    queryKey: ['developer-stats-dashboard'],
    queryFn: async () => {
         const { data: projects, error } = await supabase
            .from('projects')
            .select('fee_developer, status')
            .neq('status', 'selesai');

         if (error) {
             console.error("Error fetching pending fees for dashboard:", error);
             return { totalPendingFee: 0 };
         }

         const totalPendingFee = projects?.reduce((sum, p) => sum + Number(p.fee_developer || 0), 0) || 0;
         return { totalPendingFee };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch 5 transaksi terakhir
  const { data: recentFinances, isLoading: isLoadingRecentFinances } = useQuery({
    queryKey: ['recent-finances-dashboard'],
    queryFn: async () => {
        const { data, error } = await supabase
            .from('finances')
            .select('*')
            .order('tanggal', { ascending: false })
            .order('created_at', { ascending: false }) // Tambah order by created_at jika tanggal sama
            .limit(5);
        if (error) {
             console.error("Error fetching recent finances:", error);
            return [];
        }
        return data as Finance[];
    },
    staleTime: 60 * 1000, // Refresh setiap menit
  });

  const isLoading = isLoadingStats || isLoadingDevStats || isLoadingRecentFinances;

  // Mock chart data
  const chartData = [
    { date: 'Senin', value: 1200000 },
    { date: 'Selasa', value: 1400000 },
    { date: 'Rabu', value: 1100000 },
    { date: 'Kamis', value: 1800000 },
    { date: 'Jumat', value: 1600000 },
    { date: 'Sabtu', value: 2200000 },
    { date: 'Minggu', value: 2100000 },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview bisnis dan performa agency Anda
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"> {/* Ubah jadi 5 kolom */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingStats ? '...' : (stats?.totalClients || 0)}</div>
              {/* <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">...</p> */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoadingStats ? '...' : (stats?.activeProjects || 0)}</div>
              {/* <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">...</p> */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? '...' : formatCurrency(stats?.pendingInvoicesAmount || 0, false)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                 {stats?.pendingInvoicesCount || 0} invoice
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue (Bulan Ini)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoadingStats ? '...' : formatCurrency(stats?.revenue || 0, false)}
              </div>
              {/* <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">...</p> */}
            </CardContent>
          </Card>

          {/* Card Baru: Pending Developer Fee */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fee Dev Pending</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                  {isLoadingDevStats ? '...' : formatCurrency(devData?.totalPendingFee || 0, false)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Estimasi belum dibayar</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Overview (Contoh)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total 7 hari terakhir (Data Contoh)
                </p>
              </div>
              {/*
              <div className="flex gap-2">
                <Button variant="outline" size="sm">7 Hari</Button>
                <Button variant="ghost" size="sm">30 Hari</Button>
                <Button variant="ghost" size="sm">3 Bulan</Button>
              </div>
              */}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value)} // Format Y-axis
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                   formatter={(value: number) => formatCurrency(value, false)} // Format tooltip
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions & Transaksi Terakhir */}
         <div className="grid gap-6 md:grid-cols-3"> {/* Ubah jadi 3 kolom */}
             {/* Quick Actions */}
             <Card className="hover:shadow-md transition-shadow cursor-pointer md:col-span-1" onClick={() => navigate('/clients')}>
                 <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="w-5 h-5" /> Kelola Klien</CardTitle></CardHeader>
                 <CardContent>
                     <p className="text-sm text-muted-foreground mb-4">Tambah atau lihat data klien.</p>
                     <Button className="w-full" size="sm"><PlusCircle className="w-4 h-4 mr-2" /> Tambah Klien</Button>
                 </CardContent>
             </Card>
             <Card className="hover:shadow-md transition-shadow cursor-pointer md:col-span-1" onClick={() => navigate('/projects')}>
                 <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="w-5 h-5" /> Kelola Proyek</CardTitle></CardHeader>
                 <CardContent>
                     <p className="text-sm text-muted-foreground mb-4">Buat proyek baru atau update progress.</p>
                     <Button className="w-full" size="sm"><PlusCircle className="w-4 h-4 mr-2" /> Tambah Proyek</Button>
                 </CardContent>
             </Card>
             <Card className="hover:shadow-md transition-shadow cursor-pointer md:col-span-1" onClick={() => navigate('/finance')}>
                 <CardHeader><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="w-5 h-5" /> Keuangan</CardTitle></CardHeader>
                 <CardContent>
                     <p className="text-sm text-muted-foreground mb-4">Catat transaksi atau lihat laporan.</p>
                     <Button className="w-full" size="sm"><PlusCircle className="w-4 h-4 mr-2" /> Tambah Transaksi</Button>
                 </CardContent>
             </Card>

             {/* Card Transaksi Terakhir */}
             <Card className="md:col-span-3"> {/* Buat card ini full width di bawah quick actions */}
                 <CardHeader>
                     <CardTitle>5 Transaksi Keuangan Terakhir</CardTitle>
                 </CardHeader>
                 <CardContent>
                    {isLoadingRecentFinances ? (
                         <p className="text-sm text-muted-foreground">Memuat transaksi...</p>
                    ) : !recentFinances || recentFinances.length === 0 ? (
                         <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
                    ) : (
                         <Table>
                             <TableHeader>
                                 <TableRow>
                                     <TableHead>Tanggal</TableHead>
                                     <TableHead>Keterangan</TableHead>
                                     <TableHead>Tipe</TableHead>
                                     <TableHead className="text-right">Nominal</TableHead>
                                 </TableRow>
                             </TableHeader>
                             <TableBody>
                                 {recentFinances.map((f) => (
                                     <TableRow key={f.id}>
                                         <TableCell>{new Date(f.tanggal).toLocaleDateString('id-ID')}</TableCell>
                                         <TableCell className="max-w-[200px] truncate">{f.keterangan || '-'}</TableCell>
                                         <TableCell>
                                             <Badge variant={f.tipe === 'income' ? 'default' : 'destructive'} className={f.tipe === 'income' ? 'bg-green-500' : 'bg-red-500'}>
                                                 {f.tipe}
                                             </Badge>
                                         </TableCell>
                                         <TableCell className={`text-right font-medium ${f.tipe === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                             {formatCurrency(f.nominal, false)}
                                         </TableCell>
                                     </TableRow>
                                 ))}
                             </TableBody>
                         </Table>
                    )}
                     <Button variant="link" size="sm" className="mt-4" onClick={() => navigate('/finance')}>Lihat Semua Transaksi</Button>
                 </CardContent>
             </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}