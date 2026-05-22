import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  AlertCircle,
  Clock,
  Users,
  Activity,
  ShieldAlert,
} from "lucide-react";
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
  primary: "#6366f1",
  success: "#10b981",
  danger: "#f43f5e",
  warning: "#f59e0b",
  neutral: "#94a3b8",
};

const TOOLTIP_STYLE = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
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
        if (!response.ok)
          throw new Error("Nie udało się pobrać danych dashboardu");
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
        if (
          ["ticket_created", "ticket_updated", "notification_logged"].includes(
            msg.type,
          )
        ) {
          fetchDashboard();
        }
      } catch {
        /* ignore malformed */
      }
    };
    ws.onerror = () =>
      console.warn("Dashboard WS failed, falling back to polling.");

    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [onError]);

  // Filter trends to the selected time window
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
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 py-36 text-center flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-3 border-indigo-600 border-t-transparent mb-4" />
        <p className="text-xs text-slate-500 font-semibold tracking-wide">
          Ładowanie danych analitycznych...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-2xs">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-700">
          Nie udało się załadować danych
        </p>
      </div>
    );
  }

  const { metrics, agentPerformance, categoryBreakdown, priorityBreakdown } =
    data;

  const statusPieData = [
    { name: "Otwarte", value: metrics.openTickets, color: CHART.danger },
    {
      name: "W realizacji",
      value: metrics.inProgressTickets,
      color: CHART.warning,
    },
    {
      name: "Rozwiązane",
      value: metrics.resolvedTickets,
      color: CHART.success,
    },
    { name: "Zamknięte", value: metrics.closedTickets, color: CHART.neutral },
  ].filter((d) => d.value > 0);

  const priorityPieData = [
    {
      name: "Pilny",
      value: priorityBreakdown.find((p) => p.priority === "urgent")?.count ?? 0,
      color: CHART.danger,
    },
    {
      name: "Wysoki",
      value: priorityBreakdown.find((p) => p.priority === "high")?.count ?? 0,
      color: CHART.warning,
    },
    {
      name: "Średni",
      value: priorityBreakdown.find((p) => p.priority === "medium")?.count ?? 0,
      color: CHART.primary,
    },
    {
      name: "Niski",
      value: priorityBreakdown.find((p) => p.priority === "low")?.count ?? 0,
      color: CHART.neutral,
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Analityka i Raporty
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Metryki wydajności obsługi zgłoszeń w czasie rzeczywistym
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest shrink-0">
            Zakres:
          </span>
          {(
            [
              { key: "7d", label: "7 dni" },
              { key: "30d", label: "30 dni" },
              { key: "all", label: "Wszystko" },
            ] as const
          ).map((r) => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer select-none ${
                timeRange === r.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Metrics grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Wszystkie",
            value: metrics.totalTickets,
            color: "text-slate-900",
            icon: <Activity className="w-5 h-5 text-indigo-300" />,
            sub: null,
          },
          {
            label: "Otwarte",
            value: metrics.openTickets,
            color: metrics.openTickets > 0 ? "text-rose-600" : "text-slate-900",
            icon: <AlertCircle className="w-5 h-5 text-rose-300" />,
            sub: `${metrics.totalTickets > 0 ? Math.round((metrics.openTickets / metrics.totalTickets) * 100) : 0}% łącznie`,
          },
          {
            label: "W realizacji",
            value: metrics.inProgressTickets,
            color: "text-amber-600",
            icon: <TrendingUp className="w-5 h-5 text-amber-300" />,
            sub: `${metrics.totalTickets > 0 ? Math.round((metrics.inProgressTickets / metrics.totalTickets) * 100) : 0}% łącznie`,
          },
          {
            label: "Rozwiązane",
            value: metrics.resolvedTickets,
            color: "text-emerald-600",
            icon: <Activity className="w-5 h-5 text-emerald-300" />,
            sub: `${metrics.totalTickets > 0 ? Math.round((metrics.resolvedTickets / metrics.totalTickets) * 100) : 0}% ukończono`,
          },
          {
            label: "Śr. czas naprawy",
            value: `${metrics.avgResolutionTimeHours}h`,
            color: "text-indigo-600",
            icon: <Clock className="w-5 h-5 text-indigo-300" />,
            sub: "Czas do rozwiązania",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {card.label}
            </span>
            <div className="flex items-baseline justify-between mt-3">
              <span
                className={`text-3xl font-extrabold font-sans tracking-tight ${card.color}`}
              >
                {card.value}
              </span>
              {card.icon}
            </div>
            {card.sub && (
              <span className="text-[10px] text-slate-400 mt-1">
                {card.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row 1: Trends + Status pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trend line chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Wolumen zgłoszeń
            </span>
            {filteredTrends.length === 0 && (
              <span className="text-[9px] text-slate-400 font-medium">
                Brak danych dla wybranego zakresu
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={filteredTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval={Math.max(
                  0,
                  Math.floor(filteredTrends.length / 6) - 1,
                )}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="created"
                stroke={CHART.danger}
                name="Nowe"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke={CHART.success}
                name="Rozwiązane"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-4">
            Rozkład statusów
          </span>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                outerRadius={68}
                dataKey="value"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {statusPieData.map((d) => (
              <div
                key={d.name}
                className="flex justify-between items-center text-[10px]"
              >
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.name}
                </span>
                <span className="font-bold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row 2: Categories + Priority ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category bar chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-4">
            Zgłoszenia wg kategorii
          </span>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryBreakdown} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="category"
                tickFormatter={(v) => CATEGORY_LABELS[v] ?? v}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, n) => [v, "Zgłoszenia"]}
                labelFormatter={(l) => CATEGORY_LABELS[l] ?? l}
              />
              <Bar
                dataKey="count"
                fill={CHART.primary}
                name="Zgłoszenia"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                className="flex justify-between text-[10px]"
              >
                <span className="text-slate-600">
                  {CATEGORY_LABELS[cat.category] ?? cat.category}
                </span>
                <span className="font-bold text-slate-800">
                  {cat.count} ({cat.percentage}%) · śr.{" "}
                  {cat.avgResolutionTimeHours}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority pie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-4">
            Rozkład priorytetów
          </span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={priorityPieData}
                cx="50%"
                cy="50%"
                outerRadius={68}
                dataKey="value"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {priorityPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {priorityPieData.map((d) => (
              <div
                key={d.name}
                className="flex justify-between items-center text-[10px]"
              >
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.name}
                </span>
                <span className="font-bold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Agent performance table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            Wydajność agentów
          </span>
        </div>
        {agentPerformance.length === 0 ? (
          <p className="text-center py-10 text-xs text-slate-400 font-medium">
            Brak danych o agentach
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[
                    "Agent",
                    "Przypisane",
                    "Rozwiązane",
                    "Skuteczność",
                    "Śr. czas",
                    "Responsywność",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ${h === "Agent" ? "text-left" : "text-center"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((agent, i) => {
                  const rate =
                    agent.assignedTickets > 0
                      ? Math.round(
                          (agent.resolvedTickets / agent.assignedTickets) * 100,
                        )
                      : 0;
                  const rateBadge =
                    rate >= 80
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : rate >= 50
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200";
                  const respBadge =
                    agent.responseRatePercent >= 80
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";

                  return (
                    <tr
                      key={agent.agentId}
                      className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 !== 0 ? "bg-slate-50/30" : ""}`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {agent.agentName}
                      </td>
                      <td className="text-center py-3 px-4 text-slate-600">
                        {agent.assignedTickets}
                      </td>
                      <td className="text-center py-3 px-4 font-bold text-emerald-600">
                        {agent.resolvedTickets}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${rateBadge}`}
                        >
                          {rate}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-slate-600 font-mono">
                        {agent.avgResolutionTimeHours}h
                      </td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${respBadge}`}
                        >
                          {agent.responseRatePercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <p className="text-right text-[10px] text-slate-400 font-mono">
        Wygenerowano:{" "}
        <span title={new Date(data.generatedAt).toLocaleString("pl-PL")}>
          {timeAgo(data.generatedAt)}
        </span>
      </p>
    </div>
  );
}
