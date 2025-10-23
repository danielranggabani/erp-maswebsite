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
import { PlusCircle, Search, Pencil, Trash2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
// ASUMSI: Anda memiliki hook untuk mengambil role user
import { useRoles } from '@/hooks/useRoles'; 

// ======================= TIPE DATA =======================
type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type UserRole = Database['public']['Enums']['user_role']; 

// Tipe Data Gabungan untuk Project (dengan Client dan Developer)
interface ProjectExtended extends Project {
    clients: { nama: string } | null;
    developers: { full_name: string } | null;
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

const useProjectData = (currentUserId: string | null) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Query utama proyek (Mengambil semua karena RLS diatur longgar/dihapus)
    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects', 'all'], // Query key disederhanakan
        queryFn: async () => {
            // Mengambil SEMUA PROYEK. Filtering akan dilakukan di sisi Client.
            const { data, error } = await supabase
                .from('projects')
                .select(`
                    *,
                    clients(nama),
                    developers:developer_id(full_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as ProjectExtended[];
        },
        enabled: !!currentUserId,
        onError: (error) => {
            toast({ title: "Error", description: "Gagal memuat data proyek.", variant: "destructive" });
        }
    });

    // Mutasi CRUD (tetap sama)
    const createMutation = useMutation({
        mutationFn: async (data: ProjectInsert) => {
            const { error } = await supabase.from('projects').insert([data]);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', 'all'] }),
        onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectInsert> }) => {
            const { error } = await supabase.from('projects').update(data).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', 'all'] }),
        onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', 'all'] }),
        onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    });

    return { projects, isLoading, createMutation, updateMutation, deleteMutation };
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
    // 1. Dapatkan Role dan User ID dari Hooks/State
    const { roles, isLoading: rolesLoading } = useRoles();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ProjectInsert>>(initialFormData);
    const [editingProject, setEditingProject] = useState<ProjectExtended | null>(null);
    
    // Penentuan Akses
    const isAdmin = roles.includes('admin');
    const isCS = roles.includes('cs');
    const isDeveloper = roles.includes('developer');
    const isFullAccessRole = isAdmin || isCS; 

    // Ambil ID user yang sedang login saat komponen mount
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getSession();
            if (user) {
                setCurrentUserId(user.id);
            }
        };
        fetchUser();
    }, []);

    const { projects, isLoading, createMutation, updateMutation, deleteMutation } = useProjectData(currentUserId);

    // Fetch data tambahan (Clients dan Developers) untuk dropdown formulir
    const { data: clients } = useQuery({
        queryKey: ['clients-list'],
        queryFn: async () => {
            const { data, error } = await supabase.from('clients').select('id, nama');
            if (error) throw error;
            return data;
        },
        enabled: isFullAccessRole,
    });

    const { data: developers } = useQuery({
        queryKey: ['developers-list'],
        queryFn: async () => {
            const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'developer');
            if (roleError) throw roleError;
            const developerIds = roleData.map(r => r.user_id);

            const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, full_name');
            if (profileError) throw profileError;
            
            return profileData.filter(p => developerIds.includes(p.id));
        },
        enabled: isFullAccessRole,
    });
    // ... (logic untuk packages)

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
    
    // 2. FILTERING SISI CLIENT (JAVASCRIPT)
    const filteredProjects = projects?.filter(p => {
        const searchMatch = p.nama_proyek?.toLowerCase().includes(search.toLowerCase()) ||
                            p.clients?.nama?.toLowerCase().includes(search.toLowerCase());

        // Jika user adalah Admin/CS, tampilkan semua proyek.
        if (isFullAccessRole) {
            return searchMatch;
        } 
        
        // Jika user adalah Developer, tampilkan hanya proyek yang ditugaskan kepadanya.
        if (isDeveloper && p.developer_id === currentUserId) {
            return searchMatch;
        }

        // Jika tidak ada role/tidak ditugaskan, jangan tampilkan.
        return false;
    });

    const getStatusBadge = (status: string | null) => {
        const statusKey = (status || 'briefing').toLowerCase() as keyof typeof statusColors;
        return <Badge className={statusColors[statusKey] + ' capitalize'}>{status || 'Briefing'}</Badge>;
    }
    
    const canEditProject = (project: ProjectExtended) => {
        // Admin/CS bisa edit semua. Developer hanya bisa update Status & Note (Logic di DB)
        // Di sini kita hanya izinkan tombol edit muncul jika dia Admin/CS atau Developer yang ditugaskan
        return isFullAccessRole || (isDeveloper && project.developer_id === currentUserId);
    };

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
                                                        {clients?.map(c => (
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
                                                        {developers?.map(d => (
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
                                    {(isLoading || rolesLoading) ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat data...</TableCell></TableRow>
                                    ) : filteredProjects?.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada proyek yang sesuai.</TableCell></TableRow>
                                    ) : (
                                        filteredProjects?.map(project => (
                                            <TableRow key={project.id}>
                                                <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                <TableCell>
                                                    {project.developers?.full_name || '-'}
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
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        )}
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