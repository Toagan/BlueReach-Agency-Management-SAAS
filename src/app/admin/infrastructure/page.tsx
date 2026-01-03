import { Suspense } from "react";
import InfrastructureView from "./infrastructure-view";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InfrastructurePage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <Suspense fallback={<InfrastructureLoadingSkeleton />}>
      <InfrastructureView searchParams={params} />
    </Suspense>
  );
}

function InfrastructureLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-4 w-40 bg-muted animate-pulse rounded mb-2" />
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-1" />
        <div className="h-4 w-80 bg-muted animate-pulse rounded" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border rounded-lg p-6">
            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
