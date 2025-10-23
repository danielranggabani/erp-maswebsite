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
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
DialogTrigger,
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
import { PlusCircle, Search, Pencil, Trash2, MessageCircle, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { Separator } from '@/components/ui/separator';

// Definisikan Tipe Data dari Supabase (PASTIKAN DATABASE ANDA SUDAH ADA KOLOM ALAMAT)
type Client = Database['public']['Tables']['clients']['Row'] & { alamat: string | null };
type ClientInsert = Database['public']['Tables']['clients']['Insert'] & { alamat: string | null };
type Communication = Database['public']['Tables']['communications']['Row'];
type CommunicationInsert = Database['public']['Tables']['communications']['Insert'];

const statusColors = {
prospek: 'bg-blue-500',
negosiasi: 'bg-yellow-500',
deal: 'bg-green-500',
aktif: 'bg-emerald-500',
selesai: 'bg-gray-500',
};

const initialClientFormData: Partial<ClientInsert> = {
nama: '',
email: '',
phone: '',
whatsapp: '',
bisnis: '',
status: 'prospek',
catatan: '',
renewal_date: null,
alamat: null, // <--- KOLOM ALAMAT DITAMBAHKAN
}

// ======================= HOOKS UNTUK RIWAYAT KOMUNIKASI =======================
const useCommunicationMutations = (clientId: string | null) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['client-communications', clientId] });
    
    const createCommunicationMutation = useMutation({
        mutationFn: async (data: CommunicationInsert) => {
            const { error } = await supabase.from('communications').insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            invalidate();
            toast({ title: 'Komunikasi berhasil ditambahkan' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    return { createCommunicationMutation };
}

// ======================= KOMPONEN UTAMA CLIENTS =======================
export default function Clients() {
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [clientFormData, setClientFormData] = useState<Partial<ClientInsert>>(initialClientFormData);

    // Communication History State
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
    const [newCommunication, setNewCommunication] = useState<Partial<CommunicationInsert>>({
        subject: '',
        notes: '',
        follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), 
    });

    // Query Utama untuk Data Klien
    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            // SELECT * KINI MENGAMBIL KOLOM ALAMAT JIKA SUDAH DIBUAT DI DB
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data as Client[];
        },
        onError: (error) => {
            console.error("Client Fetch Error:", error);
            toast({ title: "Error", description: "Gagal memuat data klien (Cek RLS).", variant: "destructive" });
        }
    });
    
    // Query untuk Riwayat Komunikasi Klien yang dipilih
    const { data: communications = [], isLoading: isLoadingCommunications } = useQuery({
        queryKey: ['client-communications', selectedClientForHistory?.id],
        queryFn: async () => {
            if (!selectedClientForHistory?.id) return [];
            const { data, error } = await supabase
                .from('communications')
                .select('*')
                .eq('client_id', selectedClientForHistory.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as Communication[];
        },
        enabled: !!selectedClientForHistory?.id && isHistoryDialogOpen,
    });

    const { createCommunicationMutation } = useCommunicationMutations(selectedClientForHistory?.id || null);


    // --- MUTASI UTAMA CLIENTS ---
    const createMutation = useMutation({
        mutationFn: async (data: ClientInsert) => {
            const { error } = await supabase.from('clients').insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Client created successfully' });
            setIsDialogOpen(false);
            resetClientForm();
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ClientInsert> }) => {
            const { error } = await supabase.from('clients').update(data).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Client updated successfully' });
            setIsDialogOpen(false);
            resetClientForm();
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Client deleted successfully' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });
    
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingClient) {
            updateMutation.mutate({ id: editingClient.id, data: clientFormData });
        } else {
            createMutation.mutate(clientFormData as ClientInsert);
        }
    };

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setClientFormData({
            nama: client.nama,
            email: client.email,
            phone: client.phone,
            whatsapp: client.whatsapp,
            bisnis: client.bisnis,
            status: client.status,
            catatan: client.catatan,
            renewal_date: client.renewal_date || '',
            alamat: client.alamat, // <--- AMBIL DATA ALAMAT UNTUK EDIT
        });
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this client?')) {
            deleteMutation.mutate(id);
        }
    };

    const resetClientForm = () => {
        setClientFormData(initialClientFormData);
        setEditingClient(null);
    };
    
    // --- COMMUNICATION HISTORY HANDLERS ---
    const openHistoryDialog = (client: Client) => {
        setSelectedClientForHistory(client);
        setIsHistoryDialogOpen(true);
        resetCommunicationForm();
    }
    
    const resetCommunicationForm = () => {
        setNewCommunication({
            subject: '',
            notes: '',
            follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), 
        });
    }
    
    const handleAddCommunication = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientForHistory?.id || !newCommunication.notes) {
            toast({ title: 'Error', description: 'Catatan harus diisi.', variant: 'destructive' });
            return;
        }
        
        const newRecord: CommunicationInsert = {
            client_id: selectedClientForHistory.id,
            subject: newCommunication.subject || null,
            notes: newCommunication.notes,
            follow_up_date: newCommunication.follow_up_date || null,
        };
        
        createCommunicationMutation.mutate(newRecord, {
            onSuccess: () => {
                resetCommunicationForm();
                // Update status klien ke 'negosiasi' jika sebelumnya 'prospek'
                if (selectedClientForHistory.status === 'prospek') {
                    updateMutation.mutate({ id: selectedClientForHistory.id, data: { status: 'negosiasi' } });
                }
            }
        });
    }
    // --- END COMMUNICATION HISTORY HANDLERS ---


    const filteredClients = clients?.filter(client => 
        client.nama?.toLowerCase().includes(search.toLowerCase()) ||
        client.email?.toLowerCase().includes(search.toLowerCase()) ||
        client.bisnis?.toLowerCase().includes(search.toLowerCase())
    );
    
    // Fungsi untuk mendapatkan status warna renewal
    const getRenewalStatus = (dateString: string | null) => {
        if (!dateString) return null;
        const renewalDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        renewalDate.setHours(0, 0, 0, 0);

        const diffTime = renewalDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { text: 'EXPIRED', color: 'bg-red-600' };
        if (diffDays <= 30) return { text: `${diffDays} HARI LAGI`, color: 'bg-orange-600' };
        
        // Format tanggal ke YYYY/MM/DD
        const yyyy = renewalDate.getFullYear();
        const mm = String(renewalDate.getMonth() + 1).padStart(2, '0');
        const dd = String(renewalDate.getDate()).padStart(2, '0');
        
        return { text: `${dd}/${mm}/${yyyy}`, color: 'bg-blue-600' };
    }


    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header (Client CRUD Dialog) */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
                        <p className="text-muted-foreground">
                            Manage your client database and relationships
                        </p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetClientForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Client
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
                                <DialogDescription>
                                    {editingClient ? 'Update client information' : 'Enter client details to add to your CRM'}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="nama">Name *</Label>
                                            <Input
                                                id="nama"
                                                value={clientFormData.nama || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, nama: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={clientFormData.email || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Phone</Label>
                                            <Input
                                                id="phone"
                                                value={clientFormData.phone || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="whatsapp">WhatsApp</Label>
                                            <Input
                                                id="whatsapp"
                                                value={clientFormData.whatsapp || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, whatsapp: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* --- INPUT ALAMAT BARU --- */}
                                    <div className="space-y-2">
                                        <Label htmlFor="alamat">Alamat Klien (Untuk SPK)</Label>
                                        <Textarea
                                            id="alamat"
                                            placeholder="Masukkan alamat lengkap klien untuk dokumen resmi"
                                            value={clientFormData.alamat || ''}
                                            onChange={(e) => setClientFormData({ ...clientFormData, alamat: e.target.value })}
                                            rows={2}
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="bisnis">Business</Label>
                                            <Input
                                                id="bisnis"
                                                value={clientFormData.bisnis || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, bisnis: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="status">Status</Label>
                                            <Select
                                                value={clientFormData.status}
                                                onValueChange={(value) => setClientFormData({ ...clientFormData, status: value as any })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="prospek">Prospek</SelectItem>
                                                    <SelectItem value="negosiasi">Negosiasi</SelectItem>
                                                    <SelectItem value="deal">Deal</SelectItem>
                                                    <SelectItem value="aktif">Aktif</SelectItem>
                                                    <SelectItem value="selesai">Selesai</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2"> {/* Field Baru: Renewal Date */}
                                            <Label htmlFor="renewal_date">Renewal Date</Label>
                                            <Input
                                                id="renewal_date"
                                                type="date"
                                                // Pastikan nilai dikonversi ke string YYYY-MM-DD
                                                value={clientFormData.renewal_date ? clientFormData.renewal_date.toString() : ''} 
                                                onChange={(e) => setClientFormData({ ...clientFormData, renewal_date: e.target.value || null })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="catatan">Notes</Label>
                                        <Textarea
                                            id="catatan"
                                            value={clientFormData.catatan || ''}
                                            onChange={(e) => setClientFormData({ ...clientFormData, catatan: e.target.value })}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                        {editingClient ? 'Update Client' : 'Add Client'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Client List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Client List</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search clients by name, email, or business..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Business</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Renewal</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredClients && filteredClients.length > 0 ? (
                                        filteredClients.map((client) => {
                                            const renewalStatus = getRenewalStatus(client.renewal_date);
                                            return (
                                                <TableRow key={client.id}>
                                                    <TableCell className="font-medium">
                                                        <div className='font-semibold'>{client.nama}</div>
                                                        {/* Tampilkan Alamat dan Kontak di bawah nama */}
                                                        <div className='text-xs text-muted-foreground'>
                                                            Alamat: {client.alamat || '-'}
                                                        </div>
                                                        <div className='text-xs text-muted-foreground'>
                                                            Email: {client.email || '-'} | Telp/WA: {client.whatsapp || client.phone || '-'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{client.bisnis || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[client.status || 'prospek']}>
                                                            {client.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {renewalStatus ? (
                                                            <Badge className={renewalStatus.color} variant="default">
                                                                <Calendar className='w-3 h-3 mr-1'/>
                                                                {renewalStatus.text}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary">Tidak ada tanggal</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {/* Riwayat Komunikasi Button */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openHistoryDialog(client)}
                                                                title="Riwayat Komunikasi"
                                                            >
                                                                <MessageCircle className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                            
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(client)}
                                                                title="Edit Client"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(client.id)}
                                                                title="Hapus Client"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No clients found. Add your first client to get started.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                
                
                {/* COMMUNICATION HISTORY DIALOG (Modal) */}
                <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => {
                    setIsHistoryDialogOpen(open);
                    if (!open) setSelectedClientForHistory(null);
                }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Riwayat Komunikasi</DialogTitle>
                            <DialogDescription>
                                {selectedClientForHistory?.nama} ({selectedClientForHistory?.bisnis})
                            </DialogDescription>
                        </DialogHeader>
                        
                        <Separator className="my-2" />
                        
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Input Komunikasi Baru */}
                            <div className="md:col-span-1 space-y-4">
                                <CardHeader className="p-0">
                                    <CardTitle className="text-lg">Tambah Catatan</CardTitle>
                                    <CardDescription>Catat interaksi dan rencana follow up.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleAddCommunication} className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="comms-subject">Subjek</Label>
                                        <Input
                                            id="comms-subject"
                                            value={newCommunication.subject || ''}
                                            onChange={(e) => setNewCommunication({...newCommunication, subject: e.target.value})}
                                            placeholder="Diskusi Harga / Follow Up DP"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="comms-notes">Catatan Komunikasi *</Label>
                                        <Textarea
                                            id="comms-notes"
                                            value={newCommunication.notes || ''}
                                            onChange={(e) => setNewCommunication({...newCommunication, notes: e.target.value})}
                                            rows={4}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="comms-followup">Rencana Tindak Lanjut</Label>
                                        <Input
                                            id="comms-followup"
                                            type="date"
                                            value={newCommunication.follow_up_date || ''}
                                            onChange={(e) => setNewCommunication({...newCommunication, follow_up_date: e.target.value})}
                                        />
                                    </div>
                                    <Button 
                                        type="submit" 
                                        className="w-full"
                                        disabled={createCommunicationMutation.isPending || !newCommunication.notes}
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2" /> Simpan Catatan
                                    </Button>
                                </form>
                            </div>
                            
                            {/* Riwayat Komunikasi */}
                            <div className="md:col-span-2 space-y-4">
                                <CardHeader className="p-0">
                                    <CardTitle className="text-lg">Riwayat ({communications.length})</CardTitle>
                                </CardHeader>
                                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                                    {isLoadingCommunications ? (
                                        <p className="text-muted-foreground">Memuat riwayat...</p>
                                    ) : communications.length === 0 ? (
                                        <p className="text-muted-foreground">Belum ada riwayat komunikasi.</p>
                                    ) : (
                                        communications.map(comms => (
                                            <div key={comms.id} className="border p-3 rounded-lg bg-secondary/30 space-y-1">
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span className="font-semibold text-foreground">{comms.subject || 'Catatan Umum'}</span>
                                                    <span className="text-right">{new Date(comms.created_at).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <p className="text-sm">{comms.notes}</p>
                                                {comms.follow_up_date && (
                                                    <div className="flex items-center text-xs text-orange-600 pt-1">
                                                        <Calendar className="h-3 w-3 mr-1" />
                                                        Tindak Lanjut: {new Date(comms.follow_up_date).toLocaleDateString('id-ID')}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <DialogFooter>
                            <Button onClick={() => setIsHistoryDialogOpen(false)}>Tutup</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                
            </div>
        </DashboardLayout>
    );
}