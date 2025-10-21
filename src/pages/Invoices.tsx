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
  TableFooter
} from '@/components/ui/table';
import { 
  PlusCircle, 
  Search, 
  Pencil, 
  Trash2, 
  Download, 
  Calendar, 
  DollarSign,
  ArrowRight,
  FileText,
  Copy 
} from 'lucide-react'; 
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 
import type { Database } from '@/integrations/supabase/types';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { generateUniqueNumber } from '@/lib/number-generator';
import { Separator } from '@/components/ui/separator'; 


// ======================= TIPE DATA DENGAN JOIN =======================
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type Company = Database['public']['Tables']['companies']['Row']; 

type Project = ProjectRow & { clients: { nama: string } | null };
type Invoice = Database['public']['Tables']['invoices']['Row'] & { 
  projects: { nama_proyek: string, client_id: string, clients: { nama: string, bisnis: string } | null } | null;
  clients: { nama: string, bisnis: string } | null; 
};
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];

// ======================= UTILS =======================
const statusColors: Record<string, string> = {
  draft: 'bg-gray-400',
  menunggu_dp: 'bg-yellow-500',
  lunas: 'bg-green-500', 
  overdue: 'bg-red-500',
};

const getStatusBadge = (status: string | null) => {
    const safeStatus = status || 'draft';
    const displayStatus = safeStatus === 'menunggu_dp' ? 'Menunggu DP' : safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
    return <Badge className={statusColors[safeStatus] || 'bg-gray-500'}>{displayStatus}</Badge>;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};


// --- KOMPONEN TEMPLATE INVOICE VIEW (STABIL) ---
interface InvoiceViewProps {
  invoice: Invoice;
  company: Company | null;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ invoice, company }) => {
    const total = invoice.amount || 0;
    const clientName = invoice.clients?.nama || 'N/A Client';
    const clientBusiness = invoice.clients?.bisnis || 'N/A Business';
    const projectName = invoice.projects?.nama_proyek || 'Proyek Umum';
    const companyName = company?.nama || 'N/A Agency';
    const companyAddress = company?.alamat || 'Alamat Perusahaan';
    const companyAccount = company?.rekening || 'Rekening Perusahaan';
    const logoUrl = company?.logo_url;
    
    // Perhitungan status pembayaran (simulasi)
    const isLunas = invoice.status === 'lunas';
    const paidAmount = isLunas ? total : 0; // Total yang dibayar 0 jika belum lunas
    const balanceDue = total - paidAmount; // Balance Due adalah Total jika belum lunas

    const items = [
        { 
            description: `Jasa Pembuatan Website: ${projectName}`, 
            amount: total 
        }
    ];

    return (
        <div className="p-0 space-y-6">
            {/* HEADER (AD4TECH + LOGO) */}
            <header className="flex justify-between items-start border-b-2 border-blue-600 pb-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold">{companyName}</h2>
                    <p className="text-sm">{companyAddress}</p>
                    <p className="text-sm">Email: <span className='text-blue-600'>admin@maswebsite.id</span></p>
                </div>
                <div className="flex flex-col items-end">
                    <h1 className="text-3xl font-extrabold text-blue-600">INVOICE</h1>
                    {/* Simulasikan Logo (sesuai request) */}
                    {logoUrl && (
                        <img src={logoUrl} alt="Logo Perusahaan" className="w-24 h-auto mt-2 object-contain" />
                    )}
                </div>
            </header>

            {/* BILLING INFO & DATES */}
            <section className="grid grid-cols-3 text-sm border p-4 rounded-lg bg-gray-50">
                <div className="col-span-2 space-y-1">
                    <p className="font-bold border-b pb-1">Tagihan Kepada (Bill To)</p>
                    <p className="font-semibold">{clientName}</p>
                    <p className="text-xs">{clientBusiness}</p>
                </div>
                <div className="col-span-1 space-y-1 text-right">
                    <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
                    <p><strong>Invoice Date:</strong> {invoice.tanggal_terbit}</p>
                    <p className={`font-bold ${invoice.status === 'overdue' ? 'text-red-700' : 'text-red-500'}`}>
                        <strong>Due Date:</strong> {invoice.jatuh_tempo}
                    </p>
                </div>
            </section>

            {/* ITEM TABLE */}
            <Table>
                <TableHeader className="bg-blue-600">
                    <TableRow className="border-b-blue-700">
                        <TableHead className="text-white font-bold">Sl. Description</TableHead>
                        <TableHead className="text-white text-right w-[15%] font-bold">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                
                <TableFooter>
                    <TableRow className="bg-gray-100">
                        <TableCell className="text-right font-bold">Subtotal</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            {/* PAYMENT SUMMARY */}
            <div className="flex justify-end pt-4">
                <Card className="w-full max-w-sm border-2">
                    <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total Tagihan:</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                        
                        {/* Tampil hanya jika lunas */}
                        {isLunas && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Paid (Lunas):</span>
                                <span>{formatCurrency(paidAmount)}</span>
                            </div>
                        )}
                        
                        <Separator />
                        <div className="flex justify-between text-xl font-extrabold">
                            <span>Balance Due:</span>
                            <span className="text-red-600">{formatCurrency(balanceDue)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* INSTRUCTIONS */}
            <section className="text-sm pt-4">
                <p className="font-bold">Payment Instructions:</p>
                <p>{companyAccount}</p>
            </section>
        </div>
    );
}

// --- END KOMPONEN TEMPLATE INVOICE BARU ---

// ======================= DATA FETCHING & MUTATION =======================
const useInvoiceData = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: allData, isLoading } = useQuery({
      queryKey: ['invoice-page-data'],
      queryFn: async () => {
        const [invoicesRes, projectsRes, companyRes] = await Promise.all([
          supabase.from('invoices').select(`
              *, 
              projects(nama_proyek, client_id, clients(nama, bisnis)) 
          `).order('created_at', { ascending: false }),
          supabase.from('projects').select('id, nama_proyek, harga, client_id, clients(nama)'),
          supabase.from('companies').select('*').limit(1).maybeSingle(),
        ]);
        
        if (invoicesRes.error) throw invoicesRes.error;
        if (projectsRes.error) throw projectsRes.error;
        if (companyRes.error) throw companyRes.error;
        
        const invoices = invoicesRes.data.map(inv => {
            const projectData = inv.projects as { nama_proyek: string, client_id: string, clients: { nama: string, bisnis: string } | null } | null;
            return {
                ...inv,
                projects: projectData,
                clients: projectData?.clients
            };
        }) as Invoice[];
        
        const projects = projectsRes.data.map(p => ({
            ...p,
            clients: p.clients as { nama: string } | null
        })) as Project[];
        
        return { invoices, projects, company: companyRes.data as Company | null };
      },
    });
    
    // Mutation untuk membuat Invoice baru
    const createMutation = useMutation({
        mutationFn: async (data: InvoiceInsert) => {
            if (!data.invoice_number) data.invoice_number = generateUniqueNumber('INV'); 
            const { error } = await supabase.from('invoices').insert(data);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Invoice berhasil dibuat.' });
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    // Mutation untuk mengupdate Invoice
    const updateMutation = useMutation({
        mutationFn: async (data: Partial<Invoice> & { id: string }) => {
            const { error } = await supabase.from('invoices').update(data).eq('id', data.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Invoice berhasil diupdate.' });
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    // Mutation untuk menghapus Invoice
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Invoice berhasil dihapus.' });
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });
    
    // Mutation untuk update status (Lunas/Belum Lunas)
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, paid_at }: { id: string, status: string, paid_at: string | null }) => {
            const { error } = await supabase.from('invoices').update({ status, paid_at }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });


    return { 
        invoices: allData?.invoices || [], 
        projects: allData?.projects || [], 
        company: allData?.company,
        isLoading, 
        createMutation, 
        updateMutation,
        deleteMutation,
        updateStatusMutation
    };
};

// ======================= COMPONENT UTAMA =======================
export default function Invoices() {
  const { toast } = useToast();
  const { invoices, projects, company, isLoading, createMutation, updateMutation, deleteMutation, updateStatusMutation } = useInvoiceData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  
  // State untuk Melihat Template
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewedInvoice, setViewedInvoice] = useState<Invoice | null>(null);

  
  const [formData, setFormData] = useState({
    project_id: '',
    invoice_number: '',
    tanggal_terbit: new Date().toISOString().substring(0, 10),
    jatuh_tempo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    amount: 0,
    status: 'menunggu_dp',
  });

  const selectedProject = projects.find(p => p.id === formData.project_id);


  useEffect(() => {
    if (selectedProject) {
        setFormData(prev => ({
            ...prev,
            amount: selectedProject.harga || 0,
        }));
    } else if (!editingInvoice) {
         setFormData(prev => ({ ...prev, amount: 0 }));
    }
  }, [formData.project_id, selectedProject, editingInvoice]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.project_id) {
        return toast({ title: 'Error', description: 'Please select a Project.', variant: 'destructive' });
    }
    
    const invoiceNumber = editingInvoice ? editingInvoice.invoice_number : generateUniqueNumber('INV');

    const dataToSend: InvoiceInsert = {
      project_id: formData.project_id,
      invoice_number: invoiceNumber,
      tanggal_terbit: formData.tanggal_terbit,
      jatuh_tempo: formData.jatuh_tempo,
      amount: formData.amount,
      status: formData.status as any,
      // URL unik untuk redirect/mock download
      pdf_url: `/download-files/${invoiceNumber}.pdf`, 
    }
    
    if (editingInvoice) {
        updateMutation.mutate({...dataToSend, id: editingInvoice.id}); 
    } else {
        createMutation.mutate(dataToSend);
    }

    setDialogOpen(false);
  };
  
  const handleMarkPaid = (invoice: Invoice) => {
      const isLunas = invoice.status === 'lunas';
      const newStatus = isLunas ? 'menunggu_dp' : 'lunas'; 
      const paid_at = isLunas ? null : new Date().toISOString();

      updateStatusMutation.mutate({ 
          id: invoice.id, 
          status: newStatus, 
          paid_at 
      });
  };
  
  // FIX: Mengganti fungsi View Template agar menampilkan Modal
  const handleViewTemplate = (invoice: Invoice) => {
      setViewedInvoice(invoice);
      setIsViewOpen(true);
  }

  const handleDelete = () => {
    if (deleteId) {
        deleteMutation.mutate(deleteId);
        setDeleteId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      invoice_number: '',
      tanggal_terbit: new Date().toISOString().substring(0, 10),
      jatuh_tempo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      amount: 0,
      status: 'menunggu_dp',
    });
    setEditingInvoice(null);
  };

  const openEditDialog = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      project_id: invoice.project_id || '',
      invoice_number: invoice.invoice_number || '',
      tanggal_terbit: invoice.tanggal_terbit || '',
      jatuh_tempo: invoice.jatuh_tempo || '',
      amount: invoice.amount || 0,
      status: invoice.status || 'menunggu_dp',
    });
    setDialogOpen(true);
  };

  const filteredInvoices = invoices.filter((inv) =>
    (inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     inv.projects?.nama_proyek.toLowerCase().includes(searchQuery.toLowerCase()) ||
     inv.clients?.nama?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- TEMPLATE VIEW LOGIC DITANAM DI SINI ---
  const renderInvoicePreview = (invoice: Invoice, company: Company | null) => {
    const total = invoice.amount || 0;
    const clientName = invoice.clients?.nama || 'N/A Client';
    const clientBusiness = invoice.clients?.bisnis || 'N/A Business';
    const projectName = invoice.projects?.nama_proyek || 'Proyek Umum';
    const companyName = company?.nama || 'N/A Agency';
    const companyAddress = company?.alamat || 'Alamat Perusahaan';
    const companyAccount = company?.rekening || 'Rekening Perusahaan';
    const logoUrl = company?.logo_url;
    
    // Perhitungan status pembayaran (simulasi)
    const isLunas = invoice.status === 'lunas';
    const paidAmount = isLunas ? total : 0; // Total yang dibayar 0 jika belum lunas
    const balanceDue = total - paidAmount; // Balance Due adalah Total jika belum lunas

    const items = [
        { 
            description: `Jasa Pembuatan Website: ${projectName}`, 
            amount: total 
        }
    ];

    return (
        <div className="p-0 space-y-6">
            {/* HEADER (AD4TECH + LOGO) */}
            <header className="flex justify-between items-start border-b-2 border-blue-600 pb-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold">{companyName}</h2>
                    <p className="text-sm">{companyAddress}</p>
                    <p className="text-sm">Email: <span className='text-blue-600'>admin@maswebsite.id</span></p>
                </div>
                <div className="flex flex-col items-end">
                    <h1 className="text-3xl font-extrabold text-blue-600">INVOICE</h1>
                    {/* Simulasikan Logo (sesuai request) */}
                    {logoUrl && (
                        <img src={logoUrl} alt="Logo Perusahaan" className="w-24 h-auto mt-2 object-contain" />
                    )}
                </div>
            </header>

            {/* BILLING INFO & DATES */}
            <section className="grid grid-cols-3 text-sm border p-4 rounded-lg bg-gray-50">
                <div className="col-span-2 space-y-1">
                    <p className="font-bold border-b pb-1">Tagihan Kepada (Bill To)</p>
                    <p className="font-semibold">{clientName}</p>
                    <p className="text-xs">{clientBusiness}</p>
                </div>
                <div className="col-span-1 space-y-1 text-right">
                    <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
                    <p><strong>Invoice Date:</strong> {invoice.tanggal_terbit}</p>
                    <p className={`font-bold ${invoice.status === 'overdue' ? 'text-red-700' : 'text-red-500'}`}>
                        <strong>Due Date:</strong> {invoice.jatuh_tempo}
                    </p>
                </div>
            </section>

            {/* ITEM TABLE */}
            <Table>
                <TableHeader className="bg-blue-600">
                    <TableRow className="border-b-blue-700">
                        <TableHead className="text-white font-bold">Sl. Description</TableHead>
                        <TableHead className="text-white text-right w-[15%] font-bold">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                
                <TableFooter>
                    <TableRow className="bg-gray-100">
                        <TableCell className="text-right font-bold">Subtotal</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            {/* PAYMENT SUMMARY */}
            <div className="flex justify-end pt-4">
                <Card className="w-full max-w-sm border-2">
                    <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total Tagihan:</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                        
                        {/* Tampil hanya jika lunas */}
                        {isLunas && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Paid (Lunas):</span>
                                <span>{formatCurrency(paidAmount)}</span>
                            </div>
                        )}
                        
                        <Separator />
                        <div className="flex justify-between text-xl font-extrabold">
                            <span>Balance Due:</span>
                            <span className="text-red-600">{formatCurrency(balanceDue)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* INSTRUCTIONS */}
            <section className="text-sm pt-4">
                <p className="font-bold">Payment Instructions:</p>
                <p>{companyAccount}</p>
            </section>
        </div>
    );
  }
  // --- END TEMPLATE VIEW LOGIC DITANAM DI SINI ---

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
            <p className="text-muted-foreground">
              Manage billing and payment status.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Project Selection */}
                <div className="space-y-2">
                    <Label htmlFor="project_id">Select Project (Required)</Label>
                    <Select 
                      value={formData.project_id} 
                      onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.length === 0 && <SelectItem value="" disabled>No Active Projects</SelectItem>}
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id!}>{p.nama_proyek} ({p.clients?.nama})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
                
                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="invoice_number">Invoice No (Auto-Generated)</Label>
                        <Input
                          id="invoice_number"
                          value={editingInvoice ? editingInvoice.invoice_number : generateUniqueNumber('INV')}
                          placeholder={`INV-TahunBulanTanggal-XXXX`}
                          disabled
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Total Price (IDR)</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                {/* Dates & Status */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_terbit">Date Issued</Label>
                    <Input
                      id="tanggal_terbit"
                      type="date"
                      value={formData.tanggal_terbit}
                      onChange={(e) => setFormData({ ...formData, tanggal_terbit: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jatuh_tempo">Due Date</Label>
                    <Input
                      id="jatuh_tempo"
                      type="date"
                      value={formData.jatuh_tempo}
                      onChange={(e) => setFormData({ ...formData, jatuh_tempo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="menunggu_dp">Menunggu DP</SelectItem>
                        <SelectItem value="lunas">Lunas</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !formData.project_id}>
                    {createMutation.isPending || updateMutation.isPending ? 'Processing...' : (editingInvoice ? 'Update Invoice' : 'Create Invoice')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Invoice List */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice List ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice number or project..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Project / Client</TableHead>
                    <TableHead>Issued / Due Date</TableHead>
                    <TableHead className='text-right'>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const isLunas = invoice.status === 'lunas';
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number || '-'}</TableCell>
                          <TableCell>
                            <div className="font-medium">{invoice.projects?.nama_proyek || '-'}</div>
                            <div className="text-sm text-muted-foreground">{invoice.clients?.nama || 'N/A'}</div>
                          </TableCell>
                          <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                  <Calendar className='w-3 h-3 text-muted-foreground'/>
                                  {invoice.tanggal_terbit} <ArrowRight className='w-3 h-3'/> {invoice.jatuh_tempo}
                              </div>
                          </TableCell>
                          <TableCell className='font-medium text-right'>
                              {formatCurrency(invoice.amount || 0)}
                          </TableCell>
                          <TableCell>
                              {getStatusBadge(invoice.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                                
                              {/* 1. LIHAT TEMPLATE/PREVIEW (FINAL SOLUSI VISUAL) */}
                              <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  title="Lihat Detail Invoice"
                                  onClick={() => handleViewTemplate(invoice)}
                              >
                                  <FileText className="h-4 w-4 text-blue-600" />
                              </Button>

                              {/* 2. Download Button (Langsung Unduh) */}
                              {invoice.pdf_url && (
                                  <a 
                                      href={invoice.pdf_url} 
                                      download={`${invoice.invoice_number}.pdf`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                  >
                                      <Button size="sm" variant="secondary" title="Cetak/Unduh PDF (Simulasi)">
                                          <Download className="h-4 w-4" />
                                      </Button>
                                  </a>
                              )}
                              
                              {/* 3. Mark Paid Button */}
                              <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  title={isLunas ? 'Tandai Belum Lunas' : 'Tandai Lunas'}
                                  onClick={() => handleMarkPaid(invoice)}
                                  className={isLunas ? 'text-green-600 hover:bg-green-100' : 'text-gray-500 hover:bg-yellow-100'}
                              >
                                  <DollarSign className="h-4 w-4" />
                              </Button>

                              <Button size="sm" variant="outline" onClick={() => openEditDialog(invoice)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteId(invoice.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                Invoice ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* DIALOG TEMPLATE VIEW (FINAL STABIL) */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Preview Invoice {viewedInvoice?.invoice_number}</DialogTitle>
                </DialogHeader>
                {/* Menampilkan komponen Invoice View yang sudah diperbaiki */}
                {viewedInvoice && (
                    <InvoiceView invoice={viewedInvoice} company={company} />
                )}
                <DialogFooter>
                     {/* Tombol Cetak/Download */}
                     <a 
                        href={viewedInvoice?.pdf_url || '#'} 
                        download={`${viewedInvoice?.invoice_number}.pdf`}
                        target="_blank" 
                        rel="noopener noreferrer">
                        <Button variant="secondary">
                           <Download className="h-4 w-4 mr-2" /> Cetak ke PDF
                        </Button>
                    </a>
                    <Button variant="outline" onClick={() => setIsViewOpen(false)}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


      </div>
    </DashboardLayout>
  );
}