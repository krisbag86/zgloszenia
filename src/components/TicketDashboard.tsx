import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketMessage,
  UserRole,
} from "../types";
import { STORE_LOCATIONS } from "../data/stores";
import { timeAgo } from "../utils/timeAgo";
import {
  Search,
  Filter,
  Clock,
  User,
  CheckCircle,
  ShieldAlert,
  AlertCircle,
  MessageSquare,
  Send,
  Tag,
  ChevronRight,
  FileCode,
  CheckCircle2,
  UserCheck,
  Download,
  Eye,
  Lock,
  MapPin,
  Mail,
  Home,
  X,
  ArrowUpDown,
  Zap,
  Activity,
} from "lucide-react";

interface TicketDashboardProps {
  tickets: Ticket[];
  currentUser: { id: string; name: string; role: UserRole; email: string };
  onUpdateStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  onUpdatePriority: (ticketId: string, priority: TicketPriority) => Promise<void>;
  onAssignTicket: (ticketId: string, agentId: string, agentName: string) => Promise<void>;
  onPostMessage: (ticketId: string, messageText: string, isInternal: boolean) => Promise<void>;
  supportEngineers: { id: string; name: string }[];
}

export default function TicketDashboard({
  tickets,
  currentUser,
  onUpdateStatus,
  onUpdatePriority,
  onAssignTicket,
  onPostMessage,
  supportEngineers,
}: TicketDashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id || null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "priority" | "status">("date_desc");
  const [replyText, setReplyText] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [lastSeen, setLastSeen] = useState<Record<string, number>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, Date.now()])),
  );

  const searchRef = useRef<HTMLInputElement>(null);
  const filteredTicketsRef = useRef<Ticket[]>([]);
  const selectedIdRef = useRef(selectedId);

  const activeTicket = useMemo(() => tickets.find((t) => t.id === selectedId) || null, [tickets, selectedId]);

  const uniqueLocations = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.location).filter((l): l is string => !!l))).sort(),
    [tickets],
  );

  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || locationFilter !== "all" || searchTerm !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setLocationFilter("all");
    setSearchTerm("");
  };

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        if (currentUser.role === "client" && t.clientId !== currentUser.id) return false;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          t.title.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.id.toLowerCase().includes(searchLower) ||
          t.clientName.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
        if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
        if (locationFilter !== "all" && t.location !== locationFilter) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "date_asc":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "priority":
            return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
          case "status":
            return (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
          case "date_desc":
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [tickets, currentUser, searchTerm, statusFilter, priorityFilter, categoryFilter, locationFilter, sortBy]);

  useEffect(() => {
    if (selectedId) {
      setLastSeen((prev) => ({ ...prev, [selectedId]: Date.now() }));
      selectedIdRef.current = selectedId;
    }
  }, [selectedId]);

  useEffect(() => {
    filteredTicketsRef.current = filteredTickets;
  }, [filteredTickets]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !isTyping) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "Escape" && document.activeElement === searchRef.current) { setSearchTerm(""); searchRef.current?.blur(); return; }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isTyping) {
        e.preventDefault();
        const list = filteredTicketsRef.current;
        const idx = list.findIndex((t) => t.id === selectedIdRef.current);
        const next = e.key === "ArrowDown" ? list[Math.min(idx + 1, list.length - 1)] : list[Math.max(idx - 1, 0)];
        if (next) setSelectedId(next.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const displayTicket = useMemo(() => {
    if (activeTicket && filteredTickets.find((t) => t.id === activeTicket.id)) return activeTicket;
    return filteredTickets[0] || null;
  }, [filteredTickets, activeTicket]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !displayTicket) return;
    setSubmittingReply(true);
    try {
      await onPostMessage(displayTicket.id, replyText, internalNote);
      setReplyText("");
      setInternalNote(false);
    } catch (err) {
      console.error("Failed to post reply message:", err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      hardware: "Sprzęt",
      software: "Oprogramowanie",
      network: "Sieć / VPN",
      access: "Uprawnienia",
    };
    return map[cat] || "Inne";
  };

  const getPriorityBadge = (prio: string) => {
    const styles: Record<string, string> = {
      urgent: "bg-rose-500/15 text-rose-400 border-rose-500/20",
      high: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      medium: "bg-sky-500/15 text-sky-400 border-sky-500/20",
      low: "bg-white/5 text-white/40 border-white/10",
    };
    const labels: Record<string, string> = { urgent: "Pilny", high: "Wysoki", medium: "Średni", low: "Niski" };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[prio] || styles.low}`}>
        {labels[prio] || "Niski"}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { style: string; label: string; dot: string }> = {
      open: { style: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", label: "Otwarte", dot: "bg-indigo-400" },
      in_progress: { style: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "W realizacji", dot: "bg-amber-400" },
      resolved: { style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Rozwiązane", dot: "bg-emerald-400" },
      closed: { style: "text-white/40 bg-white/5 border-white/10", label: "Zamknięte", dot: "bg-white/40" },
    };
    const c = config[status] || config.closed;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.style}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    );
  };

  const formattedTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const activeCount = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
  const urgentCount = tickets.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length;
  const unassignedCount = tickets.filter((t) => !t.assignedTo && t.status !== "resolved" && t.status !== "closed").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  const storeInfo = displayTicket?.location
    ? STORE_LOCATIONS.find((s) => s.code === displayTicket.location)
    : null;

  return (
    <div className="space-y-5">
      {/* Metric cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Aktywna kolejka", value: activeCount, accent: "from-indigo-500 to-violet-500", sub: "Kanał live", subDot: true },
          { label: "Pilne zgłoszenia", value: urgentCount, accent: urgentCount > 0 ? "from-rose-500 to-pink-500" : "from-white/10 to-white/5", sub: urgentCount > 0 ? "Wymaga działania" : "Optymalnie" },
          { label: "Do przypisania", value: unassignedCount, accent: unassignedCount > 0 ? "from-amber-500 to-orange-500" : "from-white/10 to-white/5", sub: unassignedCount > 0 ? "Nieprzypisane" : "Brak zaległości" },
          { label: "Rozwiązane", value: resolvedCount, accent: "from-emerald-500 to-teal-500", sub: "Zamknięte sprawy" },
        ].map((card) => (
          <div key={card.label} className="bg-white/[0.03] backdrop-blur border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between hover:border-white/10 transition-all duration-300">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.15em]">{card.label}</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-extrabold tracking-tight bg-gradient-to-r ${card.accent} bg-clip-text text-transparent`}>
                {card.value}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wider text-white/20 flex items-center gap-1">
                {card.subDot && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
                {card.sub}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
          <input
            ref={searchRef}
            type="text"
            placeholder='Szukaj zgłoszeń... (naciśnij "/")'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 font-mono"
          />
        </div>

        {/* Filter selects */}
        {[
          { value: statusFilter, onChange: setStatusFilter, options: [["all", "Status"], ["open", "Otwarte"], ["in_progress", "W realizacji"], ["resolved", "Rozwiązane"], ["closed", "Zamknięte"]] },
          { value: priorityFilter, onChange: setPriorityFilter, options: [["all", "Priorytet"], ["urgent", "Pilny"], ["high", "Wysoki"], ["medium", "Średni"], ["low", "Niski"]] },
          { value: categoryFilter, onChange: setCategoryFilter, options: [["all", "Kategoria"], ["hardware", "Sprzęt"], ["software", "Oprogramowanie"], ["network", "Sieć"], ["access", "Uprawnienia"], ["other", "Inne"]] },
        ].map((filter, i) => (
          <select
            key={i}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="px-2.5 py-2 text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/60 focus:outline-none focus:border-indigo-500/30 cursor-pointer appearance-none"
          >
            {filter.options.map(([val, label]) => (
              <option key={val} value={val} className="bg-[#0d0d14] text-white">{label}</option>
            ))}
          </select>
        ))}

        {uniqueLocations.length > 0 && (
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-2.5 py-2 text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/60 focus:outline-none focus:border-indigo-500/30 cursor-pointer appearance-none"
          >
            <option value="all" className="bg-[#0d0d14] text-white">Lokalizacja</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc} className="bg-[#0d0d14] text-white">{loc}</option>
            ))}
          </select>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-2.5 py-2 text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/60 focus:outline-none focus:border-indigo-500/30 cursor-pointer appearance-none"
        >
          <option value="date_desc" className="bg-[#0d0d14] text-white">Najnowsze</option>
          <option value="date_asc" className="bg-[#0d0d14] text-white">Najstarsze</option>
          <option value="priority" className="bg-[#0d0d14] text-white">Priorytet</option>
          <option value="status" className="bg-[#0d0d14] text-white">Status</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-2 text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            <X className="w-3 h-3" />
            Wyczyść
          </button>
        )}

        <span className="text-[10px] text-white/20 ml-auto font-mono">
          {filteredTickets.length}/{tickets.length}
        </span>
      </div>

      {/* Main split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Ticket list */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin">
          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-xs text-white/30">Brak zgłoszeń</p>
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isSelected = displayTicket?.id === t.id;
              const hasNewMessages = t.messages.length > 0 && (!lastSeen[t.id] || new Date(t.messages[t.messages.length - 1].createdAt).getTime() > lastSeen[t.id]);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer group ${
                    isSelected
                      ? "bg-white/[0.06] border-indigo-500/30 shadow-lg shadow-indigo-500/5"
                      : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-semibold text-white/90 truncate flex-1 leading-tight">{t.title}</h3>
                    {hasNewMessages && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1" />}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getStatusBadge(t.status)}
                    {getPriorityBadge(t.priority)}
                    <span className="text-[9px] text-white/20 ml-auto font-mono">{timeAgo(t.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] text-white/25">
                    <span className="font-mono">{t.id}</span>
                    <span>|</span>
                    <span>{t.clientName}</span>
                    {t.messages.length > 0 && (
                      <>
                        <span>|</span>
                        <MessageSquare className="w-2.5 h-2.5 inline" />
                        <span>{t.messages.length}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Ticket detail */}
        <div className="lg:col-span-7 xl:col-span-8">
          {displayTicket ? (
            <div className="bg-white/[0.03] backdrop-blur border border-white/[0.06] rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-white tracking-tight mb-1.5">{displayTicket.title}</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(displayTicket.status)}
                      {getPriorityBadge(displayTicket.priority)}
                      <span className="text-[10px] text-white/20 font-mono">{displayTicket.id}</span>
                      <span className="text-[10px] text-white/15">|</span>
                      <span className="text-[10px] text-white/30">{getCategoryLabel(displayTicket.category)}</span>
                    </div>
                  </div>
                </div>

                {/* Store info */}
                {storeInfo && (
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <MapPin className="w-3 h-3 text-indigo-400" />
                      <span className="font-semibold text-white/60">{storeInfo.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-white/25">
                      <span className="flex items-center gap-1"><Home className="w-2.5 h-2.5" />{storeInfo.address}</span>
                      <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{storeInfo.email}</span>
                    </div>
                  </div>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-white/30">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{displayTicket.clientName}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{displayTicket.clientEmail}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formattedTime(displayTicket.createdAt)}</span>
                  {displayTicket.assignedName && (
                    <span className="flex items-center gap-1 text-indigo-400"><UserCheck className="w-3 h-3" />{displayTicket.assignedName}</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="p-5 border-b border-white/[0.06]">
                <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{displayTicket.description}</p>

                {/* Attachments */}
                {displayTicket.attachments.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Załączniki</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {displayTicket.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.data}
                          download={att.name}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[10px] text-white/50 hover:text-white/70 hover:border-white/10 transition-all"
                        >
                          <FileCode className="w-3 h-3" />
                          {att.name}
                          <Download className="w-2.5 h-2.5 ml-1" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {(currentUser.role === "admin" || currentUser.role === "agent") && (
                <div className="p-4 border-b border-white/[0.06] flex flex-wrap gap-2">
                  {/* Status actions */}
                  {(["open", "in_progress", "resolved", "closed"] as TicketStatus[])
                    .filter((s) => s !== displayTicket.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => onUpdateStatus(displayTicket.id, s)}
                        className="px-3 py-1.5 text-[10px] font-semibold bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/50 hover:text-white hover:border-white/15 transition-all cursor-pointer"
                      >
                        {s === "open" ? "Otwórz" : s === "in_progress" ? "W realizacji" : s === "resolved" ? "Rozwiąż" : "Zamknij"}
                      </button>
                    ))}

                  <div className="w-px h-6 bg-white/[0.06] mx-1" />

                  {/* Priority */}
                  <select
                    value={displayTicket.priority}
                    onChange={(e) => onUpdatePriority(displayTicket.id, e.target.value as TicketPriority)}
                    className="px-2.5 py-1.5 text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/50 focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value="low" className="bg-[#0d0d14]">Niski</option>
                    <option value="medium" className="bg-[#0d0d14]">Średni</option>
                    <option value="high" className="bg-[#0d0d14]">Wysoki</option>
                    <option value="urgent" className="bg-[#0d0d14]">Pilny</option>
                  </select>

                  {/* Assign */}
                  <select
                    value={displayTicket.assignedTo || ""}
                    onChange={(e) => {
                      const eng = supportEngineers.find((se) => se.id === e.target.value);
                      if (eng) onAssignTicket(displayTicket.id, eng.id, eng.name);
                    }}
                    className="px-2.5 py-1.5 text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/50 focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-[#0d0d14]">Przypisz...</option>
                    {supportEngineers.map((eng) => (
                      <option key={eng.id} value={eng.id} className="bg-[#0d0d14]">{eng.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client status actions */}
              {currentUser.role === "client" && displayTicket.clientId === currentUser.id && (
                <div className="p-4 border-b border-white/[0.06] flex flex-wrap gap-2">
                  {displayTicket.status !== "resolved" && displayTicket.status !== "closed" && (
                    <>
                      <button onClick={() => onUpdateStatus(displayTicket.id, "resolved")} className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer">
                        Rozwiąż
                      </button>
                      <button onClick={() => onUpdateStatus(displayTicket.id, "closed")} className="px-3 py-1.5 text-[10px] font-semibold bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/50 hover:text-white hover:border-white/15 transition-all cursor-pointer">
                        Zamknij
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    Konwersacja ({displayTicket.messages.filter((m) => currentUser.role !== "client" || !m.isInternal).length})
                  </span>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto mb-4 pr-1">
                  {displayTicket.messages.length === 0 ? (
                    <p className="text-[10px] text-white/20 text-center py-6">Brak wiadomości</p>
                  ) : (
                    displayTicket.messages
                      .filter((m) => currentUser.role !== "client" || !m.isInternal)
                      .map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg border ${
                            msg.isInternal
                              ? "bg-amber-500/5 border-amber-500/10"
                              : "bg-white/[0.02] border-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-white/60">{msg.senderName}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold ${
                                msg.senderRole === "admin"
                                  ? "bg-violet-500/15 text-violet-400"
                                  : msg.senderRole === "agent"
                                    ? "bg-indigo-500/15 text-indigo-400"
                                    : "bg-white/5 text-white/30"
                              }`}>
                                {msg.senderRole === "admin" ? "Admin" : msg.senderRole === "agent" ? "Agent" : "Klient"}
                              </span>
                              {msg.isInternal && (
                                <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded-full font-semibold">
                                  <Lock className="w-2 h-2" />
                                  Notatka wewnętrzna
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-white/20 font-mono">{timeAgo(msg.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))
                  )}
                </div>

                {/* Reply form */}
                <form onSubmit={handleReplySubmit} className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Napisz odpowiedź..."
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    {(currentUser.role === "admin" || currentUser.role === "agent") && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={internalNote}
                          onChange={(e) => setInternalNote(e.target.checked)}
                          className="w-3 h-3 rounded accent-amber-500"
                        />
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Notatka wewnętrzna
                        </span>
                      </label>
                    )}
                    <button
                      type="submit"
                      disabled={submittingReply || !replyText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-[10px] font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-30 shadow-lg shadow-indigo-500/10 ml-auto"
                    >
                      <Send className="w-3 h-3" />
                      {submittingReply ? "Wysyłanie..." : "Wyślij"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Zap className="w-6 h-6 text-white/10" />
              </div>
              <p className="text-xs text-white/20">Wybierz zgłoszenie z listy</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
