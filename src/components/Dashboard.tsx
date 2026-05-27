import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, AlertCircle, Clock, Users, Activity, ShieldAlert } from "lucide-react";
import { DashboardData } from "../types";
import { timeAgo } from "../utils/timeAgo";

interface DashboardProps {
  onError: (message: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  hardware: "Sprzęt",
  software: "Oprogramowanie",
  network: "Sieć/VPN",
  access: "Uprawnienia",
  other: "Inne",
};

const CHART = {
  primary: "#818cf8",
  success: "#34d399",
  danger: "#fb7185",
  warning: "#fbbf24",
  neutral: "#64748b",
};

const TOOLTIP_STYLE = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.06)",
  backgroundColor: "rgba(13,13,20,0.95)",
  color: "rgba(255,255,255,0.7)",
};

export default function Dashboard({ onError }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/dashboard");
        if (!response.ok) throw new Error("Nie udało się pobrać danych dashboardu");
        setData(await response.json());
      } catch (err) {
        onError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (["ticket_created", "ticket_updated", "notification_logged"].includes(msg.type)) {
          fetchDashboard();
        }
      } catch { /* ignore malformed */ }
    };
    ws.onerror = () => console.warn("Dashboard WS failed, falling back to polling.");

    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => { ws.close(); clearInterval(interval); };
  }, [onError]);

  const filteredTrends = useMemo(() => {
    if (!data) return [];
    if (timeRange === "all") return data.trends;
    const days = timeRange === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.trends.filter((t) => new Date(t.date) >= cutoff);
  }, [data, timeRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs text-white/30 uppercase tracking-widest">Ładowanie analityki...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-14 text-center">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <p className="text-sm font-bold text-white/60">Nie udało się załadować danych</p>
      </div>
    );
  }

  const { metrics, agentPerformance, categoryBreakdown, priorityBreakdown } = data;

  const statusPieData = [
    { name: "Otwarte", value: metrics.openTickets, color: CHART.danger },
    { name: "W realizacji", value: metrics.inProgressTickets, color: CHART.warning },
    { name: "Rozwiązane", value: metrics.resolvedTickets, color: CHART.success },
    { name: "Zamknięte", value: metrics.closedTickets, color: CHART.neutral },
  ].filter((d) => d.value > 0);

  const priorityPieData = [
    { name: "Pilny", value: priorityBreakdown.find((p) => p.priority === "urgent")?.count ?? 0, color: CHART.danger },
    { name: "Wysoki", value: priorityBreakdown.find((p) => p.priority === "high")?.count ?? 0, color: CHART.warning },
    { name: "Średni", value: priorityBreakdown.find((p) => p.priority === "medium")?.count ?? 0, color: CHART.primary },
    { name: "Niski", value: priorityBreakdown.find((p) => p.priority === "low")?.count ?? 0, color: CHART.neutral },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Analityka i Raporty</h2>
          <p className="text-[10px] text-white/25 mt-1">Metryki wydajności w czasie rzeczywistym</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mr-1">Zakres:</span>
          {([{ key: "7d", label: "7 dni" }, { key: "30d", label: "30 dni" }, { key: "all", label: "Wszystko" }] as const).map((r) => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer select-none ${
                timeRange === r.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20"
                  : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-indigo-500/30 hover:text-indigo-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Wszystkie", value: metrics.totalTickets, accent: "from-white/40 to-white/20", icon: <Activity className="w-4 h-4 text-indigo-400" /> },
          { label: "Otwarte", value: metrics.openTickets, accent: metrics.openTickets > 0 ? "from-rose-400 to-pink-400" : "from-white/40 to-white/20", icon: <AlertCircle className="w-4 h-4 text-rose-400" /> },
          { label: "W realizacji", value: metrics.inProgressTickets, accent: "from-amber-400 to-orange-400", icon: <TrendingUp className="w-4 h-4 text-amber-400" /> },
          { label: "Rozwiązane", value: metrics.resolvedTickets, accent: "from-emerald-400 to-teal-400", icon: <Activity className="w-4 h-4 text-emerald-400" /> },
          { label: "Śr. czas naprawy", value: `${metrics.avgResolutionTimeHours}h`, accent: "from-indigo-400 to-violet-400", icon: <Clock className="w-4 h-4 text-indigo-400" /> },
        ].map((card) => (
          <div key={card.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between hover:border-white/10 transition-all">
            <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em]">{card.label}</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-extrabold tracking-tight bg-gradient-to-r ${card.accent} bg-clip-text text-transparent`}>{card.value}</span>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend line chart */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] block mb-4">Trend zgłoszeń</span>
          {filteredTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={filteredTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }} />
                <Line type="monotone" dataKey="created" name="Utworzone" stroke={CHART.primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" name="Rozwiązane" stroke={CHART.success} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[10px] text-white/20 text-center py-10">Brak danych trendów</p>
          )}
        </div>

        {/* Status pie */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] block mb-4">Status</span>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusPieData.map((entry, idx) => (<Cell key={idx} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[10px] text-white/20 text-center py-10">Brak danych</p>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category breakdown */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] block mb-4">Kategorie</span>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryBreakdown.map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] || c.category }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} />
              <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Zgłoszenia" fill={CHART.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority pie */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] block mb-4">Priorytety</span>
          {priorityPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={priorityPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {priorityPieData.map((entry, idx) => (<Cell key={idx} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[10px] text-white/20 text-center py-10">Brak danych</p>
          )}
        </div>
      </div>

      {/* Agent performance */}
      {agentPerformance.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] block mb-4">Wydajność agentów</span>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 text-[9px] font-bold text-white/25 uppercase tracking-widest">Agent</th>
                  <th className="text-center py-2 text-[9px] font-bold text-white/25 uppercase tracking-widest">Przypisane</th>
                  <th className="text-center py-2 text-[9px] font-bold text-white/25 uppercase tracking-widest">Rozwiązane</th>
                  <th className="text-center py-2 text-[9px] font-bold text-white/25 uppercase tracking-widest">Śr. czas (h)</th>
                  <th className="text-center py-2 text-[9px] font-bold text-white/25 uppercase tracking-widest">Odpowiedzi %</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((agent) => (
                  <tr key={agent.agentId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 text-white/60 font-semibold">{agent.agentName}</td>
                    <td className="py-2.5 text-center text-white/40 font-mono">{agent.assignedTickets}</td>
                    <td className="py-2.5 text-center text-emerald-400 font-mono">{agent.resolvedTickets}</td>
                    <td className="py-2.5 text-center text-white/40 font-mono">{agent.avgResolutionTimeHours}</td>
                    <td className="py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        agent.responseRatePercent >= 80
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : agent.responseRatePercent >= 50
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {agent.responseRatePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[9px] text-white/15 font-mono">
        Wygenerowano: {timeAgo(data.generatedAt)}
      </div>
    </div>
  );
}
