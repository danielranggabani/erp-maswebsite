import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Save, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];

// Simulasi fungsi upload ke Supabase Storage
// Anda perlu mengganti ini dengan implementasi Supabase Storage yang sebenarnya
const uploadFileToSupabase = async (file: File, path: string): Promise<string> => {
  // Batas ukuran file 3MB
  const MAX_SIZE = 3 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("Ukuran file tidak boleh lebih dari 3MB.");
  }
  
  // Contoh path: 'company/logo/timestamp_filename.png'
  const filePath = `${path}/${Date.now()}_${file.name}`;

  // --- START: Ganti dengan logika Supabase Storage yang sebenarnya ---
  console.log(`[SIMULASI UPLOAD]: Mengunggah ${file.name} ke ${filePath}`);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulasi delay
  // const { data, error } = await supabase.storage.from('documents').upload(filePath, file);
  // if (error) throw error;
  // const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path);
  // return publicUrlData.publicUrl;
  // --- END: Ganti dengan logika Supabase Storage yang sebenarnya ---

  return `https://mock-storage.com/${filePath}`; 
};

export default function Settings() {
  const [formData, setFormData] = useState<Partial<CompanyInsert>>({
    nama: "",
    npwp: "",
    alamat: "",
    rekening: "",
    logo_url: "",
    signature_url: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as Company | null;
    }
  });

  useEffect(() => {
    if (company) {
      setFormData({
        nama: company.nama,
        npwp: company.npwp || "",
        alamat: company.alamat || "",
        rekening: company.rekening || "",
        logo_url: company.logo_url || "",
        signature_url: company.signature_url || ""
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<CompanyInsert>) => {
      if (company?.id) {
        const { data, error } = await supabase
          .from('companies')
          .update(updates)
          .eq('id', company.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('companies')
          .insert(updates)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast({ title: "Pengaturan berhasil disimpan" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };
  
  // Handler untuk Logo Upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const url = await uploadFileToSupabase(file, 'company/logo');
        setFormData(prev => ({ ...prev, logo_url: url }));
        toast({ title: "Upload Berhasil", description: "Logo berhasil diunggah dan disimpan di formulir." });
      } catch (error: any) {
        toast({ title: "Error Upload", description: error.message, variant: "destructive" });
      }
    }
  };

  // Handler untuk Tanda Tangan Upload
  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const url = await uploadFileToSupabase(file, 'company/signature');
        setFormData(prev => ({ ...prev, signature_url: url }));
        toast({ title: "Upload Berhasil", description: "Tanda tangan berhasil diunggah dan disimpan di formulir." });
      } catch (error: any) {
        toast({ title: "Error Upload", description: error.message, variant: "destructive" });
      }
    }
  };


  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Pengaturan</h1>
          <p>Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Pengaturan Perusahaan</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Perusahaan</CardTitle>
            <CardDescription>
              Data perusahaan akan digunakan di SPK dan Invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nama">Nama Perusahaan</Label>
                <Input
                  id="nama"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="npwp">NPWP</Label>
                <Input
                  id="npwp"
                  value={formData.npwp || ''}
                  onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                  placeholder="00.000.000.0-000.000"
                />
              </div>

              <div>
                <Label htmlFor="alamat">Alamat</Label>
                <Textarea
                  id="alamat"
                  value={formData.alamat || ''}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="rekening">Nomor Rekening</Label>
                <Input
                  id="rekening"
                  value={formData.rekening || ''}
                  onChange={(e) => setFormData({ ...formData, rekening: e.target.value })}
                  placeholder="Bank BCA - 1234567890 a.n. PT Example"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* LOGIKA UPLOAD FILE BARU */}
        <Card>
          <CardHeader>
            <CardTitle>Logo & Tanda Tangan</CardTitle>
            <CardDescription>
              Upload logo (max 3MB) dan tanda tangan digital (.png transparan, max 3MB) untuk SPK dan Invoice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* LOGO UPLOAD */}
              <div className="space-y-2">
                <Label htmlFor="logo_upload">Logo Perusahaan (.png/.jpg)</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="logo_upload" 
                    type="file" 
                    accept="image/png,image/jpeg" 
                    onChange={handleLogoUpload}
                    className="flex-1"
                  />
                  {formData.logo_url && (
                    <a href={formData.logo_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon" type="button" title="Lihat Logo Terunggah">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  URL Tersimpan: {formData.logo_url || 'Belum ada'}
                </p>
              </div>

              {/* TANDA TANGAN UPLOAD */}
              <div className="space-y-2">
                <Label htmlFor="signature_upload">Tanda Tangan Digital (.png transparan)</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="signature_upload" 
                    type="file" 
                    accept="image/png" 
                    onChange={handleSignatureUpload}
                    className="flex-1"
                  />
                  {formData.signature_url && (
                    <a href={formData.signature_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon" type="button" title="Lihat Tanda Tangan Terunggah">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  URL Tersimpan: {formData.signature_url || 'Belum ada'}
                </p>
              </div>
              
              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan URL Perubahan"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}