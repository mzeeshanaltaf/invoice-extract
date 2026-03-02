import { Skeleton } from "@/components/ui/skeleton";

export default function UploadLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
