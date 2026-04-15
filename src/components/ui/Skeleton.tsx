export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-[#232640] ${className ?? ""}`} />;
}
