export default function DashboardLoading() {
  return (
    <div className="min-h-full bg-[#F5F5F5] p-4 sm:p-6" aria-busy="true">
      <div className="h-16 animate-pulse rounded-lg bg-white" />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-44 animate-pulse rounded-lg bg-white" />
        <div className="h-44 animate-pulse rounded-lg bg-white" />
        <div className="h-44 animate-pulse rounded-lg bg-white" />
      </div>
      <div className="mt-4 h-72 animate-pulse rounded-lg bg-white" />
    </div>
  )
}
