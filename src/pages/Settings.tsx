import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type Company = Database['public']['Tables']['companies']['Row'];

export default function Settings() {
  const [formData, setFormData] = useState<Partial<Company>>({
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
    mutationFn: async (updates: any) => {
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
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
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
      <div className="space-y-6">
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
                  value={formData.npwp}
                  onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                  placeholder="00.000.000.0-000.000"
                />
              </div>

              <div>
                <Label htmlFor="alamat">Alamat</Label>
                <Textarea
                  id="alamat"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="rekening">Nomor Rekening</Label>
                <Input
                  id="rekening"
                  value={formData.rekening}
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

        <Card>
          <CardHeader>
            <CardTitle>Logo & Tanda Tangan</CardTitle>
            <CardDescription>
              Upload logo dan tanda tangan digital untuk SPK (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Logo Perusahaan (.png/.jpg)</Label>
                <Input type="file" accept="image/png,image/jpeg" disabled />
                <p className="text-sm text-muted-foreground mt-1">
                  Fitur upload akan segera tersedia
                </p>
              </div>
              <div>
                <Label>Tanda Tangan Digital (.png transparan)</Label>
                <Input type="file" accept="image/png" disabled />
                <p className="text-sm text-muted-foreground mt-1">
                  Fitur upload akan segera tersedia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
