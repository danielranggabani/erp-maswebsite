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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Import icon yang dibutuhkan
import { PlusCircle, Search, Download, FileCheck, ClipboardCopy, FileText, Trash2 } from 'lucide-react'; 
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueNumber } from '@/lib/number-generator';
import type { Database } from '@/integrations/supabase/types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SPKTemplate } from '@/templates/SPKTemplate';

// Definisikan Tipe Data yang dibutuhkan
type ProjectExtended = Database['public']['Tables']['projects']['Row'] & { 
    ruang_lingkup: string | null; 
    clients: { 
        nama: string, 
        bisnis: string,
        alamat: string | null, 
        email: string | null, 
        phone: string | null, 
        whatsapp: string | null, 
    } | null 
};
type Company = Database['public']['Tables']['companies']['Row'] & {
    email: string | null;
    telp: string | null;
};
type SPK = Database['public']['Tables']['spks']['Row'] & { projects: { nama_proyek: string } | null };
type SPKInsert = Database['public']['Tables']['spks']['Insert'];

// Tipe Data untuk props Template View (Import dari SPKTemplate)
type SPKTemplateProps = React.ComponentProps<typeof SPKTemplate>;

const initialFormData = {
projectId: '',
termsConditions: '', 
paymentTerms: '',
};

// ======================= DATA FETCHING & MUTATION =======================
const useSPKData = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const localLogoUrl = '/download-files/logo.png';
    const localSignatureUrl = '/download-files/ttd.png';

    const dummyCompany: Company = {
      id: 1,
      nama: 'PT MasWebsite Tech',
      alamat: 'Jl. Contoh No. 123',
      rekening: 'BCA 123456789 (PT MasWebsite)',
      logo_url: localLogoUrl,
      signature_url: localSignatureUrl,
      email: 'admin@agency.com',
      telp: '081234567890',
      created_at: new Date().toISOString()
    };
    
    const { data: allData, isLoading } = useQuery({
      queryKey: ['spk-page-data'],
      queryFn: async () => {
        try {
          const [spksRes, projectsRes, companyRes] = await Promise.all([
            supabase.from('spks').select(`*, projects(nama_proyek)`).order('created_at', { ascending: false }),
            
            // QUERY MENGAMBIL DATA KLIEN LENGKAP
            supabase.from('projects').select(`
                id, 
                nama_proyek, 
                harga, 
                client_id, 
                ruang_lingkup,
                clients(nama, bisnis, alamat, email, phone, whatsapp) 
            `).neq('status', 'selesai'),
            
            supabase.from('companies').select('*, email, telp').limit(1).maybeSingle(),
          ]);
        
          if (spksRes.error) throw spksRes.error;
          if (projectsRes.error) throw projectsRes.error;
          
          const companyData = companyRes.data;
          
          const finalCompanyData = {
            ...(companyData || dummyCompany),
            logo_url: companyData?.logo_url || localLogoUrl,
            signature_url: companyData?.signature_url || localSignatureUrl,
          } as Company;
        
          return {
              spks: spksRes.data as SPK[],
              projects: projectsRes.data as ProjectExtended[],
              company: finalCompanyData as Company | null,
          };
        } catch (error: any) {
          toast({ title: 'Fetch Error Klien/Proyek', description: error.message, variant: 'destructive' });
          return { spks: [], projects: [], company: dummyCompany };
        }
      },
    });

    const createMutation = useMutation({
        mutationFn: async (data: SPKInsert) => {
            const { error } = await supabase.from('spks').insert(data);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spk-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Database Error', description: `Gagal simpan SPK: ${error.message}`, variant: 'destructive' });
        }
    });

    // MUTASI BARU: Delete SPK
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('spks').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spk-page-data'] });
            toast({ title: 'SPK Berhasil Dihapus', description: 'Dokumen SPK telah dihapus dari database.', duration: 3000 });
        },
        onError: (error: any) => {
            toast({ title: 'Error Hapus SPK', description: error.message, variant: 'destructive' });
        }
    });

    return { data: allData, isLoading, createMutation, deleteMutation };
};
// ========================================================================

export default function SPK() {
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormData);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    // State dan Ref untuk View/PDF Generation
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewedSPKData, setViewedSPKData] = useState<SPKTemplateProps | null>(null);
    const spkRef = useRef<HTMLDivElement>(null); 

    const { data, isLoading, createMutation, deleteMutation } = useSPKData();
    const { spks = [], projects = [], company = null } = data || {};
    
    const selectedProject = projects.find(p => p.id === formData.projectId);
    const mutation = createMutation;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };
    
    // FUNGSI UTAMA GENERATE PDF (Dipanggil dari tombol di modal preview)
    const handleGenerateAndDownload = async () => {
        const elementToCapture = spkRef.current; 
        
        if (!elementToCapture || !viewedSPKData) {
            toast({ title: 'Error', description: 'Template SPK belum dimuat.', variant: 'destructive' });
            return;
        }

        toast({ title: 'Processing', description: 'Memulai generate PDF SPK di browser...' });

        try {
            const canvas = await html2canvas(elementToCapture, { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let position = 0;
            let heightLeft = imgHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= 297; 
                if (heightLeft > 0) {
                    pdf.addPage();
                }
            }

            pdf.save(`${viewedSPKData.spkNumber}.pdf`);
            
            toast({ title: 'Success', description: `SPK ${viewedSPKData.spkNumber} berhasil diunduh!`, duration: 3000 });
            
        } catch (error) {
            console.error("PDF Client Generation Error:", error);
            toast({ title: 'Fatal Error', description: 'Gagal membuat file PDF. Cek F12 Console.', variant: 'destructive', duration: 5000 });
        } finally {
            setIsViewOpen(false); // Tutup modal setelah download
        }
    };

    // Fungsi untuk menyiapkan data dan membuka modal preview
    const prepareDataAndOpenPreview = (spk: SPK) => {
        const project = projects.find(p => p.id === spk.project_id);
        
        if (!project || !company) {
            toast({ title: 'Error', description: 'Detail proyek atau perusahaan tidak ditemukan.', variant: 'destructive' });
            return;
        }
        
        const client = project.clients;
        const clientTelp = client?.whatsapp || client?.phone || 'Nomor Telepon Belum Tersedia';

        const templateData: SPKTemplateProps = {
            spkNumber: spk.spk_number,
            todayDate: new Date(spk.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            totalPrice: Number(project.harga),
            
            companyName: company.nama || 'Perusahaan Anda',
            companyAddress: company.alamat || 'Alamat Perusahaan',
            companyAccount: company.rekening || 'Rekening Perusahaan',
            logoUrl: company.logo_url,
            signatureUrl: company.signature_url,
            companyEmail: company.email || '-',
            companyTelp: company.telp || '-',

            clientName: client?.nama || 'Klien Baru',
            clientBusiness: client?.bisnis || '-',
            clientAddress: client?.alamat || 'Alamat Klien Belum Diisi',
            clientEmail: client?.email || 'Email Belum Tersedia',
            clientTelp: clientTelp,

            projectName: project.nama_proyek,
            scopeOfWork: project.ruang_lingkup || 'Lihat detail proyek.',
            websiteType: project.nama_proyek,
        };

        setViewedSPKData(templateData);
        setIsViewOpen(true); // Buka modal
    }


    const handleSaveAndPreview = (spkNumber: string, data: typeof initialFormData) => {
        if (!selectedProject || !company) return;
        // ... (Logika persiapan data template sama) ...
        const client = selectedProject.clients;
        const clientTelp = client?.whatsapp || client?.phone || 'Nomor Telepon Belum Tersedia';

        const templateData: SPKTemplateProps = {
            spkNumber: spkNumber,
            todayDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            totalPrice: Number(selectedProject.harga),
            
            companyName: company.nama || 'Perusahaan Anda',
            companyAddress: company.alamat || 'Alamat Perusahaan',
            companyAccount: company.rekening || 'Rekening Perusahaan',
            logoUrl: company.logo_url,
            signatureUrl: company.signature_url,
            companyEmail: company.email || '-',
            companyTelp: company.telp || '-',

            clientName: client?.nama || 'Klien Baru',
            clientBusiness: client?.bisnis || '-',
            clientAddress: client?.alamat || 'Alamat Klien Belum Diisi',
            clientEmail: client?.email || 'Email Belum Tersedia',
            clientTelp: clientTelp,

            projectName: selectedProject.nama_proyek,
            scopeOfWork: selectedProject.ruang_lingkup || 'Lihat detail proyek.',
            websiteType: selectedProject.nama_proyek,
        };

        setViewedSPKData(templateData);
        setIsViewOpen(true);
    }
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!company) {
            toast({ title: 'Error', description: 'Gagal memuat data perusahaan.', variant: 'destructive' });
            return;
        }
        
        if (!formData.projectId) {
            toast({ title: 'Error', description: 'Pilih proyek terlebih dahulu.', variant: 'destructive' });
            return;
        }
        
        if (!company.nama || !company.logo_url || !company.signature_url) {
            toast({ title: 'Error', description: 'Data Perusahaan (Nama, Logo, Tanda Tangan) belum lengkap di Pengaturan.', variant: 'destructive' });
            return;
        }
        
        const spkNumber = generateUniqueNumber('SPK');
        const mockPdfUrl = `/uploads/spk/${spkNumber}.pdf`; 
        
        // 1. Simpan data SPK ke database
        const newSPK: SPKInsert = {
            spk_number: spkNumber,
            project_id: formData.projectId,
            terms_conditions: 'Template Otomatis', 
            payment_terms: 'Template Otomatis', 
            pdf_url: mockPdfUrl,
        };

        mutation.mutate(newSPK, {
            onSuccess: () => {
                toast({ 
                    title: "SPK Berhasil Dibuat!", 
                    description: `No: ${spkNumber}. Membuka preview untuk cetak.`, 
                });
                setIsDialogOpen(false);
                
                // 2. Tampilkan Preview untuk di-generate PDF
                handleSaveAndPreview(spkNumber, formData);
            }
        });
    };

    const handleDeleteSPK = (id: string, spkNumber: string) => {
        if (confirm(`Apakah Anda yakin ingin menghapus dokumen SPK ${spkNumber}? Tindakan ini tidak dapat dibatalkan.`)) {
            deleteMutation.mutate(id);
        }
    };
    
    const filteredSPKs = spks.filter(s => 
        s.spk_number.toLowerCase().includes(search.toLowerCase()) || 
        s.projects?.nama_proyek.toLowerCase().includes(search.toLowerCase()) ||
        (s.project_id && projects.find(p => p.id === s.project_id)?.clients?.nama.toLowerCase().includes(search.toLowerCase()))
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
                        <DialogContent className="max-w-3xl">
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
                                
                                {/* KONTEN SYARAT & KETENTUAN DIHAPUS KARENA OTOMATIS */}
                                <div className="space-y-2 text-muted-foreground border p-4 rounded-md">
                                    <p>Syarat & Ketentuan serta Ketentuan Pembayaran akan di-generate otomatis berdasarkan data Proyek dan Perusahaan ke dalam format Dokumen SPK.</p>
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
                                                    <div className="flex justify-end gap-2">
                                                        
                                                        {/* TOMBOL PREVIEW DENGAN ICON DOWNLOAD */}
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            title="Lihat Detail & Download SPK"
                                                            onClick={() => prepareDataAndOpenPreview(spk)}
                                                        >
                                                             {/* Ganti icon FileText menjadi Download */}
                                                             <Download className="mr-2 h-4 w-4" /> Preview
                                                        </Button>

                                                        {/* TOMBOL HAPUS SPK */}
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            title="Hapus Dokumen SPK"
                                                            disabled={deleteMutation.isPending}
                                                            onClick={() => handleDeleteSPK(spk.id, spk.spk_number)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
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

                {/* DIALOG TEMPLATE VIEW SPK - Digunakan untuk trigger download */}
                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Preview Dokumen {viewedSPKData?.spkNumber}</DialogTitle>
                        </DialogHeader>
                        {/* Menampilkan komponen SPK Template di dalam REF */}
                        <div ref={spkRef} className="p-4 bg-white shadow-inner">
                            {viewedSPKData && (
                                <SPKTemplate {...viewedSPKData} />
                            )}
                        </div>
                        <DialogFooter>
                             {/* TOMBOL DOWNLOAD DI DALAM MODAL PREVIEW */}
                             <Button 
                                 variant="secondary"
                                 onClick={handleGenerateAndDownload} 
                                 disabled={!viewedSPKData}
                             >
                                 <Download className="h-4 w-4 mr-2" /> Cetak ke PDF (Download)
                             </Button>
                             <Button variant="outline" onClick={() => setIsViewOpen(false)}>Tutup</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}