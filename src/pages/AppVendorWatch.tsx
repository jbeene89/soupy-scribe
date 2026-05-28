import { VendorWatchModule } from '@/components/vendor-watch/VendorWatchModule';
import { VendorPortfolio } from '@/pages/AppOpsCenter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileSearch, BarChart3 } from 'lucide-react';

export default function AppVendorWatch() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Tabs defaultValue="intake" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="intake"><FileSearch className="h-3.5 w-3.5 mr-1.5" />Document intake &amp; findings</TabsTrigger>
          <TabsTrigger value="portfolio"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Vendor portfolio</TabsTrigger>
        </TabsList>
        <TabsContent value="intake"><VendorWatchModule /></TabsContent>
        <TabsContent value="portfolio"><VendorPortfolio /></TabsContent>
      </Tabs>
    </div>
  );
}