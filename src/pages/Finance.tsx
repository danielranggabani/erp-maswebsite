import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react";
import React, { useState, useRef } from "react"; // Tambahkan useRef
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import html2canvas from 'html2canvas'; // Import html2canvas
import jsPDF from 'jspdf'; // Import jsPDF

type Finance = Database['public']['Tables']['finances']['Row'];
type FinanceInsert = Database['public']['Tables']['finances']['Insert'];
type FinanceType = Database['public']['Enums']['finance_type'];
type FinanceCategory = Database['public']['Enums']['finance_category'];

// Utility untuk format mata uang
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
};


export default function Finance() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFinance, setEditingFinance] = useState<Finance | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<FinanceInsert>>({
    tipe: "income" as FinanceType,
    kategori: "pendapatan" as FinanceCategory,
    nominal: 0,
    keterangan: "",
    tanggal: new Date().toISOString().split('T')[0]
  });
  // State Filter Laporan
  const [filterMonth, setFilterMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`); // Format YYYY-MM
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const reportRef = useRef<HTMLDivElement>(null); // Ref untuk area cetak

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch semua data keuangan
  const { data: finances = [], isLoading } = useQuery({
    queryKey: ['finances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finances')
        .select('*')
        .order('tanggal', { ascending: false });

      if (error) throw error;
      return data.map(f => ({ ...f, nominal: Number(f.nominal) })) as Finance[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newFinance: FinanceInsert) => {
      const { data, error } = await supabase
        .from('finances')
        .insert(newFinance)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: "Transaksi berhasil ditambahkan" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Finance> & { id: string }) => {
      const { data, error } = await supabase
        .from('finances')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: "Transaksi berhasil diupdate" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finances')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: "Transaksi berhasil dihapus" });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      tipe: "income" as FinanceType,
      kategori: "pendapatan" as FinanceCategory,
      nominal: 0,
      keterangan: "",
      tanggal: new Date().toISOString().split('T')[0]
    });
    setEditingFinance(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nominal === 0 || !formData.nominal) {
        toast({ title: "Error", description: "Nominal tidak boleh nol.", variant: "destructive" });
        return;
    }

    if (editingFinance) {
      updateMutation.mutate({ id: editingFinance.id, ...formData });
    } else {
      createMutation.mutate(formData as FinanceInsert);
    }
  };

  const handleEdit = (finance: Finance) => {
    setEditingFinance(finance);
    setFormData({
      tipe: finance.tipe,
      kategori: finance.kategori,
      nominal: Number(finance.nominal),
      keterangan: finance.keterangan || "",
      tanggal: finance.tanggal
    });
    setIsDialogOpen(true);
  };

  // Logika Filter Data
  const filteredFinances = finances.filter(finance => {
        const searchMatch = !search || (finance.keterangan?.toLowerCase().includes(search.toLowerCase()));
        const dateMatch = !filterMonth || finance.tanggal.startsWith(filterMonth);
        const typeMatch = filterType === 'all' || finance.tipe === filterType;
        return searchMatch && dateMatch && typeMatch;
    });

  // Perhitungan Laporan (berdasarkan data TERFILTER)
  const totalIncome = filteredFinances
    .filter(f => f.tipe === 'income')
    .reduce((sum, f) => sum + f.nominal, 0);

  const totalExpense = filteredFinances
    .filter(f => f.tipe === 'expense')
    .reduce((sum, f) => sum + f.nominal, 0);

  const balance = totalIncome - totalExpense;

  // LOGIKA PPH Final 0.5% dari Omzet (totalIncome DARI DATA TERFILTER)
  const pphFinalRate = 0.005;
  const omzetBulanIni = totalIncome; // Anggap filter bulan diterapkan
  const pphFinalAmount = omzetBulanIni * pphFinalRate;

  // Fungsi Cetak Laporan PDF
  const handlePrintReport = async () => {
        const reportElement = reportRef.current;
        if (!reportElement) return;

        toast({ title: 'Mencetak Laporan', description: 'Memproses PDF...' });

        try {
            const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: '#ffffff' }); // Latar belakang putih
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 190; // Lebar konten di A4 dengan margin 10mm kiri-kanan
            const pageHeight = 297; // Tinggi A4
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 10; // Margin atas 10mm

            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); // Margin kiri 10mm
            heightLeft -= (pageHeight - 20); // Kurangi tinggi 1 halaman A4 (dengan margin atas bawah 10mm)

            while (heightLeft > 0) { // Gunakan > 0 agar tidak membuat halaman kosong jika pas
              position = heightLeft - imgHeight - 10; // Atur posisi negatif untuk halaman berikutnya, tambah margin
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
              heightLeft -= (pageHeight - 20); // Kurangi lagi tinggi halaman
            }

            pdf.save(`Laporan_Keuangan_${filterMonth}.pdf`);
            toast({ title: 'Sukses', description: 'Laporan PDF berhasil dibuat.' });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            toast({ title: 'Error Cetak', description: 'Gagal membuat PDF.', variant: 'destructive' });
        }
    };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Keuangan</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFinance ? "Edit Transaksi" : "Tambah Transaksi Baru"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="tipe">Tipe</Label>
                  <Select
                    value={formData.tipe}
                    onValueChange={(value) => setFormData({ ...formData, tipe: value as FinanceType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="expense">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="kategori">Kategori</Label>
                  <Select
                    value={formData.kategori}
                    onValueChange={(value) => setFormData({ ...formData, kategori: value as FinanceCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendapatan">Pendapatan</SelectItem>
                      <SelectItem value="operasional">Operasional</SelectItem>
                      <SelectItem value="gaji">Gaji</SelectItem>
                      <SelectItem value="pajak">Pajak</SelectItem>
                      <SelectItem value="hosting">Hosting</SelectItem>
                      <SelectItem value="iklan">Iklan</SelectItem>
                      <SelectItem value="lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nominal">Nominal (Rp)</Label>
                  <Input
                    id="nominal"
                    type="number"
                    value={formData.nominal}
                    onChange={(e) => setFormData({ ...formData, nominal: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tanggal">Tanggal</Label>
                  <Input
                    id="tanggal"
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="keterangan">Keterangan</Label>
                  <Textarea
                    id="keterangan"
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingFinance ? "Update" : "Simpan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Area Laporan yang akan dicetak */}
        <div ref={reportRef} className="printable-area bg-white p-6 rounded-lg border">
            {/* Judul Laporan */}
            <h2 className="text-xl font-bold mb-4 text-center">
                Laporan Keuangan - Bulan {filterMonth.substring(5,7)} Tahun {filterMonth.substring(0,4)}
                {filterType !== 'all' && ` (${filterType})`}
            </h2>

            {/* METRIK KEUANGAN DAN PAJAK (Berdasarkan data terfilter) */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo Bersih</CardTitle>
                  <DollarSign className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(balance)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Simulasi PPh Final (0.5%)</CardTitle>
                  <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{formatCurrency(pphFinalAmount)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dari Omzet {formatCurrency(omzetBulanIni)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Card Riwayat Transaksi (Sekarang bagian dari area cetak) */}
            <Card className="shadow-none border-none"> {/* Hilangkan border/shadow bawaan card */}
              <CardHeader className="pt-0"> {/* Atur padding */}
                <CardTitle>Riwayat Transaksi (Bulan Ini)</CardTitle>
                 {/* Filter Inputs (Pindahkan ke luar div reportRef jika tidak ingin tercetak) */}
                <div className="flex gap-2 mt-4">
                    <Input
                      type="month"
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="max-w-xs"
                    />
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semua Tipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tipe</SelectItem>
                        <SelectItem value="income">Pemasukan</SelectItem>
                        <SelectItem value="expense">Pengeluaran</SelectItem>
                      </SelectContent>
                    </Select>
                     <Input
                          placeholder="Cari keterangan..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="flex-1" // Agar input search mengisi sisa ruang
                     />
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0"> {/* Atur padding */}
                {isLoading ? (
                  <p>Loading...</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Nominal</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead className="print-hide">Aksi</TableHead> {/* Sembunyikan saat cetak */}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFinances.map((finance) => (
                          <TableRow key={finance.id}>
                            <TableCell>{new Date(finance.tanggal).toLocaleDateString('id-ID')}</TableCell>
                            <TableCell>
                              <Badge className={finance.tipe === 'income' ? 'bg-green-500' : 'bg-red-500'}>
                                {finance.tipe === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                              </Badge>
                            </TableCell>
                            <TableCell>{finance.kategori}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(finance.nominal)}</TableCell>
                            <TableCell className="max-w-xs truncate">{finance.keterangan}</TableCell>
                            <TableCell className="print-hide"> {/* Sembunyikan saat cetak */}
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(finance)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteId(finance.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

             {/* Ringkasan Total di Akhir Laporan */}
             <div className="mt-6 border-t pt-4 text-right space-y-1">
                 <p>Total Pemasukan (Bulan Ini): <span className="font-semibold">{formatCurrency(totalIncome)}</span></p>
                 <p>Total Pengeluaran (Bulan Ini): <span className="font-semibold">{formatCurrency(totalExpense)}</span></p>
                 <p className="text-lg font-bold">Saldo Bersih (Bulan Ini): <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(balance)}</span></p>
             </div>
        </div>
        {/* Akhir Area Laporan Cetak */}

         {/* Tombol Cetak PDF (di luar area cetak) */}
         <div className="flex justify-end mt-4">
             <Button onClick={handlePrintReport} variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> Cetak Laporan PDF
             </Button>
        </div>


        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
              <AlertDialogDescription>
                Data transaksi ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {/* CSS untuk menyembunyikan elemen saat cetak */}
       <style jsx global>{`
          @media print {
            .print-hide {
              display: none !important;
            }
            .printable-area {
               border: none !important;
               padding: 0 !important;
               margin: 0 !important;
               background-color: white !important;
            }
            body {
                margin: 0;
            }
          }
       `}</style>
    </DashboardLayout>
  );
}