import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    PlusCircle,
    Search,
    Pencil,
    Trash2,
    CheckCircle2,
    ListChecks,
    Plus,
    Save,
    Archive,
    ArchiveRestore
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// FIX: Pastikan useToast di-import
import { useToast } from '@/hooks/use-toast'; 
import type { Database } from '@/integrations/supabase/types';
import { useRoles } from '@/hooks/useRoles';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { differenceInDays, parseISO, isValid } from 'date-fns';

// --- Tipe Data ---
type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type UserRole = Database['public']['Enums']['user_role'];
type Client = Database['public']['Tables']['clients']['Row'];
type Package = Database['public']['Tables']['packages']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectChecklist = Database['public']['Tables']['project_checklists']['Row'];
type ProjectChecklistInsert = Database['public']['Tables']['project_checklists']['Insert'];

interface ProjectExtended extends Project {
    clients: { nama: string } | null;
    packages: { nama: string } | null;
    progress: number | null;
    is_archived: boolean;
}

// --- Konstanta & Helper ---
const statusColors = {
    briefing: 'bg-gray-500', desain: 'bg-blue-500', development: 'bg-yellow-500',
    revisi: 'bg-orange-500', launch: 'bg-green-500', selesai: 'bg-emerald-600',
};
const ARCHIVE_THRESHOLD_DAYS = 30;
const initialFormData: Partial<ProjectInsert> = {
    nama_proyek: '', client_id: '', package_id: null, harga: 0, ruang_lingkup: '',
    status: 'briefing', developer_id: null, tanggal_mulai: null, tanggal_selesai: null,
    estimasi_hari: null, fee_developer: 0, progress: 0, is_archived: false,
};
const formatCurrency = (amount: number | null | undefined): string => {
    if (amount == null || isNaN(Number(amount))) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(amount));
};

// ======================= HOOKS DATA & MUTASI =======================
const useProjectData = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: allData, isLoading, error, refetch } = useQuery({
        queryKey: ['projects-page-data'],
        queryFn: async () => {
            try {
                 const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'developer');
                if (roleError) throw new Error(`Fetch Roles Error: ${roleError.message}`);
                const developerIds = roleData.map(r => r.user_id);
                let devsData: Profile[] = [];
                if (developerIds.length > 0) {
                   const { data, error: devsError } = await supabase.from('profiles').select('id, full_name').in('id', developerIds);
                   if (devsError) throw new Error(`Fetch Profiles Error: ${devsError.message}`);
                   devsData = (data ?? []) as Profile[];
                }
                const [projectsRes, clientsRes, packagesRes] = await Promise.all([ supabase.from('projects').select(`*, is_archived, clients(nama), packages(nama)`).order('created_at', { ascending: false }), supabase.from('clients').select('id, nama'), supabase.from('packages').select('id, nama').eq('is_active', true), ]);
                if (projectsRes.error) throw new Error(`Fetch Projects Error: ${projectsRes.error.message}`);
                if (clientsRes.error) throw new Error(`Fetch Clients Error: ${clientsRes.error.message}`);
                if (packagesRes.error) throw new Error(`Fetch Packages Error: ${packagesRes.error.message}`);
                console.log('[useProjectData] Raw Projects from DB:', projectsRes.data);
                const projectsData = (projectsRes.data || []).map(p => ({ ...p, harga: Number(p.harga), fee_developer: p.fee_developer ? Number(p.fee_developer) : null, is_archived: p.is_archived ?? false })) as ProjectExtended[];
                console.log('[useProjectData] Processed Projects Data:', projectsData);
                return { projects: projectsData, clients: (clientsRes.data || []) as Client[], packages: (packagesRes.data || []) as Package[], developers: devsData, };
            } catch (err: any) { console.error("[useProjectData] Fetch Error (inside queryFn catch):", err); toast({ title: 'Gagal Memuat Data', description: err.message || 'Error tidak diketahui.', variant: 'destructive', duration: 7000 }); throw err; }
        },
        retry: 1,
    });
    const createMutation = useMutation({
        mutationFn: async (data: ProjectInsert) => {
            console.log("[Mutation] createMutation - Data:", data);
            if (!data.nama_proyek || !data.client_id) { throw new Error("Nama Proyek dan Klien wajib diisi."); }
            const { data: insertedData, error } = await supabase.from('projects').insert([data]).select().single();
            if (error) { console.error("[Mutation] createMutation - Supabase Error:", error); throw error; }
            console.log("[Mutation] createMutation - Supabase Success:", insertedData); return insertedData;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects-page-data'] }); toast({ title: 'Sukses', description: 'Proyek baru berhasil dibuat.' }); },
        onError: (error: any) => { console.error("[Mutation] createMutation - onError:", error); toast({ title: 'Error Create', description: error.message, variant: 'destructive' }); },
    });
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectInsert> }) => {
            console.log(`[Mutation] updateMutation - ID: ${id}, Data:`, data);
            const { data: updatedData, error } = await supabase.from('projects').update(data).eq('id', id).select().single();
            if (error) { console.error(`[Mutation] updateMutation - Supabase Error (ID: ${id}):`, error); throw error; }
            console.log(`[Mutation] updateMutation - Supabase Success (ID: ${id}):`, updatedData); return updatedData;
        },
         onSuccess: (updatedData, variables) => {
            queryClient.invalidateQueries({ queryKey: ['projects-page-data'] });
            if ('is_archived' in variables.data) { toast({ title: 'Sukses', description: `Proyek ${variables.data.is_archived ? 'diarsipkan' : 'diaktifkan'}.` }); } else { toast({ title: 'Sukses', description: 'Proyek berhasil diperbarui.' }); }
        },
        onError: (error: any, variables) => { console.error(`[Mutation] updateMutation - onError (ID: ${variables.id}):`, error); toast({ title: 'Error Update', description: error.message, variant: 'destructive' }); },
    });
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
             console.log(`[Mutation] deleteMutation - ID: ${id}`);
             const { error: checklistError } = await supabase.from('project_checklists').delete().eq('project_id', id);
             if (checklistError) console.warn("[Mutation] deleteMutation - Could not delete checklists:", checklistError.message);
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) { console.error(`[Mutation] deleteMutation - Supabase Error (ID: ${id}):`, error); throw error; }
             console.log(`[Mutation] deleteMutation - Supabase Success (ID: ${id})`);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects-page-data'] }); toast({ title: 'Project deleted successfully' }); },
        onError: (error: any, variables) => { console.error(`[Mutation] deleteMutation - onError (ID: ${variables}):`, error); toast({ title: 'Error Delete', description: error.message, variant: 'destructive' }); }
    });
    return { projects: allData?.projects ?? [], clients: allData?.clients ?? [], packages: allData?.packages ?? [], developers: allData?.developers ?? [], isLoading, isError: !!error, error, createMutation, updateMutation, deleteMutation, refetchData: refetch };
};

const useChecklistData = (projectId: string | null) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: checklists, isLoading: isLoadingChecklists } = useQuery({
        queryKey: ['project-checklists', projectId],
        queryFn: async () => {
             if (!projectId) return [];
            const { data, error } = await supabase.from('project_checklists').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
            if (error) throw error;
            return data as ProjectChecklist[];
        },
        enabled: !!projectId,
    });
    const invalidateChecklistAndProject = () => { queryClient.invalidateQueries({ queryKey: ['project-checklists', projectId] }); queryClient.invalidateQueries({ queryKey: ['projects-page-data'] }); };
    const addChecklistMutation = useMutation({ mutationFn: async (newItem: ProjectChecklistInsert) => { const { data: { user } } = await supabase.auth.getUser(); const { error } = await supabase.from('project_checklists').insert({...newItem, updated_by: user?.id}); if (error) throw error; }, onSuccess: () => { invalidateChecklistAndProject(); toast({ title: 'Checklist item added.' }); }, onError: (error: any) => toast({ title: 'Error', description: `Failed to add item: ${error.message}`, variant: 'destructive' }) });
    const updateChecklistMutation = useMutation({ mutationFn: async ({ id, is_done }: { id: string, is_done: boolean }) => { const { data: { user } } = await supabase.auth.getUser(); const { error } = await supabase.from('project_checklists').update({ is_done, updated_by: user?.id }).eq('id', id); if (error) throw error; }, onSuccess: () => invalidateChecklistAndProject(), onError: (error: any) => toast({ title: 'Error', description: `Failed to update item: ${error.message}`, variant: 'destructive' }) });
    const deleteChecklistMutation = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from('project_checklists').delete().eq('id', id); if (error) throw error; }, onSuccess: () => { invalidateChecklistAndProject(); toast({ title: 'Checklist item removed.' }); }, onError: (error: any) => toast({ title: 'Error', description: `Failed to remove item: ${error.message}`, variant: 'destructive' }) });
    return { checklists: checklists ?? [], isLoadingChecklists, addChecklistMutation, updateChecklistMutation, deleteChecklistMutation };
};

// --- Komponen ChecklistDialog ---
interface ChecklistDialogProps { project: ProjectExtended | null; isOpen: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; }
const ChecklistDialog: React.FC<ChecklistDialogProps> = ({ project, isOpen, onOpenChange, canManage }) => {
     const { toast } = useToast(); const [newItemTitle, setNewItemTitle] = useState(''); const { checklists, isLoadingChecklists, addChecklistMutation, updateChecklistMutation, deleteChecklistMutation } = useChecklistData(project?.id ?? null); const handleAddItem = (e: React.FormEvent) => { e.preventDefault(); if (!newItemTitle.trim() || !project?.id) return; addChecklistMutation.mutate({ project_id: project.id, title: newItemTitle.trim(), is_done: false }, { onSuccess: () => setNewItemTitle('') }); }; const handleToggleDone = (item: ProjectChecklist) => updateChecklistMutation.mutate({ id: item.id, is_done: !item.is_done }); const handleDeleteItem = (id: string) => { if (confirm('Hapus item?')) deleteChecklistMutation.mutate(id); }; return ( <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent className="max-w-xl max-h-[80vh] flex flex-col"><DialogHeader><DialogTitle>Project Checklist: {project?.nama_proyek}</DialogTitle><DialogDescription>Kelola daftar tugas. Progress: {project?.progress ?? 0}%</DialogDescription><Progress value={project?.progress ?? 0} className="w-full h-2 mt-2" /></DialogHeader><div className="flex-1 overflow-y-auto pr-2 space-y-3 py-4">{isLoadingChecklists ? ( <p className="text-muted-foreground text-center">Memuat...</p> ) : checklists.length === 0 && !canManage ? ( <p className="text-muted-foreground text-center">Belum ada checklist.</p> ) : (checklists.map((item) => ( <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50"><Checkbox id={`check-${item.id}`} checked={item.is_done} onCheckedChange={() => handleToggleDone(item)} disabled={!canManage || updateChecklistMutation.isPending} /><label htmlFor={`check-${item.id}`} className={`flex-1 text-sm ${item.is_done ? 'line-through text-muted-foreground' : ''} ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>{item.title}</label>{canManage && ( <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteItem(item.id)} disabled={deleteChecklistMutation.isPending} title="Hapus"><Trash2 className="h-3 w-3 text-destructive" /></Button> )}</div> )))} {checklists.length === 0 && canManage && ( <p className="text-muted-foreground text-center">Belum ada checklist. Tambahkan di bawah.</p> )}</div>{canManage && ( <form onSubmit={handleAddItem} className="flex gap-2 pt-4 border-t"><Input placeholder="Item baru..." value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} required disabled={addChecklistMutation.isPending} /><Button type="submit" size="icon" disabled={addChecklistMutation.isPending || !newItemTitle.trim()}> <Plus className="h-4 w-4" /> </Button></form> )}<DialogFooter> <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button> </DialogFooter></DialogContent></Dialog> );
};


// ======================= KOMPONEN UTAMA PROJECTS =======================
export default function Projects() {
    // FIX: Panggil useToast di level atas komponen
    const { toast } = useToast();
    const { roles, isLoading: rolesLoading } = useRoles();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ProjectInsert>>(initialFormData);
    const [editingProject, setEditingProject] = useState<ProjectExtended | null>(null);
    const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
    const [selectedProjectForChecklist, setSelectedProjectForChecklist] = useState<ProjectExtended | null>(null);
    const [activeTab, setActiveTab] = useState<'aktif' | 'arsip'>('aktif');

    const isAdmin = roles.includes('admin');
    const isCS = roles.includes('cs');
    const isDeveloper = roles.includes('developer');
    const isFullAccessRole = isAdmin || isCS;

    useEffect(() => {
        const fetchUser = async () => {
             const { data: { user } } = await supabase.auth.getUser();
             setCurrentUserId(user?.id ?? null);
             console.log('[useEffect] Fetched User ID:', user?.id);
        };
        fetchUser();
     }, []);

    const { projects, clients, packages, developers, isLoading, isError, error: dataError, createMutation, updateMutation, deleteMutation, refetchData } = useProjectData();

    const developerMap = new Map(developers.map(dev => [dev.id, dev.full_name]));
    const clientOptions = clients;
    const developerOptions = developers;

    const markAsDoneMutation = useMutation({
        mutationFn: async (projectId: string) => {
            console.log(`[Mutation] markAsDoneMutation - ID: ${projectId}`);
            const projectToUpdate = projects.find(p => p.id === projectId);
            if (!projectToUpdate) throw new Error("Proyek tidak ditemukan.");
            if (!isAdmin && !isCS && currentUserId !== projectToUpdate.developer_id) {
                 console.warn(`[Mutation] markAsDoneMutation - Access Denied. Current: ${currentUserId}, Expected: ${projectToUpdate.developer_id}`);
                throw new Error("Akses ditolak.");
            }
            const { error } = await supabase.from('projects').update({ status: 'selesai', tanggal_selesai: new Date().toISOString().split('T')[0] }).eq('id', projectId);
            if (error) { console.error(`[Mutation] markAsDoneMutation - Supabase Error (ID: ${projectId}):`, error); throw error; }
            console.log(`[Mutation] markAsDoneMutation - Supabase Success (ID: ${projectId})`);
        },
        onSuccess: () => { refetchData(); toast({ title: 'Sukses', description: 'Proyek ditandai selesai.' }); },
        onError: (error: any) => { console.error(`[Mutation] markAsDoneMutation - onError:`, error); toast({ title: 'Error', description: `Gagal: ${error.message}.`, variant: 'destructive' }); },
    });


    // --- HANDLERS ---
    const handleMarkAsDone = (projectId: string, projectName: string) => {
        try {
            console.log(`[Handler] handleMarkAsDone - ID: ${projectId}, Name: ${projectName}`);
            const project = projects.find(p => p.id === projectId);
            if (!project) { console.error("handleMarkAsDone - Project not found!"); return; }
            if (!isAdmin && !isCS && project.developer_id !== currentUserId) {
                console.warn("handleMarkAsDone - Access Denied");
                toast({ title: 'Akses Ditolak', description: 'Hanya developer yang ditugaskan atau Admin/CS.', variant: 'destructive'});
                return;
            }
            if (confirm(`Yakin proyek "${projectName}" selesai?`)) {
                markAsDoneMutation.mutate(projectId);
            }
        } catch (err: any) { console.error("[Handler Error] handleMarkAsDone:", err); toast({ title: 'Error Internal', description: `Terjadi kesalahan: ${err.message}`, variant: 'destructive' }); }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('[Handler] handleSubmit triggered');
        if (!isFullAccessRole) { console.warn('[Handler] handleSubmit blocked: Not full access role'); toast({ title: "Akses Ditolak", variant: "destructive"}); return; }

        // --- VALIDASI FRONTEND ---
        // Baca nilai TERKINI dari state formData saat submit
        const currentFormData = { ...formData }; // Salin state saat ini
        const namaProyekTrimmed = currentFormData.nama_proyek?.trim();
        const clientIdSelected = currentFormData.client_id;
        
        console.log(`[Handler] handleSubmit - Validating: Nama='${namaProyekTrimmed}', Client='${clientIdSelected}'`);

        if (!namaProyekTrimmed || !clientIdSelected) {
            toast({ title: "Input Tidak Lengkap", description: "Nama Proyek dan Klien wajib diisi.", variant: "destructive"});
            console.warn('[Handler] handleSubmit - Validation failed.');
            return; // Hentikan jika validasi gagal
        }
        // --- END VALIDASI ---

        // Siapkan data *setelah* validasi, gunakan currentFormData
        const dataToSave: Partial<ProjectInsert> = {
            nama_proyek: namaProyekTrimmed, // Gunakan nilai yang sudah di-trim
            client_id: clientIdSelected,
            package_id: currentFormData.package_id || null,
            harga: Number(currentFormData.harga) || 0,
            ruang_lingkup: currentFormData.ruang_lingkup?.trim() || null, // Trim juga
            status: currentFormData.status || 'briefing',
            developer_id: currentFormData.developer_id || null,
            tanggal_mulai: currentFormData.tanggal_mulai || null,
            tanggal_selesai: currentFormData.tanggal_selesai || null,
            estimasi_hari: Number(currentFormData.estimasi_hari) || null,
            fee_developer: Number(currentFormData.fee_developer) || 0,
            // progress & is_archived tidak di-set di sini
        };

        console.log('[Handler] handleSubmit - Data to Save (post-validation):', dataToSave);

        try {
            if (editingProject?.id) {
                console.log('[Handler] handleSubmit - Calling updateMutation...');
                updateMutation.mutate({ id: editingProject.id, data: dataToSave }, {
                    onSuccess: () => { setIsProjectDialogOpen(false); }
                 });
            } else {
                console.log('[Handler] handleSubmit - Calling createMutation...');
                // Pastikan tidak ada ID saat insert
                const { id, ...insertData } = dataToSave;
                createMutation.mutate(insertData as ProjectInsert, {
                    onSuccess: () => { setIsProjectDialogOpen(false); }
                 });
            }
        } catch (err: any) {
             console.error("[Handler Error] handleSubmit during mutation call:", err);
            toast({ title: 'Error Internal', description: `Terjadi kesalahan saat menyimpan: ${err.message}`, variant: 'destructive' });
        }
    };

    const handleEdit = (project: ProjectExtended) => {
        try {
            console.log("[Handler] handleEdit triggered for project:", project?.id);
            if (!project) { console.error("[Handler Error] handleEdit: Project data is missing!"); return; }
            setEditingProject(project); // Simpan seluruh objek project
            // Isi state formData dari object project
            setFormData({
                id: project.id, nama_proyek: project.nama_proyek, client_id: project.client_id, package_id: project.package_id,
                harga: Number(project.harga), ruang_lingkup: project.ruang_lingkup, status: project.status, developer_id: project.developer_id,
                tanggal_mulai: project.tanggal_mulai, tanggal_selesai: project.tanggal_selesai, estimasi_hari: project.estimasi_hari,
                fee_developer: project.fee_developer ? Number(project.fee_developer) : 0, progress: project.progress, is_archived: project.is_archived
            });
            setIsProjectDialogOpen(true); // Buka dialog
        } catch (err: any) { console.error("[Handler Error] handleEdit:", err); toast({ title: 'Error Internal', variant: 'destructive' }); }
    };

    const handleDelete = (id: string, name: string) => {
        try {
             console.log(`[Handler] handleDelete triggered - ID: ${id}, Name: ${name}`);
            if (!isFullAccessRole) { console.warn("[Handler] handleDelete blocked: Not full access role"); toast({ title: "Akses Ditolak", variant: "destructive"}); return; }
            if (confirm(`Hapus proyek "${name}"? Ini akan menghapus semua checklist terkait juga.`)) {
                deleteMutation.mutate(id); // Panggil mutate dengan ID
            }
        } catch (err: any) { console.error("[Handler Error] handleDelete:", err); toast({ title: 'Error Internal', variant: 'destructive' }); }
    };

    const openChecklistDialog = (project: ProjectExtended) => {
        try {
            console.log("[Handler] openChecklistDialog triggered for project:", project?.id);
            if (!project) { console.error("[Handler Error] openChecklistDialog: Project data is missing!"); return; }
            setSelectedProjectForChecklist(project); // Set project yg dipilih
            setIsChecklistDialogOpen(true); // Buka dialog checklist
        } catch (err: any) { console.error("[Handler Error] openChecklistDialog:", err); toast({ title: 'Error Internal', variant: 'destructive' }); }
    };

    const handleArchiveToggle = (project: ProjectExtended) => {
        try {
            console.log("[Handler] handleArchiveToggle triggered for project:", project?.id);
            if (!isFullAccessRole) { console.warn("[Handler] handleArchiveToggle blocked: Not full access role"); toast({ title: 'Akses Ditolak', variant: 'destructive' }); return; }
             if (!project) { console.error("[Handler Error] handleArchiveToggle: Project data is missing!"); return; }
            const newArchivedStatus = !project.is_archived;
            const action = newArchivedStatus ? 'mengarsipkan' : 'mengaktifkan kembali';
            if (confirm(`Yakin ${action} "${project.nama_proyek}"?`)) {
                updateMutation.mutate({ id: project.id, data: { is_archived: newArchivedStatus } }); // Panggil mutate update
            }
        } catch (err: any) { const actionText = project?.is_archived ? 'mengaktifkan kembali' : 'mengarsipkan'; console.error(`[Handler Error] handleArchiveToggle (${actionText}):`, err); toast({ title: 'Error Internal', description: `Gagal ${actionText}: ${err.message}`, variant: 'destructive' }); }
    };
    // --- END HANDLERS ---

    const canManageChecklist = (project: ProjectExtended | null): boolean => {
        if (!project) return false;
        return isFullAccessRole || (isDeveloper && project.developer_id === currentUserId);
    };

    // --- FILTER LOGIC (Kembalikan logika tanggal) ---
     const filteredProjects = projects.filter(p => {
        // ... (Logika filter sama seperti sebelumnya, pastikan log aktif jika perlu) ...
        const searchLower = search.toLowerCase();
        const searchMatches = (p.nama_proyek || '').toLowerCase().includes(searchLower) || (p.clients?.nama || '').toLowerCase().includes(searchLower);
        if (!searchMatches) return false;
        const isCompleted = p.status === 'selesai';
        let isOlderThanThreshold = false;
        if (isCompleted && p.tanggal_selesai) { try { const d = parseISO(p.tanggal_selesai); if (isValid(d)) { isOlderThanThreshold = differenceInDays(new Date(), d) > ARCHIVE_THRESHOLD_DAYS; } } catch (e) {} }
        const isManuallyArchived = p.is_archived === true;
        const shouldBeInArchive = isManuallyArchived || (isCompleted && isOlderThanThreshold);
        return activeTab === 'aktif' ? !shouldBeInArchive : shouldBeInArchive;
    });
    // --- END FILTER LOGIC ---

    const getStatusBadge = (status: Project['status']) => {
         const statusKey = (status || 'briefing').toLowerCase() as keyof typeof statusColors;
         const displayStatus = (status?.replace('_', ' ') || 'Briefing');
         return <Badge className={`${statusColors[statusKey]} capitalize text-white hover:${statusColors[statusKey]}`}>{displayStatus}</Badge>;
    };
    const canEditDeleteProject = (project: ProjectExtended) => isFullAccessRole;

    // FIX: Perbaiki kondisional loading roles
    if (rolesLoading) {
        return (
            <DashboardLayout>
                <div className="flex min-h-screen items-center justify-center">
                    <p className="text-muted-foreground">Memuat peran pengguna...</p>
                </div>
            </DashboardLayout>
         );
    }
    // Loading data proyek (isLoading) ditangani di JSX Tabel

    console.log('[Render] Final Filtered Projects:', filteredProjects);
    // --- TAMBAHAN LOG DEBUGGING TOMBOL DEVELOPER ---
    if (isDeveloper) {
        console.log(`[Debug Dev Button] Role 'isDeveloper' = true. currentUserId = ${currentUserId}`);
        projects.forEach(p => {
             console.log(`[Debug Dev Button] Project: ${p.nama_proyek}, project.developer_id: ${p.developer_id}, Match: ${p.developer_id === currentUserId}`);
        });
    }
    // --- END LOG ---


    // --- JSX Utama dengan Tabs ---
    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                 {/* Header & Tombol Tambah Proyek */}
                 <div className="flex items-center justify-between">
                     <div> <h2 className="text-3xl font-bold tracking-tight">Manajemen Proyek</h2> <p className="text-muted-foreground">Kelola semua proyek dan progres pengerjaan.</p> </div>
                     {isFullAccessRole && (
                        <Dialog open={isProjectDialogOpen} onOpenChange={(open) => { setIsProjectDialogOpen(open); if (!open) { setEditingProject(null); setFormData(initialFormData); } }}>
                            <DialogTrigger asChild>
                                <Button onClick={() => { console.log('[Click] Tambah Proyek button'); setFormData(initialFormData); }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Tambah Proyek Baru
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="max-w-3xl">
                                <DialogHeader> <DialogTitle>{editingProject ? 'Edit Proyek' : 'Tambah Proyek Baru'}</DialogTitle> <DialogDescription>Input detail proyek.</DialogDescription> </DialogHeader>
                                <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto pr-4">
                                    <div className="grid gap-4 py-4">
                                        {/* Rows... (Form fields sama) */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> <div className="space-y-2"> <Label htmlFor="nama_proyek">Nama Proyek *</Label> <Input id="nama_proyek" required value={formData.nama_proyek || ''} onChange={(e) => setFormData({ ...formData, nama_proyek: e.target.value })} /> </div> <div className="space-y-2"> <Label htmlFor="client_id">Klien *</Label> <Select value={formData.client_id || undefined} onValueChange={(value) => setFormData({ ...formData, client_id: value })} required> <SelectTrigger><SelectValue placeholder="Pilih Klien" /></SelectTrigger> <SelectContent> {clientOptions?.map(c => ( <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem> ))} </SelectContent> </Select> </div> <div className="space-y-2"> <Label htmlFor="harga">Harga Proyek (Rp)</Label> <Input id="harga" type="number" value={formData.harga || 0} onChange={(e) => setFormData({ ...formData, harga: Number(e.target.value) })} /> </div> </div> <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> <div className="space-y-2"> <Label htmlFor="status">Status *</Label> <Select value={formData.status || 'briefing'} onValueChange={(value) => setFormData({ ...formData, status: value as any })}> <SelectTrigger><SelectValue /></SelectTrigger> <SelectContent> {['briefing', 'desain', 'development', 'revisi', 'launch', 'selesai'].map(s => ( <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem> ))} </SelectContent> </Select> </div> <div className="space-y-2"> <Label htmlFor="developer_id">Developer</Label> <Select value={formData.developer_id ?? undefined} onValueChange={(value) => setFormData({ ...formData, developer_id: value || null })} > <SelectTrigger> <SelectValue placeholder="Pilih Developer" /> </SelectTrigger> <SelectContent> {developerOptions?.map(d => ( <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem> ))} </SelectContent> </Select> </div> <div className="space-y-2"> <Label htmlFor="fee_developer">Fee Developer (Rp)</Label> <Input id="fee_developer" type="number" value={formData.fee_developer || 0} onChange={(e) => setFormData({ ...formData, fee_developer: Number(e.target.value) })} /> </div> </div> <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> <div className="space-y-2"> <Label htmlFor="tanggal_mulai">Tanggal Mulai</Label> <Input id="tanggal_mulai" type="date" value={formData.tanggal_mulai || ''} onChange={(e) => setFormData({ ...formData, tanggal_mulai: e.target.value || null })}/> </div> <div className="space-y-2"> <Label htmlFor="estimasi_hari">Estimasi Hari</Label> <Input id="estimasi_hari" type="number" value={formData.estimasi_hari || ''} onChange={(e) => setFormData({ ...formData, estimasi_hari: Number(e.target.value) || null })} placeholder="Contoh: 14" /> </div> </div> <div className="space-y-2"> <Label htmlFor="ruang_lingkup">Ruang Lingkup</Label> <Textarea id="ruang_lingkup" value={formData.ruang_lingkup || ''} onChange={(e) => setFormData({ ...formData, ruang_lingkup: e.target.value })} rows={3} /> </div>
                                    </div>
                                    <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t"> <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(false)}>Batal</Button> <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}> <Save className="h-4 w-4 mr-2" /> {editingProject ? 'Simpan' : 'Buat'} </Button> </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                 {/* FIX: Tampilkan pesan error jika fetch gagal */}
                 {isError && (
                    <div className="p-4 mb-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
                        Gagal memuat data proyek: {dataError?.message || 'Error tidak diketahui'}. Beberapa fitur mungkin tidak berfungsi. Coba refresh halaman.
                    </div>
                 )}

                 {/* Tabs dan Konten */}
                 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'aktif' | 'arsip')}>
                     {/* ... (Tab Header) ... */}
                     <div className="flex justify-between items-center mb-4"> <TabsList> <TabsTrigger value="aktif">Proyek Aktif</TabsTrigger> <TabsTrigger value="arsip">Arsip Proyek</TabsTrigger> </TabsList> <div className="relative w-full max-w-sm"> <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> <Input placeholder="Cari..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /> </div> </div>

                    {/* Konten Tab Aktif */}
                    <TabsContent value="aktif">
                        <Card>
                            <CardHeader><CardTitle>Proyek Aktif ({filteredProjects.length})</CardTitle></CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="min-w-[200px]">Proyek</TableHead><TableHead>Klien</TableHead><TableHead>Developer</TableHead><TableHead className="min-w-[120px]">Progress</TableHead><TableHead>Status</TableHead><TableHead className="text-right min-w-[150px]">Aksi</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {/* FIX: Kondisional di TableBody diperbaiki */}
                                            {isLoading ? (
                                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
                                            ) : isError ? (
                                                 <TableRow><TableCell colSpan={6} className="text-center py-8 text-destructive">Gagal memuat data.</TableCell></TableRow>
                                            ) : projects.length === 0 ? (
                                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada proyek.</TableCell></TableRow>
                                            ) : filteredProjects.length === 0 ? (
                                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada proyek aktif yang cocok.</TableCell></TableRow>
                                            ) : (
                                                filteredProjects.map(project => {
                                                    const isAssignedToCurrentUser = isDeveloper && project.developer_id === currentUserId;
                                                    return (
                                                        <TableRow key={project.id}>
                                                            <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                            <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                            <TableCell>{developerMap.get(project.developer_id) || '-'}</TableCell>
                                                            <TableCell><div className="flex items-center gap-2"><Progress value={project.progress ?? 0} className="w-20 h-2" /><span className="text-xs text-muted-foreground">{project.progress ?? 0}%</span></div></TableCell>
                                                            <TableCell>{getStatusBadge(project.status)}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button size="icon" variant="ghost" title="Checklist" onClick={() => openChecklistDialog(project)} className="h-8 w-8"><ListChecks className="h-4 w-4" /></Button>
                                                                    {/* FIX: Perbaiki logika render tombol Selesai */}
                                                                    {(isAssignedToCurrentUser || isFullAccessRole) && project.status !== 'selesai' && (
                                                                        <Button size="icon" variant="ghost" title="Tandai Selesai" onClick={() => handleMarkAsDone(project.id, project.nama_proyek)} disabled={markAsDoneMutation.isPending} className="h-8 w-8 text-green-600 hover:bg-green-100">
                                                                            <CheckCircle2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                    {isFullAccessRole && (<Button size="icon" variant="ghost" title="Arsipkan" onClick={() => handleArchiveToggle(project)} disabled={updateMutation.isPending} className="h-8 w-8 text-gray-500 hover:bg-gray-100"><Archive className="h-4 w-4" /></Button>)}
                                                                    {isFullAccessRole && (<Button size="icon" variant="ghost" title="Edit" onClick={() => handleEdit(project)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>)}
                                                                    {isFullAccessRole && (<Button size="icon" variant="ghost" title="Hapus" onClick={() => handleDelete(project.id, project.nama_proyek)} disabled={deleteMutation.isPending} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>)}
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
                    </TabsContent>

                    {/* Konten Tab Arsip */}
                    <TabsContent value="arsip">
                         <Card>
                            <CardHeader>
                                <CardTitle>Arsip Proyek ({filteredProjects.length})</CardTitle>
                                <CardDescription>Selesai {' '}{'>'}{' '} {ARCHIVE_THRESHOLD_DAYS} hari atau diarsip manual.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="min-w-[200px]">Proyek</TableHead><TableHead>Klien</TableHead><TableHead>Tgl Selesai</TableHead><TableHead>Status Arsip</TableHead><TableHead className="text-right min-w-[150px]">Aksi</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                             {/* FIX: Kondisional di TableBody diperbaiki */}
                                             {isLoading ? (
                                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
                                             ) : isError ? (
                                                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-destructive">Gagal memuat data.</TableCell></TableRow>
                                             ) : projects.length === 0 ? (
                                                 <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada proyek.</TableCell></TableRow>
                                             ) : filteredProjects.length === 0 ? (
                                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada proyek di arsip yang cocok.</TableCell></TableRow>
                                             ) : (
                                                filteredProjects.map(project => (
                                                    <TableRow key={project.id} className="opacity-70 hover:opacity-100">
                                                        <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                        <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                        <TableCell>{project.tanggal_selesai ? new Date(project.tanggal_selesai).toLocaleDateString('id-ID') : '-'}</TableCell>
                                                        <TableCell><Badge variant={project.is_archived ? "secondary" : "outline"}>{project.is_archived ? "Manual" : "Otomatis"}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button size="icon" variant="ghost" title="Checklist" onClick={() => openChecklistDialog(project)} className="h-8 w-8"><ListChecks className="h-4 w-4" /></Button>
                                                                {isFullAccessRole && project.is_archived && (<Button size="icon" variant="ghost" title="Aktifkan Kembali" onClick={() => handleArchiveToggle(project)} disabled={updateMutation.isPending} className="h-8 w-8 text-blue-600 hover:bg-blue-100"><ArchiveRestore className="h-4 w-4" /></Button>)}
                                                                {isFullAccessRole && (<Button size="icon" variant="ghost" title="Hapus Permanen" onClick={() => handleDelete(project.id, project.nama_proyek)} disabled={deleteMutation.isPending} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>)}
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
                    </TabsContent>
                </Tabs>

                {/* Instance Checklist Dialog */}
                <ChecklistDialog project={selectedProjectForChecklist} isOpen={isChecklistDialogOpen} onOpenChange={setIsChecklistDialogOpen} canManage={canManageChecklist(selectedProjectForChecklist)} />
            </div>
        </DashboardLayout>
    );
}