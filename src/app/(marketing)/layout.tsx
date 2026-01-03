import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <MarketingHeader />
      <main className="pt-16 lg:pt-20">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
