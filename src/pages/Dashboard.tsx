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
  ArrowDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [clients, projects, invoices, finances] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id, status', { count: 'exact' }),
        supabase.from('invoices').select('amount, status').eq('status', 'menunggu_dp'),
        supabase.from('finances').select('nominal, tipe').gte('tanggal', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      ]);

      const totalClients = clients.count || 0;
      const activeProjects = projects.data?.filter(p => !['selesai', 'launch'].includes(p.status)).length || 0;
      const pendingInvoices = invoices.data?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const revenue = finances.data?.filter(f => f.tipe === 'income').reduce((sum, f) => sum + Number(f.nominal), 0) || 0;

      return {
        totalClients,
        activeProjects,
        pendingInvoices,
        revenue,
      };
    },
  });

  // Mock chart data
  const chartData = [
    { date: 'Jan 24', value: 1200 },
    { date: 'Jan 25', value: 1400 },
    { date: 'Jan 26', value: 1100 },
    { date: 'Jan 27', value: 1800 },
    { date: 'Jan 28', value: 1600 },
    { date: 'Jan 29', value: 2200 },
    { date: 'Jan 30', value: 2100 },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview bisnis dan performa agency Anda
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <span className="text-green-500">+12.5%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeProjects || 0}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <span className="text-green-500">+4.8%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {((stats?.pendingInvoices || 0) / 1000).toFixed(1)}K
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ArrowDownRight className="h-3 w-3 text-yellow-500" />
                <span className="text-yellow-500">-2.4%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {((stats?.revenue || 0) / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <span className="text-green-500">+18.2%</span> from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Overview</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total for the last 7 days
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Last 7 days</Button>
                <Button variant="outline" size="sm">Last 30 days</Button>
                <Button variant="outline" size="sm">Last 3 months</Button>
              </div>
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
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/clients')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5" />
                Client Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Manage client data and communication history
              </p>
              <Button className="w-full" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Add New Client
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/projects')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="w-5 h-5" />
                Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Track progress and manage website projects
              </p>
              <Button className="w-full" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Create New Project
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/invoices')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-5 h-5" />
                Invoices & SPK
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate invoices and work agreements
              </p>
              <Button className="w-full" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
