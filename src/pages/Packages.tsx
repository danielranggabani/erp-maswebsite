import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Check, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/integrations/supabase/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 

type Package = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
};

// ======================= DATA HOOK =======================
const usePackageData = () => {
    return useQuery({
        queryKey: ['packages'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('packages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Package[];
        },
    });
}
// =========================================================


export default function Packages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: packages = [], isLoading } = usePackageData();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  
  const [formData, setFormData] = useState({
    nama: '',
    harga: '',
    deskripsi: '',
    fitur: '', // JSON string representation
    estimasi_hari: '',
    is_active: true,
  });

  const packageMutation = useMutation({
    mutationFn: async (data: PackageInsert & { id?: string }) => {
        const packageData: PackageInsert = {
            nama: data.nama,
            harga: parseFloat(data.harga.toString()),
            deskripsi: data.deskripsi || null,
            // Penting: Parse string JSON dari textarea
            fitur: data.fitur ? JSON.parse(data.fitur.toString()) : null, 
            estimasi_hari: data.estimasi_hari ? parseInt(data.estimasi_hari.toString()) : null,
            is_active: data.is_active,
        };

        if (data.id) {
            const { error } = await supabase
                .from('packages')
                .update(packageData)
                .eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('packages').insert(packageData);
            if (error) throw error;
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['packages'] });
        queryClient.invalidateQueries({ queryKey: ['packages-active'] }); // Invalidate list aktif
        toast({ title: editingPackage ? 'Package updated successfully' : 'Package created successfully' });
        setDialogOpen(false);
        resetForm();
    },
    onError: (error: any) => {
        toast({ 
            title: 'Error', 
            description: `Gagal menyimpan paket. Pastikan format Fitur adalah JSON array: ["f1", "f2"]. Detail: ${error.message}`, 
            variant: 'destructive' 
        });
    }
  });

  const handleDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages-active'] });
      toast({ title: 'Package deleted successfully' });
    },
    onError: (error: any) => {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parseFloat(formData.harga)) || parseFloat(formData.harga) <= 0) {
        toast({ title: 'Error', description: 'Harga harus berupa angka positif.', variant: 'destructive' });
        return;
    }
    
    // Kirim data, termasuk ID jika sedang mengedit
    packageMutation.mutate({ ...formData, id: editingPackage?.id });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this package?')) {
      handleDeleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({
      nama: '',
      harga: '',
      deskripsi: '',
      fitur: '',
      estimasi_hari: '',
      is_active: true,
    });
    setEditingPackage(null);
  };

  const openEditDialog = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormData({
      nama: pkg.nama,
      harga: pkg.harga.toString(),
      deskripsi: pkg.deskripsi || '',
      // Penting: Ubah JSON object menjadi string berformat untuk diedit di textarea
      fitur: pkg.fitur ? JSON.stringify(pkg.fitur, null, 2) : '[]',
      estimasi_hari: pkg.estimasi_hari?.toString() || '',
      is_active: pkg.is_active || true,
    });
    setDialogOpen(true);
  };

  // Utility untuk mem-parsing JSON fitur menjadi array string untuk display
  const parseFitur = (fitur: any): string[] => {
    if (Array.isArray(fitur)) return fitur.map(f => String(f));
    if (typeof fitur === 'string') {
        try {
            const parsed = JSON.parse(fitur);
            if (Array.isArray(parsed)) return parsed.map(f => String(f));
        } catch (e) {
            // Fallback jika string bukan JSON valid
        }
    }
    return [];
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Packages</h2>
            <p className="text-muted-foreground">
              Manage website package offerings
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nama">Package Name</Label>
                    <Input
                      id="nama"
                      value={formData.nama}
                      onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="harga">Price (Rp)</Label>
                    <Input
                      id="harga"
                      type="number"
                      value={formData.harga}
                      onChange={(e) => setFormData({ ...formData, harga: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deskripsi">Description</Label>
                  <Textarea
                    id="deskripsi"
                    value={formData.deskripsi}
                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitur">Features (JSON array)</Label>
                  <Textarea
                    id="fitur"
                    value={formData.fitur}
                    onChange={(e) => setFormData({ ...formData, fitur: e.target.value })}
                    placeholder='["Fitur 1", "Fitur 2", "Fitur 3"]'
                    rows={4}
                  />
                  <p className='text-xs text-muted-foreground'>* Pastikan formatnya adalah JSON Array yang valid.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimasi_hari">Estimated Days</Label>
                      <Input
                        id="estimasi_hari"
                        type="number"
                        value={formData.estimasi_hari}
                        onChange={(e) => setFormData({ ...formData, estimasi_hari: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active Package</Label>
                    </div>
                </div>
                
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={packageMutation.isPending}>
                        {packageMutation.isPending ? 'Processing...' : (editingPackage ? 'Update' : 'Create')}
                    </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {isLoading ? (
            <p>Loading packages...</p>
          ) : packages.length === 0 ? (
            <p className="col-span-3 text-center text-muted-foreground">No packages yet.</p>
          ) : (
            packages.map((pkg) => (
              <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{pkg.nama}</CardTitle>
                      <CardDescription className="mt-2">
                        {formatCurrency(Number(pkg.harga))}
                      </CardDescription>
                    </div>
                    <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{pkg.deskripsi}</p>
                  {pkg.estimasi_hari && (
                    <p className="text-sm">
                      <strong>Estimation:</strong> {pkg.estimasi_hari} days
                    </p>
                  )}
                  {pkg.fitur && (
                    <ul className="space-y-2">
                      {parseFitur(pkg.fitur).map((feature, idx) => (
                        <li key={idx} className="flex items-start text-sm">
                          <Check className="mr-2 h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className='flex-1'>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 pt-4">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(pkg)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(pkg.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}