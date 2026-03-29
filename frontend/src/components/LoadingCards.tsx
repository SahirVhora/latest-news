function SkeletonCard() {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-4 w-16" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-3/5" />
      </div>
      <div className="space-y-1.5 pl-2 border-l-2 border-navy-800">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-11/12" />
        <div className="skeleton h-3 w-3/4" />
      </div>
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex gap-3">
          <div className="skeleton h-3 w-10" />
          <div className="skeleton h-3 w-10" />
        </div>
        <div className="skeleton h-3 w-12" />
      </div>
    </div>
  );
}

export function LoadingCards() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
