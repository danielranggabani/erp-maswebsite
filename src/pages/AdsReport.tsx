// src/pages/AdsReport.tsx

import DashboardLayout from '@/components/layout/DashboardLayout';
// --- Pastikan import ini benar ---
import { Button, buttonVariants } from '@/components/ui/button';
// --- Akhir import button ---
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, FileDown, Search, Loader2, AlertTriangle, LineChart, BarChart } from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { useRoles } from '@/hooks/useRoles';
import { format, getISOWeek, getMonth, getYear } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ResponsiveContainer, LineChart as RechartsLineChart, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Bar } from 'recharts';

// --- Tipe Data ---
type AdsReport = Database['public']['Tables']['ads_reports']['Row'];
type AdsReportInsert = Database['public']['Tables']['ads_reports']['Insert'];

// --- Helper Functions ---
const formatCurrency = (amount: number | null | undefined, digits = 0): string => {
    if (amount == null || isNaN(Number(amount))) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(amount));
};
const formatPercent = (value: number | null | undefined): string => {
    if (value == null || isNaN(Number(value))) return '-';
    return `${Number(value).toFixed(2)}%`;
};
const formatROAS = (value: number | null | undefined): string => {
    if (value == null || isNaN(Number(value))) return '-';
    return `${Number(value).toFixed(2)}x`;
};
const getWeekAndMonth = (dateString: string | Date): { week: number; month: string } => {
    const date = new Date(dateString);
    const week = getISOWeek(date);
    const month = format(date, 'MMMM yyyy', { locale: id });
    return { week, month };
};

// --- Initial Form Data ---
const initialFormData: Partial<AdsReportInsert> = {
    report_date: format(new Date(), 'yyyy-MM-dd'),
    revenue: 0,
    fee_payment: 0,
    ads_spend: 0,
    leads: 0,
    total_purchase: 0,
};

// --- Hooks Data & Mutasi ---
const useAdsReportData = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: reports = [], isLoading, error } = useQuery<AdsReport[], Error>({
        queryKey: ['adsReports'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ads_reports')
                .select('*')
                .order('report_date', { ascending: false });
            if (error) throw error;
            return data.map(r => ({
                ...r,
                revenue: Number(r.revenue),
                fee_payment: Number(r.fee_payment),
                net_revenue: Number(r.net_revenue),
                ads_spend: Number(r.ads_spend),
                tax_11: Number(r.tax_11),
                profit_loss: Number(r.profit_loss),
                roas: Number(r.roas),
                conv_percent: Number(r.conv_percent),
                cost_per_lead: Number(r.cost_per_lead),
                cost_per_purchase: Number(r.cost_per_purchase),
            })) as AdsReport[];
        },
    });

    const calculateAndPrepareData = (formData: Partial<AdsReportInsert>): AdsReportInsert | null => {
        if (!formData.report_date) {
            toast({ title: "Error", description: "Tanggal wajib diisi.", variant: "destructive" });
            return null;
        }
        const { week, month } = getWeekAndMonth(formData.report_date);
        const revenue = Number(formData.revenue || 0);
        const fee_payment = Number(formData.fee_payment || 0);
        const ads_spend = Number(formData.ads_spend || 0);
        const leads = Number(formData.leads || 0);
        const total_purchase = Number(formData.total_purchase || 0);
        const net_revenue = revenue - fee_payment; // Hitung net_revenue di sini

        if (revenue < 0 || fee_payment < 0 || ads_spend < 0 || leads < 0 || total_purchase < 0) {
             toast({ title: "Error", description: "Nilai input tidak boleh negatif.", variant: "destructive" });
             return null;
        }

        const dataToInsert: AdsReportInsert = {
            report_date: formData.report_date,
            revenue: revenue,
            fee_payment: fee_payment,
            net_revenue: net_revenue, // Kirim net_revenue agar kolom default bisa dihitung DB
            ads_spend: ads_spend,
            leads: leads,
            total_purchase: total_purchase,
            week: week,
            month: month,
            created_by: user?.id,
            // Kolom dengan DEFAULT di DB tidak perlu dikirim
        };
        return dataToInsert;
    }

    const createMutation = useMutation({
        mutationFn: async (formData: Partial<AdsReportInsert>) => {
            const preparedData = calculateAndPrepareData(formData);
            if (!preparedData) throw new Error("Data tidak valid.");
            const { error } = await supabase.from('ads_reports').insert(preparedData);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adsReports'] });
            toast({ title: "Sukses", description: "Laporan iklan berhasil ditambahkan." });
        },
        onError: (error: any) => {
            toast({ title: "Error Menyimpan", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, formData }: { id: string, formData: Partial<AdsReportInsert> }) => {
            const preparedData = calculateAndPrepareData(formData);
             if (!preparedData) throw new Error("Data tidak valid.");
             // Hanya kirim field yang bisa diedit + net_revenue
             const updateData = {
                report_date: preparedData.report_date,
                revenue: preparedData.revenue,
                fee_payment: preparedData.fee_payment,
                net_revenue: preparedData.net_revenue,
                ads_spend: preparedData.ads_spend,
                leads: preparedData.leads,
                total_purchase: preparedData.total_purchase,
                week: preparedData.week,
                month: preparedData.month,
             };
            const { error } = await supabase.from('ads_reports').update(updateData).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adsReports'] });
            toast({ title: "Sukses", description: "Laporan iklan berhasil diperbarui." });
        },
        onError: (error: any) => {
            toast({ title: "Error Update", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('ads_reports').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adsReports'] });
            toast({ title: "Sukses", description: "Laporan iklan berhasil dihapus." });
        },
        onError: (error: any) => {
            toast({ title: "Error Hapus", description: error.message, variant: "destructive" });
        },
    });

    return { reports, isLoading, error, createMutation, updateMutation, deleteMutation };
};

// --- Komponen Utama ---
export default function AdsReport() {
    const { toast } = useToast();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles();
    const { reports, isLoading, error, createMutation, updateMutation, deleteMutation } = useAdsReportData();
    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<AdsReport | null>(null);
    const [formData, setFormData] = useState<Partial<AdsReportInsert>>(initialFormData);
    const [reportToDelete, setReportToDelete] = useState<AdsReport | null>(null);
    const [filterMonth, setFilterMonth] = useState<string>('all');
    const [search, setSearch] = useState('');
    const pdfRef = useRef<HTMLDivElement>(null);

    const canEdit = useMemo(() => roles.includes('admin'), [roles]);
    const canView = useMemo(() => roles.includes('admin') || roles.includes('finance'), [roles]);

    useEffect(() => {
        if (!isDialogOpen) {
            setEditingReport(null);
            setFormData(initialFormData);
        }
    }, [isDialogOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        if (editingReport) {
            updateMutation.mutate({ id: editingReport.id, formData }, {
                onSuccess: () => setIsDialogOpen(false),
            });
        } else {
            createMutation.mutate(formData, {
                onSuccess: () => setIsDialogOpen(false),
            });
        }
    };

    const handleEdit = (report: AdsReport) => {
        setEditingReport(report);
        setFormData({
            report_date: report.report_date,
            revenue: report.revenue,
            fee_payment: report.fee_payment,
            ads_spend: report.ads_spend,
            leads: report.leads,
            total_purchase: report.total_purchase,
        });
        setIsDialogOpen(true);
    };

    const confirmDelete = (report: AdsReport) => setReportToDelete(report);
    const executeDelete = () => {
        if (reportToDelete) {
            deleteMutation.mutate(reportToDelete.id, {
                onSettled: () => setReportToDelete(null),
            });
        }
    };

    const availableMonths = useMemo(() => {
        const months = new Set(reports.map(r => r.month).filter(Boolean));
        return Array.from(months).sort((a, b) => {
             try { // Tambah try-catch untuk parsing tanggal
                 const dateA = new Date(a!.split(" ")[1], ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].indexOf(a!.split(" ")[0]));
                 const dateB = new Date(b!.split(" ")[1], ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].indexOf(b!.split(" ")[0]));
                 // Handle invalid dates
                 if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                 return dateB.getTime() - dateA.getTime();
             } catch (e) {
                 console.error("Error parsing month for sort:", a, b, e);
                 return 0; // Return 0 jika error parsing
             }
        });
    }, [reports]);

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const monthMatch = filterMonth === 'all' || r.month === filterMonth;
            const searchMatch = !search || r.report_date.includes(search);
            return monthMatch && searchMatch;
        });
    }, [reports, filterMonth, search]);

    const chartData = useMemo(() => {
        return [...filteredReports].sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
            .map(r => ({
                date: format(new Date(r.report_date), 'dd MMM', { locale: id }),
                Revenue: r.revenue,
                Spend: r.ads_spend,
                Profit: r.profit_loss ?? 0, // Default 0 jika null
                ROAS: r.roas ?? 0, // Default 0 jika null
                ConvRate: r.conv_percent ?? 0, // Default 0 jika null
            }));
    }, [filteredReports]);

    const summary = useMemo(() => {
        const count = filteredReports.length;
        if (count === 0) return { revenue: 0, spend: 0, profit: 0, roas: 0, convRate: 0, leads: 0, purchase: 0 };
        const totalRevenue = filteredReports.reduce((sum, r) => sum + r.revenue, 0);
        const totalSpend = filteredReports.reduce((sum, r) => sum + r.ads_spend, 0);
        // Hitung ulang profit dari data terfilter jika kolom generated null
        const totalProfit = filteredReports.reduce((sum, r) => sum + (r.profit_loss ?? (r.net_revenue - r.ads_spend - (r.net_revenue * 0.11))), 0);
        const totalLeads = filteredReports.reduce((sum, r) => sum + r.leads, 0);
        const totalPurchase = filteredReports.reduce((sum, r) => sum + r.total_purchase, 0);
        const avgRoas = totalSpend === 0 ? 0 : totalRevenue / totalSpend;
        const avgConvRate = totalLeads === 0 ? 0 : (totalPurchase / totalLeads) * 100;
        return { revenue: totalRevenue, spend: totalSpend, profit: totalProfit, roas: avgRoas, convRate: avgConvRate, leads: totalLeads, purchase: totalPurchase };
    }, [filteredReports]);

    const handleExportExcel = () => {
        if (filteredReports.length === 0) return toast({ title: "Info", description: "Tidak ada data." });
        const monthYear = filterMonth === 'all' ? 'SemuaData' : filterMonth.replace(' ', '_');
        const fileName = `AdsReport_${monthYear}.xlsx`;
        const exportData = filteredReports.map(r => ({
            Tanggal: r.report_date, Revenue: r.revenue, 'Fee Mgmt': r.fee_payment, 'Net Revenue': r.net_revenue,
            'Ads Spend': r.ads_spend, 'Pajak 11%': r.tax_11, 'Profit/Loss': r.profit_loss,
            ROAS: r.roas, Leads: r.leads, 'Total Purchase': r.total_purchase, 'Conv %': r.conv_percent,
            'Cost/Lead': r.cost_per_lead, 'Cost/Purchase': r.cost_per_purchase, Minggu: r.week, Bulan: r.month,
        }));
        exportData.push({});
        exportData.push({ Tanggal: 'TOTAL', Revenue: summary.revenue, 'Ads Spend': summary.spend, 'Profit/Loss': summary.profit, ROAS: summary.roas, Leads: summary.leads, 'Total Purchase': summary.purchase, 'Conv %': summary.convRate });
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.sheet_add_aoa(worksheet, [[`Laporan Iklan - ${filterMonth === 'all' ? 'Semua Periode' : filterMonth}`]], { origin: "A1" });
        worksheet['!cols'] = [ { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 15 } ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Ads Report");
        XLSX.writeFile(workbook, fileName);
        toast({ title: "Export Excel", description: `${fileName} didownload.` });
    };

    const handleExportPdf = async () => {
         if (!pdfRef.current || filteredReports.length === 0) return toast({ title: "Info", description: "Tidak ada data/area PDF." });
         const monthYear = filterMonth === 'all' ? 'SemuaData' : filterMonth.replace(' ', '_');
         const fileName = `AdsReport_${monthYear}.pdf`;
         const elementToCapture = pdfRef.current;
         toast({ title: "Export PDF", description: "Memproses..." });
         try {
             window.scrollTo(0, 0); await new Promise(resolve => setTimeout(resolve, 300));
             const canvas = await html2canvas(elementToCapture, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', ignoreElements: (el) => el.classList.contains('pdf-ignore') });
             const imgData = canvas.toDataURL('image/png');
             const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
             const pdfWidth = pdf.internal.pageSize.getWidth(), pdfHeight = pdf.internal.pageSize.getHeight();
             const imgWidth = pdfWidth - 20, imgHeight = (canvas.height * imgWidth) / canvas.width;
             let heightLeft = imgHeight, position = 10;
             pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); heightLeft -= (pdfHeight - 20);
             while (heightLeft > 0) { position = heightLeft - imgHeight - 10; pdf.addPage(); pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); heightLeft -= (pdfHeight - 20); }
             pdf.save(fileName); toast({ title: "Export PDF", description: `${fileName} didownload.` });
         } catch (error) { console.error("PDF Export Error:", error); toast({ title: "Error Export PDF", variant: "destructive" }); }
    };

    if (rolesLoading) return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;
    if (!canView) return <DashboardLayout><div className="container p-6 text-center text-red-600"><AlertTriangle /> Akses ditolak.</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header & Tombol Aksi */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                     <div>
                        <h2 className="text-3xl font-bold tracking-tight">Laporan Iklan (Meta Ads)</h2>
                        <p className="text-muted-foreground">Analisis performa iklan Facebook & Instagram.</p>
                    </div>
                    <div className="flex gap-2">
                        {canEdit && (
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Input Data Harian</Button></DialogTrigger>
                                <DialogContent className="max-w-xl">
                                     <DialogHeader>
                                        <DialogTitle>{editingReport ? 'Edit Laporan Harian' : 'Input Laporan Harian'}</DialogTitle>
                                        <DialogDescription>Masukkan data performa iklan untuk satu hari.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 py-4">
                                        <div className="space-y-2"> <Label htmlFor="report_date">Tanggal *</Label> <Input id="report_date" type="date" required value={formData.report_date || ''} onChange={(e) => setFormData({ ...formData, report_date: e.target.value })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="revenue">Revenue (Rp) *</Label> <Input id="revenue" type="number" required value={formData.revenue || 0} onChange={(e) => setFormData({ ...formData, revenue: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="fee_payment">Fee Payment (Rp)</Label> <Input id="fee_payment" type="number" value={formData.fee_payment || 0} onChange={(e) => setFormData({ ...formData, fee_payment: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="ads_spend">Ads Spend (Rp) *</Label> <Input id="ads_spend" type="number" required value={formData.ads_spend || 0} onChange={(e) => setFormData({ ...formData, ads_spend: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="leads">Leads *</Label> <Input id="leads" type="number" required value={formData.leads || 0} onChange={(e) => setFormData({ ...formData, leads: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="total_purchase">Total Purchase *</Label> <Input id="total_purchase" type="number" required value={formData.total_purchase || 0} onChange={(e) => setFormData({ ...formData, total_purchase: Number(e.target.value) })} /> </div>
                                         <DialogFooter className="col-span-2 mt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {editingReport ? 'Update Data' : 'Simpan Data'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || filteredReports.length === 0}><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
                        <Button variant="outline" onClick={handleExportPdf} disabled={isLoading || filteredReports.length === 0}><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
                    </div>
                </div>

                {/* Filter */}
                 <div className="flex items-center gap-4">
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter Bulan..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Bulan</SelectItem>
                            {availableMonths.map(month => <SelectItem key={month} value={month!}>{month}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>

                 {/* Ringkasan */}
                 <Card>
                    <CardHeader><CardTitle>Ringkasan Performa ({filterMonth === 'all' ? 'Semua Periode' : filterMonth})</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-4">
                         <div><Label>Total Revenue</Label><p className="text-xl font-bold">{formatCurrency(summary.revenue)}</p></div>
                         <div><Label>Total Ads Spend</Label><p className="text-xl font-bold">{formatCurrency(summary.spend)}</p></div>
                         <div><Label>Total Profit/Loss</Label><p className={`text-xl font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summary.profit)}</p></div>
                         <div><Label>Avg. ROAS</Label><p className="text-xl font-bold">{formatROAS(summary.roas)}</p></div>
                         <div><Label>Total Leads</Label><p className="text-xl font-bold">{summary.leads.toLocaleString('id-ID')}</p></div>
                         <div><Label>Total Purchase</Label><p className="text-xl font-bold">{summary.purchase.toLocaleString('id-ID')}</p></div>
                         <div><Label>Avg. Conv. Rate</Label><p className="text-xl font-bold">{formatPercent(summary.convRate)}</p></div>
                    </CardContent>
                 </Card>

                 {/* Grafik */}
                 <Card>
                    <CardHeader><CardTitle>Grafik Performa</CardTitle></CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="h-[300px]">
                             <Label className="text-sm text-muted-foreground">Revenue vs Spend vs Profit</Label>
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" fontSize={10} />
                                    <YAxis width={80} fontSize={10} tickFormatter={(val) => formatCurrency(val, 0)} />
                                    <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(val: number) => formatCurrency(val, 0)} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="Revenue" stroke="#22c55e" dot={false} strokeWidth={2}/>
                                    <Line type="monotone" dataKey="Spend" stroke="#ef4444" dot={false} strokeWidth={2}/>
                                    <Line type="monotone" dataKey="Profit" stroke="#3b82f6" dot={false} strokeWidth={2}/>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="h-[300px]">
                             <Label className="text-sm text-muted-foreground">ROAS & Conv. Rate</Label>
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" fontSize={10} />
                                    <YAxis yAxisId="left" width={50} fontSize={10} tickFormatter={(val) => formatROAS(val)} />
                                    <YAxis yAxisId="right" orientation="right" width={50} fontSize={10} tickFormatter={(val) => formatPercent(val)} />
                                    <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(value: number, name: string) => name === 'ROAS' ? formatROAS(value) : formatPercent(value)} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Line yAxisId="left" type="monotone" dataKey="ROAS" stroke="#8884d8" dot={false} strokeWidth={2}/>
                                    <Line yAxisId="right" type="monotone" dataKey="ConvRate" name="Conv. Rate (%)" stroke="#82ca9d" dot={false} strokeWidth={2}/>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                 </Card>

                {/* Tabel Data */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Laporan Harian</CardTitle>
                        <CardDescription>Detail performa iklan per hari.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* --- Perbaikan Ternary --- */}
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                        ) : error ? ( // Hapus '?'
                            <div className="text-red-600 text-center py-10">Error: {error.message}</div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Revenue</TableHead>
                                            <TableHead>Ad Spend</TableHead>
                                            <TableHead>Profit/Loss</TableHead>
                                            <TableHead>ROAS</TableHead>
                                            <TableHead>Leads</TableHead>
                                            <TableHead>Purchase</TableHead>
                                            <TableHead>Conv %</TableHead>
                                            <TableHead>CPL</TableHead>
                                            <TableHead>CPP</TableHead>
                                            {canEdit && <TableHead className="text-right">Aksi</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredReports.length === 0 ? (
                                            <TableRow><TableCell colSpan={canEdit ? 11 : 10} className="text-center h-24">Tidak ada data.</TableCell></TableRow>
                                        ) : (
                                            filteredReports.map(report => (
                                                <TableRow key={report.id}>
                                                    <TableCell>{format(new Date(report.report_date), 'dd MMM yyyy', { locale: id })}</TableCell>
                                                    <TableCell>{formatCurrency(report.revenue)}</TableCell>
                                                    <TableCell>{formatCurrency(report.ads_spend)}</TableCell>
                                                    {/* Gunakan nullish coalescing (??) untuk fallback jika null */}
                                                    <TableCell className={(report.profit_loss ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(report.profit_loss)}</TableCell>
                                                    <TableCell>{formatROAS(report.roas)}</TableCell>
                                                    <TableCell>{report.leads}</TableCell>
                                                    <TableCell>{report.total_purchase}</TableCell>
                                                    <TableCell>{formatPercent(report.conv_percent)}</TableCell>
                                                    <TableCell>{formatCurrency(report.cost_per_lead)}</TableCell>
                                                    <TableCell>{formatCurrency(report.cost_per_purchase)}</TableCell>
                                                    {canEdit && (
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(report)}><Edit className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => confirmDelete(report)}><Trash2 className="h-4 w-4" /></Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                         {/* --- Akhir Perbaikan Ternary --- */}
                    </CardContent>
                </Card>

                {/* Area PDF Export */}
                <div ref={pdfRef} className="pdf-export-area absolute -left-[9999px] -top-[9999px] bg-white p-10 w-[1123px]">
                     {/* ... Konten PDF Sama ... */}
                </div>

                 {/* AlertDialog Hapus */}
                 <AlertDialog open={!!reportToDelete} onOpenChange={() => setReportToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Laporan Iklan?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Yakin hapus data laporan tanggal {reportToDelete ? format(new Date(reportToDelete.report_date), 'dd MMMM yyyy', { locale: id }) : ''}?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={executeDelete}
                                disabled={deleteMutation.isPending}
                                className={buttonVariants({ variant: "destructive" })} // Membutuhkan import
                            >
                                {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Data'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}