import React, { useState, useMemo } from 'react';
import { Ticket, TicketStatus, TicketPriority, TicketMessage, UserRole } from '../types';
import { STORE_LOCATIONS } from '../data/stores';
import { 
  Search, Filter, Clock, User, CheckCircle, ShieldAlert, AlertCircle, 
  MessageSquare, Send, Tag, ChevronRight, FileCode, CheckCircle2, UserCheck, 
  Download, Eye, Lock, MapPin, Mail, Home
} from 'lucide-react';

interface TicketDashboardProps {
  tickets: Ticket[];
  currentUser: { id: string; name: string; role: UserRole; email: string };
  onUpdateStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  onUpdatePriority: (ticketId: string, priority: TicketPriority) => Promise<void>;
  onAssignTicket: (ticketId: string, agentId: string, agentName: string) => Promise<void>;
  onPostMessage: (ticketId: string, messageText: string, isInternal: boolean) => Promise<void>;
}

export default function TicketDashboard({
  tickets,
  currentUser,
  onUpdateStatus,
  onUpdatePriority,
  onAssignTicket,
  onPostMessage,
}: TicketDashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Message writing controls
  const [replyText, setReplyText] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Hardcoded Support Personnel list to assign tickets to
  const SUPPORT_ENGINEERS = [
    { id: 'agent-1', name: 'Alex Vance (Wsparcie IT)' },
    { id: 'agent-2', name: 'Sarah Connor (SysOps)' },
    { id: 'agent-10', name: 'Marcus Miller (Starszy Specjalista)' },
    { id: 'admin-1', name: 'Krzysztof Graczyk (Dyrektor IT)' }
  ];

  const activeTicket = useMemo(() => {
    return tickets.find(t => t.id === selectedId) || null;
  }, [tickets, selectedId]);

  // Handle client visibility checks for search list
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Client role: Filter to only show their own tickets
      if (currentUser.role === 'client' && t.clientId !== currentUser.id) {
        return false;
      }

      // 2. Search matches
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        t.title.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.id.toLowerCase().includes(searchLower) ||
        t.clientName.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // 3. Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      // 4. Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      // 5. Category filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

      return true;
    });
  }, [tickets, currentUser, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  // Reset selected ticket if some other state changes it or filter hides it
  const displayTicket = useMemo(() => {
    if (activeTicket && filteredTickets.find(t => t.id === activeTicket.id)) {
      return activeTicket;
    }
    return filteredTickets[0] || null;
  }, [filteredTickets, activeTicket]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !displayTicket) return;

    setSubmittingReply(true);
    try {
      await onPostMessage(displayTicket.id, replyText, internalNote);
      setReplyText('');
      setInternalNote(false); // Reset internal flag
    } catch (err) {
      console.error('Failed to post reply message:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Prettify categories
  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'hardware': return 'Sprzęt i urządzenia';
      case 'software': return 'Oprogramowanie i aplikacje';
      case 'network': return 'Sieci i bezpieczny VPN';
      case 'access': return 'Dane uwierzytelniające i uprawnienia';
      default: return 'Zgłoszenie ogólne';
    }
  };

  // Urgency colors
  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'urgent':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Pilny</span>;
      case 'high':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Wysoki</span>;
      case 'medium':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">Średni</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Niski</span>;
    }
  };

  // Status indicators
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">● Otwarte</span>;
      case 'in_progress':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">■ W realizacji</span>;
      case 'resolved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-250">✓ Rozwiązane</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">✕ Zamknięte</span>;
    }
  };

  const formattedTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Calculate Bento Stat Metrics dynamically from current state dataset
  const activeCount = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length;
  const unassignedCount = tickets.filter(t => !t.assignedTo && t.status !== 'resolved' && t.status !== 'closed').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-6">
      {/* 4-Card Bento Stat grid at the top */}
      <section id="bento-metrics-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Stat Card 1: Active Support cases */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all duration-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Aktywna kolejka</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold font-sans text-slate-900 tracking-tight">{activeCount}</span>
            <span className="text-green-600 text-[9px] font-extrabold uppercase tracking-wide bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-ping"></span> Kanał live
            </span>
          </div>
        </div>

        {/* Stat Card 2: Urgent Priority Count */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all duration-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pilne zgłoszenia</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className={`text-3xl font-extrabold font-sans ${urgentCount > 0 ? 'text-red-600' : 'text-slate-900'} tracking-tight`}>{urgentCount}</span>
            <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
              urgentCount > 0 
                ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' 
                : 'bg-slate-50 text-slate-500 border-slate-100'
            }`}>
              {urgentCount > 0 ? 'Wymaga działania' : 'Optymalnie'}
            </span>
          </div>
        </div>

        {/* Stat Card 3: Unassigned Cases */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all duration-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Do przypisania</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className={`text-3xl font-extrabold font-sans ${unassignedCount > 0 ? 'text-amber-600' : 'text-slate-900'} tracking-tight`}>{unassignedCount}</span>
            <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
              unassignedCount > 0
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-slate-50 text-slate-500 border-slate-100'
            }`}>
              {unassignedCount > 0 ? 'Nieprzypisane' : 'Brak zaległości'}
            </span>
          </div>
        </div>

        {/* Stat Card 4: Historical resolution index */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all duration-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ukończone sprawy</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold font-sans text-slate-900 tracking-tight">{resolvedCount}</span>
            <span className="text-indigo-600 text-[9px] font-extrabold uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              SLA Spełnione
            </span>
          </div>
        </div>
      </section>

      {/* Main Backlog search columns (Primary Bento Sections) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-auto">
        {/* Sidebar Search and Filter Columns (Left Bento Block) */}
        <div id="bento-search-sidepanel" className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-shadow duration-300">
          {/* Search header panel */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj po tytule, ID lub zgłaszającym..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505 bg-slate-50/50 font-sans text-slate-800"
              />
            </div>
          </div>

          {/* Filters Panel grouped nicely */}
          <div className="grid grid-cols-3 gap-2 mb-5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Status</span>
              <select
                aria-label="Filter status dropdown"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-[10px] bg-white border border-slate-250 rounded-lg p-1.5 text-slate-700 focus:outline-hidden focus:border-indigo-500 cursor-pointer font-sans"
              >
                <option value="all">Wszystkie</option>
                <option value="open">Otwarte</option>
                <option value="in_progress">W toku</option>
                <option value="resolved">Rozwiązane</option>
                <option value="closed">Zamknięte</option>
              </select>
            </div>

            <div>
              <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Priorytet</span>
              <select
                aria-label="Filter urgency dropdown"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full text-[10px] bg-white border border-slate-250 rounded-lg p-1.5 text-slate-700 focus:outline-hidden focus:border-indigo-500 cursor-pointer font-sans"
              >
                <option value="all">Wszystkie</option>
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
                <option value="urgent">Pilny</option>
              </select>
            </div>

            <div>
              <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Typ</span>
              <select
                aria-label="Filter category type"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-[10px] bg-white border border-slate-250 rounded-lg p-1.5 text-slate-700 focus:outline-hidden focus:border-indigo-500 cursor-pointer font-sans"
              >
                <option value="all">Wszystkie</option>
                <option value="hardware">Sprzęt</option>
                <option value="software">Oprogramowanie</option>
                <option value="network">Sieć / VPN</option>
                <option value="access">Uprawnienia</option>
              </select>
            </div>
          </div>

          {/* Ticket List Queue in sidebar */}
          <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
            <div className="flex justify-between items-center px-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kolejka zgłoszeń ({filteredTickets.length} poz.)
              </span>
              {currentUser.role !== 'client' && (
                <span className="text-[9px] font-semibold bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  Pełny podgląd
                </span>
              )}
            </div>

            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 border border-slate-200 border-dashed bg-slate-50/55 rounded-xl">
                <Clock className="w-7 h-7 text-slate-350 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Brak aktywnych zgłoszeń.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = displayTicket && displayTicket.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex flex-col gap-2 cursor-pointer select-none ${
                      isSelected
                        ? 'border-indigo-650 bg-indigo-50/20 ring-1 ring-indigo-500/10 shadow-xs'
                        : 'border-slate-205 hover:border-slate-350 hover:bg-slate-50/60 bg-white shadow-2xs'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {t.id}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400">
                        {formattedTime(t.createdAt).split(' ')[1]}
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-slate-800 line-clamp-1 truncate font-sans text-xs mb-0.5">
                        {t.title}
                      </p>
                      <p className="text-slate-500 line-clamp-2 text-[11px] leading-normal truncate">
                        {t.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-1.5 pt-2 border-t border-slate-100 mt-1">
                      <div className="flex gap-1 items-center flex-wrap">
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                        {t.location && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-700">
                            📍 {t.location}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold truncate max-w-[130px]">
                        👤 {t.clientName.split(' ')[0]}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Operations Panel Detail (Right Bento Block) */}
        <div id="bento-detail-panel" className="lg:col-span-7 space-y-5 h-full">
          {displayTicket ? (
            <>
              {/* Header Identity banner */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold px-2 py-0.5 rounded">
                        ID SPRAWY: {displayTicket.id}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-slate-50 text-slate-500 border border-slate-200 uppercase tracking-wide">
                        📂 {getCategoryLabel(displayTicket.category)}
                      </span>
                      {displayTicket.location && (
                        <span className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide flex items-center gap-1">
                          📍 {displayTicket.location}
                        </span>
                      )}
                    </div>
                    <h1 className="text-md sm:text-lg font-extrabold text-slate-900 font-sans tracking-tight">
                      {displayTicket.title}
                    </h1>
                  </div>

                  <div className="flex gap-1.5 shrink-0 items-center">
                    {getPriorityBadge(displayTicket.priority)}
                    {getStatusBadge(displayTicket.status)}
                  </div>
                </div>

                {/* Action Operations Controller Toolbar (RBAC Protected: Hide/view details for Client) */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-wrap gap-4 items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px]">Osoba przypisana:</span>
                    <span className="text-slate-800 font-bold font-sans flex items-center gap-1">
                      {displayTicket.assignedName ? `🛠️ ${displayTicket.assignedName}` : '❌ Nieprzypisano'}
                    </span>
                  </div>

                  {/* Operations selectors visible only to support staff (agent / admin roles) */}
                  {currentUser.role !== 'client' ? (
                    <div className="flex flex-wrap gap-2">
                      {/* Status Changer */}
                      <div>
                        <select
                          aria-label="Ticket Status Change"
                          value={displayTicket.status}
                          onChange={(e) => onUpdateStatus(displayTicket.id, e.target.value as TicketStatus)}
                          className="bg-white border border-slate-250 text-[10px] font-bold text-slate-700 rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-2xs font-sans"
                        >
                          <option value="open">Otwarta sprawa</option>
                          <option value="in_progress">Prace w toku</option>
                          <option value="resolved">Oznacz jako rozwiązane</option>
                          <option value="closed">Zamknij sprawę</option>
                        </select>
                      </div>

                      {/* Urgency Modifier */}
                      <div>
                        <select
                          aria-label="Ticket Priority Modification"
                          value={displayTicket.priority}
                          onChange={(e) => onUpdatePriority(displayTicket.id, e.target.value as TicketPriority)}
                          className="bg-white border border-slate-250 text-[10px] font-bold text-slate-755 rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-2xs font-sans"
                        >
                          <option value="low">Standardowy priorytet</option>
                          <option value="medium">Średni priorytet</option>
                          <option value="high">Wysoki priorytet</option>
                          <option value="urgent">Pilna awaria (krytyczny)</option>
                        </select>
                      </div>

                      {/* Assignee trigger */}
                      <div>
                        <select
                          aria-label="Assign Support Staff"
                          value={displayTicket.assignedTo || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const found = SUPPORT_ENGINEERS.find(se => se.id === val);
                            if (found) {
                              onAssignTicket(displayTicket.id, found.id, found.name);
                            }
                          }}
                          className="bg-white border border-slate-250 text-[10px] font-bold text-slate-707 rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-2xs font-sans"
                        >
                          <option value="">Przypisz pracownika...</option>
                          {SUPPORT_ENGINEERS.map(se => (
                            <option key={se.id} value={se.id}>{se.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">
                      (Opcje zablokowane dla roli klienta)
                    </div>
                  )}
                </div>
              </div>

              {/* Description Card & Attachments viewer */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xs">
                {(() => {
                  const storeDetails = displayTicket.location ? STORE_LOCATIONS.find(s => s.code === displayTicket.location) : null;
                  if (storeDetails) {
                    return (
                      <div className="bg-indigo-50/15 border border-indigo-105 p-4 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h4 className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">Lokalizacja sklepu</h4>
                          <p className="text-xs font-bold text-slate-800 truncate" title={storeDetails.name}>
                            {storeDetails.code} — {storeDetails.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Adres: <span className="font-medium text-slate-600">{storeDetails.address}</span>
                          </p>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-right">
                          <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">E-mail sklepu</span>
                          <a href={`mailto:${storeDetails.email}`} className="text-[10px] bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-650 font-mono flex items-center gap-1 font-semibold shadow-3xs cursor-pointer">
                            <Mail className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{storeDetails.email}</span>
                          </a>
                        </div>
                      </div>
                    );
                  } else if (displayTicket.location) {
                    return (
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Lokalizacja sklepu (Kod)</h4>
                          <p className="text-xs font-bold text-slate-800">
                            📍 {displayTicket.location}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div>
                  <h3 className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">Opis problemu</h3>
                  <div className="bg-slate-50/65 font-sans border border-slate-200 p-4.5 rounded-xl text-slate-700 text-sm whitespace-pre-line leading-relaxed shadow-inner">
                    {displayTicket.description}
                  </div>
                </div>

                {/* Attachments Section */}
                {displayTicket.attachments && displayTicket.attachments.length > 0 && (
                  <div>
                    <h3 className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">Załączone pliki ({displayTicket.attachments.length})</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {displayTicket.attachments.map((file, idx) => {
                        const isImage = file.type.startsWith('image/');
                        return (
                          <div
                            key={`attach-${idx}`}
                            className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col justify-between hover:border-slate-350 transition-colors"
                          >
                            {isImage ? (
                              <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-200 select-none">
                                <img
                                  src={file.data}
                                  alt={file.name}
                                  className="object-cover h-full w-full"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="h-24 bg-slate-100 border-b border-slate-200 flex flex-col items-center justify-center text-slate-400">
                                <FileCode className="w-8 h-8 text-slate-400 mb-1" />
                                <span className="text-[10px] font-mono truncate max-w-[90%] px-1 font-bold uppercase text-slate-500">{file.name.split('.').pop() || 'DOC'}</span>
                              </div>
                            )}
                            <div className="p-2.5 flex items-center justify-between text-[11px] gap-2">
                              <span className="truncate font-bold text-slate-700 font-sans" title={file.name}>
                                {file.name}
                              </span>
                              <a
                                href={file.data}
                                download={file.name}
                                className="p-1 px-1.5 text-slate-600 hover:text-indigo-650 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 shadow-2xs shrink-0 font-bold flex items-center justify-center cursor-pointer"
                                title="Pobierz załącznik"
                                referrerPolicy="no-referrer"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Informative timing specs */}
                <div className="text-[10px] text-slate-400 font-bold font-mono tracking-wide flex flex-wrap gap-4 border-t border-slate-100 pt-4 uppercase">
                  <div>
                    <span className="text-slate-300">Zgłoszono:</span> {formattedTime(displayTicket.createdAt)} przez {displayTicket.clientName.split(' ')[0]}
                  </div>
                  <div>
                    <span className="text-slate-300">Ostatnia zmiana:</span> {formattedTime(displayTicket.updatedAt)}
                  </div>
                </div>
              </div>

              {/* Conversation Log & Message Desk */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
                <h3 className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center justify-between col-span-12">
                  <span>Historia korespondencji ({displayTicket.messages?.filter(m => !m.isInternal || currentUser.role !== 'client').length || 0})</span>
                  <span className="text-[8px] font-mono font-bold text-slate-300 flex items-center gap-1 justify-end shrink-0">
                    SYNCHRONIZACJA LIVE
                  </span>
                </h3>

                {/* Message Feed List */}
                <div className="space-y-3.5 overflow-y-auto max-h-[280px] pr-1">
                  {(displayTicket.messages || []).length === 0 ? (
                    <div className="text-center py-7 border border-slate-150 border-dashed rounded-xl bg-slate-50/55">
                      <MessageSquare className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500 font-medium">Brak wpisów o aktywności.</p>
                    </div>
                  ) : (
                    displayTicket.messages.map((m) => {
                      // Filter internal notes if the active logged-in role is client
                      if (m.isInternal && currentUser.role === 'client') return null;

                      const isStaff = m.senderRole === 'agent' || m.senderRole === 'admin';
                      const isSelf = m.senderId === currentUser.id;

                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1 w-full ${
                            m.isInternal
                              ? 'bg-amber-50/60 border-amber-200 text-amber-900 shadow-2xs'
                              : isSelf
                                ? 'bg-indigo-50/20 border-indigo-150 text-slate-800'
                                : isStaff
                                  ? 'bg-slate-50 border-slate-200 text-slate-805'
                                  : 'bg-slate-50 border-slate-200 text-slate-805'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px] font-sans border-b border-black/5 pb-1 mb-1">
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <strong className="text-slate-800">{m.senderName}</strong>
                              <span className="text-[8px] font-bold uppercase px-1 rounded bg-slate-200/85 text-slate-600 font-mono tracking-wider">
                                {m.senderRole}
                              </span>
                              {m.isInternal && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-amber-200 text-amber-800 px-1 rounded border border-amber-300">
                                  <Lock className="w-2 h-2" /> Notatka wewnętrzna
                                </span>
                              )}
                            </span>
                            <span className="text-slate-400 font-mono">{formattedTime(m.createdAt).split(' ')[1]}</span>
                          </div>
                          <p className="whitespace-pre-line text-[11px] text-slate-707">{m.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Discussion Write Form */}
                <form onSubmit={handleReplySubmit} className="border-t border-slate-100 pt-4.5 space-y-3.5">
                  <div>
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        internalNote 
                          ? "Wprowadź poufną notatkę wewnętrzną wsparcia IT..."
                          : "Wpisz odpowiedź do klienta lub opis podjętych działań..."
                      }
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-205 rounded-xl focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 bg-slate-50/60 font-sans text-slate-850 shadow-inner"
                      required
                    />
                  </div>

                  <div className="flex justify-between items-center flex-wrap gap-2.5">
                    {/* Internal note controller (Only visible to agent/admin Roles) */}
                    {currentUser.role !== 'client' ? (
                      <label className="flex items-center gap-2 text-xs text-amber-855 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={internalNote}
                          onChange={(e) => setInternalNote(e.target.checked)}
                          className="rounded accent-amber-600 focus:ring-amber-500 h-4 w-4 border-amber-300 cursor-pointer"
                        />
                        <span>Zapisz jako wewnętrzną poufną notatkę agenta</span>
                      </label>
                    ) : (
                      <div />
                    )}

                    <button
                      type="submit"
                      disabled={submittingReply || !replyText.trim()}
                      className="flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold bg-slate-900 hover:bg-indigo-950 border border-slate-900 hover:border-indigo-950 text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 select-none"
                    >
                      {submittingReply ? (
                        <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-3.5 h-3.5"></span>
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{internalNote ? 'Dodaj notatkę wewnętrzną' : 'Wyślij wiadomość'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-2xs">
              <ShieldAlert className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
              <h2 className="text-sm font-bold text-slate-707">Brak wybranego zgłoszenia</h2>
              <p className="text-xs text-slate-550 mt-1 font-sans">Zmień rolę użytkownika lub wyślij nowe zgłoszenie, aby zacząć.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
