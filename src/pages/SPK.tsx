import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Search, Download, FileCheck, ClipboardCopy } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueNumber } from '@/lib/number-generator';
import type { Database } from '@/integrations/supabase/types';

// Definisikan Tipe Data yang dibutuhkan
type ProjectExtended = Database['public']['Tables']['projects']['Row'] & { clients: { nama: string, bisnis: string, ruang_lingkup: string | null } | null };
type Company = Database['public']['Tables']['companies']['Row'];
type SPK = Database['public']['Tables']['spks']['Row'] & { projects: { nama_proyek: string } | null };
type SPKInsert = Database['public']['Tables']['spks']['Insert'];

const initialFormData = {
  projectId: '',
  termsConditions: 'Syarat & ketentuan umum: Pembayaran DP 50% di muka, sisa 50% setelah website selesai revisi dan siap tayang.',
  paymentTerms: 'Termin 1: 50% (Saat SPK ditandatangani). Termin 2: 50% (Saat proyek selesai).',
};

// ======================= DATA FETCHING & MUTATION =======================
const useSPKData = () => {
    const { toast } = useToast();
    
    // Mengambil semua data yang dibutuhkan: SPK, Proyek, dan Perusahaan
    const { data: allData, isLoading } = useQuery({
      queryKey: ['spk-page-data'],
      queryFn: async () => {
        const [spksRes, projectsRes, companyRes] = await Promise.all([
          // Fetch SPK dengan detail Proyek
          supabase.from('spks').select(`*, projects(nama_proyek)`).order('created_at', { ascending: false }),
          // Fetch Project (yang sudah berstatus DEAL) dengan detail Client
          supabase.from('projects').select(`id, nama_proyek, harga, client_id, clients(nama, bisnis, ruang_lingkup)`).neq('status', 'selesai'),
          // Fetch Data Perusahaan
          supabase.from('companies').select('*').limit(1).maybeSingle(),
        ]);
        
        if (spksRes.error) throw spksRes.error;
        if (projectsRes.error) throw projectsRes.error;
        if (companyRes.error) throw companyRes.error;
        
        return {
            spks: spksRes.data as SPK[],
            projects: projectsRes.data as ProjectExtended[],
            company: companyRes.data as Company | null,
        };
      },
    });

    const createMutation = (queryClient: any) => useMutation({
        mutationFn: async (data: SPKInsert) => {
            const { error } = await supabase.from('spks').insert(data);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spk-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });

    return { data: allData, isLoading, createMutation };
};
// ========================================================================

export default function SPK() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, createMutation } = useSPKData();
  const { spks = [], projects = [], company = null } = data || {};
  
  const selectedProject = projects.find(p => p.id === formData.projectId);
  const mutation = createMutation(queryClient);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId) {
      toast({ title: 'Error', description: 'Pilih proyek terlebih dahulu.', variant: 'destructive' });
      return;
    }
    if (!company?.nama || !company?.logo_url || !company?.signature_url) {
        toast({ title: 'Error', description: 'Data Perusahaan (Nama, Logo, Tanda Tangan) belum lengkap di Pengaturan.', variant: 'destructive' });
        return;
    }
    
    const spkNumber = generateUniqueNumber('SPK');
    
    // 1. Simulasikan pengiriman data ke Backend untuk Generate PDF
    console.log(`[SIMULASI] Mempersiapkan generate PDF untuk SPK No: ${spkNumber}`);
    const pdfData = {
        spkNumber,
        clientName: selectedProject?.clients?.nama,
        projectName: selectedProject?.nama_proyek,
        scopeOfWork: selectedProject?.clients?.ruang_lingkup || "Lihat detail proyek untuk ruang lingkup.",
        totalPrice: Number(selectedProject?.harga || 0),
        paymentTerms: formData.paymentTerms,
        companyName: company.nama,
        companyAddress: company.alamat,
        companyAccount: company.rekening,
        logoUrl: company.logo_url,
        signatureUrl: company.signature_url,
        todayDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    
    // 2. Simulasi Panggilan ke API/Server untuk Generate PDF
    // TODO: Ganti dengan API call ke endpoint Next.js Anda yang menjalankan Puppeteer
    
    const mockPdfUrl = `/uploads/spk/${spkNumber}.pdf`; 
    
    // 3. Simpan data SPK ke database
    const newSPK: SPKInsert = {
        spk_number: spkNumber,
        project_id: formData.projectId,
        pdf_url: mockPdfUrl,
        terms_conditions: formData.termsConditions,
        payment_terms: formData.paymentTerms,
    };

    mutation.mutate(newSPK, {
        onSuccess: () => {
            toast({ 
                title: "SPK Berhasil Dibuat!", 
                description: `No: ${spkNumber}. PDF siap diunduh (Simulasi).`, 
                action: <Button variant="link" asChild><a href={mockPdfUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-2" /> Download</a></Button>
            });
            setIsDialogOpen(false);
            setFormData(initialFormData);
        }
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Tersalin!', description: 'Nomor SPK berhasil disalin.' });
  };
  
  const filteredSPKs = spks.filter(s => 
    s.spk_number.toLowerCase().includes(search.toLowerCase()) || 
    s.projects?.nama_proyek.toLowerCase().includes(search.toLowerCase())
  );
  
  const isCompanySetupComplete = company && company.nama && company.logo_url && company.signature_url;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">SPK (Work Agreement)</h2>
            <p className="text-muted-foreground">
              Generate and manage work agreements
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(initialFormData)} disabled={isLoading || !isCompanySetupComplete}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Generate SPK
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Generate Surat Perjanjian Kerja</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isLoading ? (
                    <div className="text-muted-foreground">Memuat data proyek dan perusahaan...</div>
                ) : !isCompanySetupComplete && (
                    <div className="text-red-500 border border-red-200 bg-red-50 p-3 rounded-md">
                        ⚠️ **PERHATIAN:** Anda harus mengisi **Nama Perusahaan**, **Logo**, dan **Tanda Tangan** di halaman <a href="/settings" className="font-semibold underline">Pengaturan</a> sebelum membuat SPK.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Pilih Proyek *</Label>
                    <Select required value={formData.projectId} onValueChange={(val) => setFormData({ ...formData, projectId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih proyek yang akan dibuat SPK" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id!}>
                            {p.nama_proyek} ({p.clients?.nama})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Harga Proyek</Label>
                    <Input disabled value={selectedProject ? formatCurrency(Number(selectedProject.harga)) : 'Pilih Proyek'} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Syarat & Ketentuan Umum</Label>
                  <Textarea
                    id="terms"
                    value={formData.termsConditions}
                    onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
                    rows={5}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Ketentuan Pembayaran (Termin)</Label>
                  <Textarea
                    id="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={mutation.isPending || !formData.projectId || !isCompanySetupComplete}
                  >
                    <FileCheck className="mr-2 h-4 w-4" />
                    {mutation.isPending ? "Menciptakan SPK..." : "Generate & Simpan SPK"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* SPK List */}
        <Card>
          <CardHeader>
            <CardTitle>Dokumen SPK</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nomor SPK atau proyek..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SPK #</TableHead>
                    <TableHead>Proyek</TableHead>
                    <TableHead>Tanggal Dibuat</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat data...</TableCell></TableRow>
                  ) : filteredSPKs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada dokumen SPK.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSPKs.map((spk) => (
                      <TableRow key={spk.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          {spk.spk_number}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleCopy(spk.spk_number)}
                            title="Salin Nomor SPK"
                          >
                            <ClipboardCopy className="h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell>{spk.projects?.nama_proyek || '-'}</TableCell>
                        <TableCell>{new Date(spk.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <a href={spk.pdf_url || '#'} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </a>
                          </Button>
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