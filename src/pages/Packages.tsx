import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Check, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/integrations/supabase/types';

type Package = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];

export default function Packages() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState({
    nama: '',
    harga: '',
    deskripsi: '',
    fitur: '',
    estimasi_hari: '',
    is_active: true,
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const packageData: PackageInsert = {
        nama: formData.nama,
        harga: parseFloat(formData.harga),
        deskripsi: formData.deskripsi || null,
        fitur: formData.fitur ? JSON.parse(formData.fitur) : null,
        estimasi_hari: formData.estimasi_hari ? parseInt(formData.estimasi_hari) : null,
        is_active: formData.is_active,
      };

      if (editingPackage) {
        const { error } = await supabase
          .from('packages')
          .update(packageData)
          .eq('id', editingPackage.id);
        if (error) throw error;
        toast({ title: 'Package updated successfully' });
      } else {
        const { error } = await supabase.from('packages').insert(packageData);
        if (error) throw error;
        toast({ title: 'Package created successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      const { error } = await supabase.from('packages').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Package deleted successfully' });
      fetchPackages();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
      fitur: pkg.fitur ? JSON.stringify(pkg.fitur, null, 2) : '',
      estimasi_hari: pkg.estimasi_hari?.toString() || '',
      is_active: pkg.is_active || true,
    });
    setDialogOpen(true);
  };

  const parseFitur = (fitur: any): string[] => {
    if (Array.isArray(fitur)) return fitur;
    if (typeof fitur === 'string') return [fitur];
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
                    placeholder='["Feature 1", "Feature 2", "Feature 3"]'
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimasi_hari">Estimated Days</Label>
                  <Input
                    id="estimasi_hari"
                    type="number"
                    value={formData.estimasi_hari}
                    onChange={(e) => setFormData({ ...formData, estimasi_hari: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active Package</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPackage ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {loading ? (
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
                        Rp {pkg.harga.toLocaleString('id-ID')}
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
                        <li key={idx} className="flex items-center text-sm">
                          <Check className="mr-2 h-4 w-4 text-primary" />
                          {feature}
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
