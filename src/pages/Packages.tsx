import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Check } from 'lucide-react';

export default function Packages() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Packages</h2>
            <p className="text-muted-foreground">
              Manage website packages and pricing
            </p>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Package
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Package Template Cards */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <Badge className="w-fit mb-2">Basic</Badge>
              <CardTitle className="text-2xl">Rp 5.000.000</CardTitle>
              <CardDescription>Perfect for small businesses</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">5 Pages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Responsive Design</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">1 Month Support</span>
                </li>
              </ul>
              <Button className="w-full mt-4" variant="outline">Edit Package</Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-primary">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg">
              Popular
            </div>
            <CardHeader>
              <Badge className="w-fit mb-2">Business</Badge>
              <CardTitle className="text-2xl">Rp 12.000.000</CardTitle>
              <CardDescription>For growing companies</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">10 Pages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Advanced Features</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">3 Months Support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">SEO Optimization</span>
                </li>
              </ul>
              <Button className="w-full mt-4" variant="outline">Edit Package</Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader>
              <Badge className="w-fit mb-2">Premium</Badge>
              <CardTitle className="text-2xl">Rp 25.000.000</CardTitle>
              <CardDescription>Enterprise solution</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Unlimited Pages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Custom Development</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">6 Months Support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">Full SEO & Marketing</span>
                </li>
              </ul>
              <Button className="w-full mt-4" variant="outline">Edit Package</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
