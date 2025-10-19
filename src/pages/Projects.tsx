import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Search, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type Client = Database['public']['Tables']['clients']['Row'];
type Package = Database['public']['Tables']['packages']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [developers, setDevelopers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    nama_proyek: '',
    client_id: '',
    package_id: '',
    harga: '',
    ruang_lingkup: '',
    estimasi_hari: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    developer_id: '',
    status: 'briefing',
    progress_notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, clientsRes, packagesRes, devsRes] = await Promise.all([
        supabase.from('projects').select(`
          *,
          clients(nama),
          packages(nama),
          profiles!projects_developer_id_fkey(full_name)
        `).order('created_at', { ascending: false }),
        supabase.from('clients').select('*').eq('status', 'deal'),
        supabase.from('packages').select('*').eq('is_active', true),
        supabase.from('profiles').select('*'),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (packagesRes.error) throw packagesRes.error;
      if (devsRes.error) throw devsRes.error;

      setProjects(projectsRes.data || []);
      setClients(clientsRes.data || []);
      setPackages(packagesRes.data || []);
      setDevelopers(devsRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectData: ProjectInsert = {
        nama_proyek: formData.nama_proyek,
        client_id: formData.client_id,
        package_id: formData.package_id || null,
        harga: parseFloat(formData.harga),
        ruang_lingkup: formData.ruang_lingkup || null,
        estimasi_hari: formData.estimasi_hari ? parseInt(formData.estimasi_hari) : null,
        tanggal_mulai: formData.tanggal_mulai || null,
        tanggal_selesai: formData.tanggal_selesai || null,
        developer_id: formData.developer_id || null,
        status: formData.status as any,
        progress_notes: formData.progress_notes || null,
      };

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id);
        if (error) throw error;
        toast({ title: 'Project updated successfully' });
      } else {
        const { error } = await supabase.from('projects').insert(projectData);
        if (error) throw error;
        toast({ title: 'Project created successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Project deleted successfully' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nama_proyek: '',
      client_id: '',
      package_id: '',
      harga: '',
      ruang_lingkup: '',
      estimasi_hari: '',
      tanggal_mulai: '',
      tanggal_selesai: '',
      developer_id: '',
      status: 'briefing',
      progress_notes: '',
    });
    setEditingProject(null);
  };

  const openEditDialog = (project: any) => {
    setEditingProject(project);
    setFormData({
      nama_proyek: project.nama_proyek,
      client_id: project.client_id,
      package_id: project.package_id || '',
      harga: project.harga.toString(),
      ruang_lingkup: project.ruang_lingkup || '',
      estimasi_hari: project.estimasi_hari?.toString() || '',
      tanggal_mulai: project.tanggal_mulai || '',
      tanggal_selesai: project.tanggal_selesai || '',
      developer_id: project.developer_id || '',
      status: project.status,
      progress_notes: project.progress_notes || '',
    });
    setDialogOpen(true);
  };

  const filteredProjects = projects.filter((p) =>
    p.nama_proyek.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      briefing: 'bg-blue-500',
      desain: 'bg-purple-500',
      development: 'bg-yellow-500',
      revisi: 'bg-orange-500',
      launch: 'bg-green-500',
    };
    return <Badge className={colors[status] || ''}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
            <p className="text-muted-foreground">
              Manage website development projects
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProject ? 'Edit Project' : 'New Project'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nama_proyek">Project Name</Label>
                    <Input
                      id="nama_proyek"
                      value={formData.nama_proyek}
                      onChange={(e) => setFormData({ ...formData, nama_proyek: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Client</Label>
                    <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="package_id">Package</Label>
                    <Select value={formData.package_id} onValueChange={(value) => setFormData({ ...formData, package_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select package" />
                      </SelectTrigger>
                      <SelectContent>
                        {packages.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="harga">Price (Rp)</Label>
                    <Input
                      id="harga"
                      type="number"
                      value={formData.harga}
                      onChange={(e) => setFormData({ ...formData, harga: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruang_lingkup">Scope of Work</Label>
                  <Textarea
                    id="ruang_lingkup"
                    value={formData.ruang_lingkup}
                    onChange={(e) => setFormData({ ...formData, ruang_lingkup: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimasi_hari">Est. Days</Label>
                    <Input
                      id="estimasi_hari"
                      type="number"
                      value={formData.estimasi_hari}
                      onChange={(e) => setFormData({ ...formData, estimasi_hari: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_mulai">Start Date</Label>
                    <Input
                      id="tanggal_mulai"
                      type="date"
                      value={formData.tanggal_mulai}
                      onChange={(e) => setFormData({ ...formData, tanggal_mulai: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_selesai">End Date</Label>
                    <Input
                      id="tanggal_selesai"
                      type="date"
                      value={formData.tanggal_selesai}
                      onChange={(e) => setFormData({ ...formData, tanggal_selesai: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="developer_id">Developer</Label>
                    <Select value={formData.developer_id} onValueChange={(value) => setFormData({ ...formData, developer_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign developer" />
                      </SelectTrigger>
                      <SelectContent>
                        {developers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="briefing">Briefing</SelectItem>
                        <SelectItem value="desain">Design</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="revisi">Revision</SelectItem>
                        <SelectItem value="launch">Launch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="progress_notes">Progress Notes</Label>
                  <Textarea
                    id="progress_notes"
                    value={formData.progress_notes}
                    onChange={(e) => setFormData({ ...formData, progress_notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingProject ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Developer</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : filteredProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No projects yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                        <TableCell>{project.clients?.nama || '-'}</TableCell>
                        <TableCell>{project.packages?.nama || '-'}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>{project.profiles?.full_name || '-'}</TableCell>
                        <TableCell>{project.tanggal_selesai || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(project)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(project.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
