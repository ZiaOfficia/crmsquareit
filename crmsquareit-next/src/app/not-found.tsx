import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-extrabold text-slate-200">404</p>
      <p className="mt-2 font-semibold text-slate-700">Page not found</p>
      <Link href="/admin" className="link mt-4 text-sm">Go to dashboard</Link>
    </div>
  );
}
