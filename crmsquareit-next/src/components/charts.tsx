"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart } from "recharts";

const fmt = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`);

export function RevenueChart({ data }: { data: { month: string; revenue: number; expenses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="#eef1f6" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tickFormatter={fmt} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} width={56} />
        <Tooltip
          formatter={(v, n) => [new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(v)), n === "revenue" ? "Payments received" : "Expenses"]}
          cursor={{ fill: "#f1f5f9" }}
          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar isAnimationActive={false} dataKey="revenue" fill="#4f74c4" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar isAnimationActive={false} dataKey="expenses" fill="#e84a37" radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.75} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie isAnimationActive={false} data={total ? data : [{ name: "none", value: 1, color: "#e2e8f0" }]} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={total ? 2 : 0} stroke="none">
              {(total ? data : [{ color: "#e2e8f0" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-ink">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate text-slate-600">{d.name}</span>
            <span className="font-semibold text-slate-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
