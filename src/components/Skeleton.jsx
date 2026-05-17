const Skeleton = ({ className }) => {
  return (
    <div className={`animate-pulse bg-white/5 rounded-2xl ${className}`}></div>
  );
};

export const ProjectSkeleton = () => (
  <div className="glass rounded-3xl overflow-hidden border-white/5">
    <Skeleton className="aspect-video" />
    <div className="p-8 space-y-4">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full opacity-50" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-12 rounded-md" />
        <Skeleton className="h-6 w-12 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  </div>
);

export default Skeleton;
