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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Search, Pencil, Trash2, User, CheckCircle2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { useRoles } from '@/hooks/useRoles'; 

// ======================= TIPE DATA =======================
type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type UserRole = Database['public']['Enums']['user_role']; 
type Client = Database['public']['Tables']['clients']['Row'];
type Package = Database['public']['Tables']['packages']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProjectExtended extends Project {
    clients: { nama: string } | null;
    packages: { nama: string } | null;
}

const statusColors = {
    briefing: 'bg-gray-500',
    design: 'bg-blue-500',
    development: 'bg-yellow-500',
    revisi: 'bg-orange-500',
    launch: 'bg-green-500',
    selesai: 'bg-emerald-600',
};

const initialFormData: Partial<ProjectInsert> = {
    nama_proyek: '',
    client_id: '',
    package_id: null,
    harga: 0,
    ruang_lingkup: '',
    status: 'briefing',
    developer_id: null,
    tanggal_mulai: null,
    tanggal_selesai: null,
    estimasi_hari: null,
    fee_developer: 0, 
};

// ======================= HOOKS DATA & MUTASI =======================

const useProjectData = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [allData, setAllData] = useState<{
        projects: ProjectExtended[];
        clients: Client[];
        packages: Package[];
        developers: Profile[]; 
    }>({ projects: [], clients: [], packages: [], developers: [] });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Ambil ID semua user dengan role 'developer'
            const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'developer');
            if (roleError) throw roleError;
            const developerIds = roleData.map(r => r.user_id);
            
            // 2. Ambil Profiles hanya untuk ID developer
            const { data: devsRes, error: devsError } = await supabase.from('profiles').select('id, full_name').in('id', developerIds);
            if (devsError) throw devsError;

            // 3. Ambil data utama lainnya (Projects)
            const [projectsRes, clientsRes, packagesRes] = await Promise.all([
                supabase.from('projects').select(`
                    *,
                    clients(nama),
                    packages(nama)
                `).order('created_at', { ascending: false }),
                supabase.from('clients').select('id, nama'), 
                supabase.from('packages').select('id, nama').eq('is_active', true),
            ]);

            if (projectsRes.error) throw projectsRes.error;
            if (clientsRes.error) throw clientsRes.error;
            if (packagesRes.error) throw projectsRes.error;

            setAllData({
                projects: projectsRes.data as ProjectExtended[],
                clients: clientsRes.data as Client[],
                packages: packagesRes.data as Package[],
                developers: devsRes as Profile[], 
            });
        } catch (error: any) {
            console.error("Project Fetch Error:", error.message);
            toast({ 
                title: 'Gagal Memuat Data', 
                description: 'Terjadi kesalahan saat mengambil data proyek. Periksa konsol untuk detail.', 
                variant: 'destructive' 
            });
        } finally {
            setLoading(false);
        }
    };
    
    const createMutation = useMutation({
        mutationFn: async (data: ProjectInsert) => {
            const { error } = await supabase.from('projects').insert([data]);
            if (error) throw error;
        },
        onSuccess: () => fetchData(),
        onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectInsert> }) => {
            const { error } = await supabase.from('projects').update(data).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => fetchData(),
        onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Project deleted successfully' });
            fetchData();
        },
        onError: (error: any) => {
             toast({ title: 'Error Delete', description: `Gagal menghapus proyek. Pastikan Anda memiliki hak akses. Detail: ${error.message}`, variant: 'destructive' });
        }
    });

    return { 
        projects: allData.projects, 
        clients: allData.clients, 
        packages: allData.packages, 
        developers: allData.developers, 
        isLoading: loading, 
        createMutation, 
        updateMutation, 
        deleteMutation, 
        fetchData 
    };
};
// ========================================================================


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};


export default function Projects() {
    const { roles, isLoading: rolesLoading } = useRoles();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ProjectInsert>>(initialFormData);
    const [editingProject, setEditingProject] = useState<ProjectExtended | null>(null);
    
    const isAdmin = roles.includes('admin');
    const isCS = roles.includes('cs');
    const isDeveloper = roles.includes('developer');
    const isFullAccessRole = isAdmin || isCS; 

    // Ambil ID user saat komponen dimuat
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getSession();
            setCurrentUserId(user?.id ?? null); 
        };
        fetchUser();
    }, []);

    const { 
        projects, 
        clients, 
        packages, 
        developers, 
        isLoading, 
        createMutation, 
        updateMutation, 
        deleteMutation,
        fetchData
    } = useProjectData();
    
    const developerMap = new Map(developers.map(dev => [dev.id, dev])); 
    const clientOptions = clients;
    const developerOptions = developers; 

    
    // ================== MUTATION TANDAI SELESAI (Developer Action) ==================
    const markAsDoneMutation = useMutation({
        mutationFn: async (projectId: string) => {
            // RLS di Projects table seharusnya membatasi UPDATE hanya untuk developer yang ditugaskan.
            const { error } = await supabase
                .from('projects')
                .update({
                    status: 'selesai',
                    tanggal_selesai: new Date().toISOString().split('T')[0], // Set tanggal hari ini
                })
                .eq('id', projectId);
            if (error) throw error;
        },
        onSuccess: () => {
            fetchData(); // Refresh data untuk memicu RLS dan memperbarui tampilan
            toast({ title: 'Sukses', description: 'Proyek ditandai selesai. Komisi telah dicatat.' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: `Gagal menandai selesai: ${error.message}.`, variant: 'destructive' });
        }
    });

    const handleMarkAsDone = (projectId: string, projectName: string) => {
        if (confirm(`Apakah Anda yakin proyek "${projectName}" sudah selesai? Ini akan mencatat komisi Anda sebagai expense.`)) {
            markAsDoneMutation.mutate(projectId);
        }
    };
    // ====================================================================================

    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFullAccessRole) return; 

        const dataToSave: ProjectInsert = {
            ...formData,
            harga: Number(formData.harga) || 0,
            estimasi_hari: Number(formData.estimasi_hari) || null,
            fee_developer: Number(formData.fee_developer) || 0,
            created_by: currentUserId,
        } as ProjectInsert;

        if (editingProject) {
            updateMutation.mutate({ id: editingProject.id, data: dataToSave });
        } else {
            createMutation.mutate(dataToSave);
        }
        setIsDialogOpen(false);
    };

    const handleEdit = (project: ProjectExtended) => {
        setEditingProject(project);
        setFormData({
            ...project,
            fee_developer: project.fee_developer || 0, 
        });
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string, name: string) => {
        if (!isFullAccessRole) return; 
        if (confirm(`Apakah Anda yakin ingin menghapus proyek ${name}?`)) {
            deleteMutation.mutate(id);
        }
    };
    
    // FILTERING DI JAVASCRIPT HANYA UNTUK PENCARIAN
    const filteredProjects = projects.filter(p => {
        const searchLower = search.toLowerCase();
        
        const projectName = (p.nama_proyek || '').toLowerCase();
        const clientName = (p.clients?.nama || '').toLowerCase();
        
        const searchMatches = projectName.includes(searchLower) || clientName.includes(searchLower);

        return searchMatches;
    });

    const getStatusBadge = (status: string | null) => {
        const statusKey = (status || 'briefing').toLowerCase() as keyof typeof statusColors;
        return <Badge className={statusColors[statusKey] + ' capitalize'}>{status || 'Briefing'}</Badge>;
    }
    
    const canEditProject = (project: ProjectExtended) => {
        return isFullAccessRole || (isDeveloper && project.developer_id === currentUserId);
    };

    // Tampilkan loading saat roles atau proyek sedang dimuat
    if (rolesLoading || isLoading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-muted-foreground">Memuat data proyek dan otorisasi...</p>
                </div>
            </DashboardLayout>
        );
    }


    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Projects Management</h2>
                        <p className="text-muted-foreground">
                            {isDeveloper && !isFullAccessRole ? 
                             'Proyek yang ditugaskan kepada Anda.' : 
                             'Kelola semua proyek dan penugasan developer.'
                            }
                        </p>
                    </div>
                    
                    {/* Dialog Tambah/Edit Proyek (Hanya terlihat oleh Admin/CS) */}
                    {isFullAccessRole && (
                        <Dialog open={isDialogOpen} onOpenChange={(open) => {
                            setIsDialogOpen(open);
                            if (!open) { setEditingProject(null); setFormData(initialFormData); }
                        }}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setFormData(initialFormData)}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add New Project
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>{editingProject ? 'Edit Project' : 'Add New Project'}</DialogTitle>
                                    <DialogDescription>Input detail proyek dan tugaskan developer.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSubmit}>
                                    <div className="grid gap-4 py-4">
                                        
                                        {/* Row 1: Nama, Client, Harga */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="nama_proyek">Project Name *</Label>
                                                <Input 
                                                    id="nama_proyek" 
                                                    required 
                                                    value={formData.nama_proyek || ''}
                                                    onChange={(e) => setFormData({ ...formData, nama_proyek: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="client_id">Client *</Label>
                                                <Select
                                                    value={formData.client_id || ''}
                                                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                                                    required
                                                >
                                                    <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                                                    <SelectContent>
                                                        {clientOptions?.map(c => (
                                                            <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="harga">Project Price (IDR)</Label>
                                                <Input 
                                                    id="harga" 
                                                    type="number"
                                                    value={formData.harga || 0}
                                                    onChange={(e) => setFormData({ ...formData, harga: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Row 2: Status, Developer, Fee Developer */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="status">Status *</Label>
                                                <Select
                                                    value={formData.status || 'briefing'}
                                                    onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.keys(statusColors).map(s => (
                                                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="developer_id">Developer</Label>
                                                <Select
                                                    value={formData.developer_id || ''}
                                                    onValueChange={(value) => setFormData({ ...formData, developer_id: value })}
                                                >
                                                    <SelectTrigger><SelectValue placeholder="Assign Developer" /></SelectTrigger>
                                                    <SelectContent>
                                                        {developerOptions?.map(d => (
                                                            <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="fee_developer">Developer Fee (IDR)</Label>
                                                <Input 
                                                    id="fee_developer" 
                                                    type="number"
                                                    value={formData.fee_developer || 0}
                                                    onChange={(e) => setFormData({ ...formData, fee_developer: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>

                                        {/* Row 3: Ruang Lingkup (Textarea) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="ruang_lingkup">Ruang Lingkup</Label>
                                            <Textarea
                                                id="ruang_lingkup"
                                                value={formData.ruang_lingkup || ''}
                                                onChange={(e) => setFormData({ ...formData, ruang_lingkup: e.target.value })}
                                                rows={3}
                                            />
                                        </div>

                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                            {editingProject ? 'Update Project' : 'Create Project'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {/* Project List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Proyek</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {/* Search bar */}
                        <div className="relative mb-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Cari nama proyek atau klien..." 
                                className="pl-8" 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Proyek</TableHead>
                                        <TableHead>Klien</TableHead>
                                        <TableHead>Developer</TableHead>
                                        <TableHead>Fee Dev</TableHead>
                                        <TableHead>Harga</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProjects.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada proyek yang sesuai.</TableCell></TableRow>
                                    ) : (
                                        filteredProjects.map(project => {
                                            
                                            // LOGIKA UNTUK MENAMPILKAN TOMBOL SELESAI
                                            const isAssignedAndNotDone = 
                                                isDeveloper &&
                                                project.status !== 'selesai' && 
                                                !!project.developer_id && 
                                                (String(project.developer_id).toUpperCase() === String(currentUserId).toUpperCase());

                                            return (
                                                <TableRow key={project.id}>
                                                    <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                    <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                    <TableCell>
                                                        {developerMap.get(project.developer_id)?.full_name || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {project.fee_developer ? formatCurrency(Number(project.fee_developer)) : '-'}
                                                    </TableCell>
                                                    <TableCell>{formatCurrency(Number(project.harga))}</TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(project.status)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            
                                                            {/* TOMBOL TANDAI SELESAI UNTUK DEVELOPER */}
                                                            {isAssignedAndNotDone && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="default" 
                                                                    title="Tandai Selesai"
                                                                    onClick={() => handleMarkAsDone(project.id, project.nama_proyek)}
                                                                    disabled={markAsDoneMutation.isPending}
                                                                >
                                                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Selesai
                                                                </Button>
                                                            )}

                                                            {canEditProject(project) && (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    title="Edit"
                                                                    onClick={() => handleEdit(project)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            
                                                            {isFullAccessRole && (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    title="Hapus"
                                                                    onClick={() => handleDelete(project.id, project.nama_proyek)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
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