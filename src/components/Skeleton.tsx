export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-paper/10 rounded ${className}`} />;
}

export function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 gap-3 py-3 px-2">
      <Skeleton className="col-span-3 h-3" />
      <Skeleton className="col-span-4 h-3" />
      <Skeleton className="col-span-2 h-3" />
      <Skeleton className="col-span-3 h-3" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="boarding rounded-md p-6 space-y-3">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
