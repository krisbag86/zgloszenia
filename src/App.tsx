import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  User,
  Ticket,
  TicketStatus,
  TicketPriority,
  NotificationLog,
  UserRole,
  Attachment,
} from "./types";
import TicketForm from "./components/TicketForm";
import TicketDashboard from "./components/TicketDashboard";
import NotificationCenter from "./components/NotificationCenter";
import DockerGuide from "./components/DockerGuide";
import Dashboard from "./components/Dashboard";
import { ToastContainer, ToastItem, ToastType } from "./components/Toast";
import {
  Wifi,
  WifiOff,
  Database,
  Layers,
  ShieldCheck,
  Mail,
  Cpu,
  RefreshCw,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

// Hardcoded users list to switch identities for testing/demonstration of absolute RBAC rules
const DEMO_USERS: User[] = [
  {
    id: "client-1",
    name: "Jane Doe",
    email: "jane.doe@workplace.com",
    role: "client",
  },
  {
    id: "client-2",
    name: "John Smith",
    email: "john.smith@co.com",
    role: "client",
  },
  {
    id: "agent-1",
    name: "Alex Vance",
    email: "alex.vance@workplace.com",
    role: "agent",
  },
  {
    id: "admin-1",
    name: "Krzysztof Graczyk",
    email: "krzysztof@bagietka.pl",
    role: "admin",
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(DEMO_USERS[0]); // Default to Client Jane Doe
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "analytics" | "submit" | "mailbox" | "docker"
  >("dashboard");

  // Real-time Connection status trackers
  const [wsConnected, setWsConnected] = useState(false);
  const [dbMode, setDbMode] = useState<"postgresql" | "local-json-memory">(
    "local-json-memory",
  );
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // Core API fetch routines
  const fetchTickets = useCallback(async () => {
    try {
      const resp = await fetch("/api/tickets");
      if (!resp.ok) throw new Error("Failed to retrieve support queue.");
      const data = await resp.json();
      setTickets(data);
    } catch (err: any) {
      console.error(err);
      setApiError("Unable to communicate with the IT Helpdesk API server.");
    }
  }, []);

  const fetchNotificationLogs = useCallback(async () => {
    try {
      const resp = await fetch("/api/notifications");
      if (resp.ok) {
        const data = await resp.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to sync outgoing log history:", err);
    }
  }, []);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const resp = await fetch("/api/status");
      if (resp.ok) {
        const data = await resp.json();
        setDbMode(data.database);
        setActiveUsersCount(data.connectedClients);
      }
    } catch (err) {
      console.error("System status ping failed:", err);
    }
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Set up WebSocket listener
  useEffect(() => {
    let active = true;
    let reconnectTimer: NodeJS.Timeout;

    const connectWS = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        // Connect directly to the hosting context
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log(`Establishing WebSocket link to: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          console.log("Real-time Support WebSocket link established.");
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const data = JSON.parse(event.data);
            console.log("WS Event received:", data);

            if (data.type === "ticket_created") {
              setTickets((prev) => {
                // Deduplicate just in case
                if (prev.some((t) => t.id === data.ticket.id)) return prev;
                return [data.ticket, ...prev];
              });
            } else if (data.type === "ticket_updated") {
              setTickets((prev) =>
                prev.map((t) => (t.id === data.ticket.id ? data.ticket : t)),
              );
            } else if (data.type === "notification_logged") {
              setLogs((prev) => {
                if (prev.some((l) => l.id === data.log.id)) return prev;
                return [data.log, ...prev];
              });
            } else if (data.type === "system") {
              if (data.postgresActive !== undefined) {
                setDbMode(
                  data.postgresActive ? "postgresql" : "local-json-memory",
                );
              }
            }
          } catch (e) {
            console.error("Failed to interpret payload:", e);
          }
        };

        ws.onclose = () => {
          if (!active) return;
          console.log("WebSocket link offline. Retrying in 4s...");
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWS, 4000);
        };

        ws.onerror = (err) => {
          console.error("WS Connection error:", err);
          ws.close();
        };
      } catch (err) {
        console.error("WS Initialization aborted:", err);
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWS, 4000);
      }
    };

    connectWS();

    return () => {
      active = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Load initial dataset once on mount
  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setApiError(null);
      await Promise.all([
        fetchTickets(),
        fetchNotificationLogs(),
        fetchSystemStatus(),
      ]);
      setLoading(false);
    };
    bootstrap();
  }, [fetchTickets, fetchNotificationLogs, fetchSystemStatus]);

  // Periodic polling helper to synchronize dashboard stats and logs
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSystemStatus();
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchSystemStatus]);

  // Submit new IT ticket
  const handleTicketSubmitted = async (ticketData: {
    title: string;
    description: string;
    category: any;
    priority: any;
    attachments: Attachment[];
  }) => {
    const payload = {
      ...ticketData,
      clientId: currentUser.id,
      clientName: currentUser.name,
      clientEmail: currentUser.email,
    };

    const resp = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorMsg = await resp.json();
      throw new Error(
        errorMsg.error || "Failed to file your ticket application.",
      );
    }

    // Switch to active portal view to see results
    setActiveTab("dashboard");
  };

  // Agent action: Update ticket Status
  const handleUpdateStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      const resp = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          currentUserRole: currentUser.role,
          currentUserId: currentUser.id,
        }),
      });
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error);
      }
      addToast("success", "Status zgłoszenia zaktualizowany.");
    } catch (err: any) {
      addToast("error", `Błąd aktualizacji statusu: ${err.message}`);
    }
  };

  // Agent action: Update priority urgency
  const handleUpdatePriority = async (
    ticketId: string,
    priority: TicketPriority,
  ) => {
    try {
      const resp = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority,
          currentUserRole: currentUser.role,
          currentUserId: currentUser.id,
        }),
      });
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error);
      }
      addToast("success", "Priorytet zgłoszenia zaktualizowany.");
    } catch (err: any) {
      addToast("error", `Błąd aktualizacji priorytetu: ${err.message}`);
    }
  };

  // Agent action: Allocate engineering staff
  const handleAssignTicket = async (
    ticketId: string,
    agentId: string,
    agentName: string,
  ) => {
    try {
      const resp = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: agentId,
          assignedName: agentName,
          currentUserRole: currentUser.role,
          currentUserId: currentUser.id,
        }),
      });
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error);
      }
      addToast("success", "Zgłoszenie przypisane do pracownika.");
    } catch (err: any) {
      addToast("error", `Błąd przypisania: ${err.message}`);
    }
  };

  // Common: Post chat replies (Public and private RBAC notes)
  const handlePostMessage = async (
    ticketId: string,
    messageText: string,
    isInternal: boolean,
  ) => {
    try {
      const resp = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          message: messageText,
          isInternal,
        }),
      });
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error);
      }
      addToast("success", "Wiadomość wysłana.");
    } catch (err: any) {
      addToast("error", `Błąd wysyłania wiadomości: ${err.message}`);
    }
  };

  const handleUserSwitch = (userId: string) => {
    const found = DEMO_USERS.find((user) => user.id === userId);
    if (found) {
      setCurrentUser(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-indigo-100 antialiased">
      {/* 1. Desktop Left Bento Sidebar Navigation */}
      <nav
        id="bento-desktop-sidebar"
        className="hidden md:flex w-24 bg-indigo-950 text-indigo-200 flex-col items-center py-6 gap-6 shrink-0 border-r border-indigo-900 justify-between"
      >
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Logo element with Bento glow */}
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md relative group">
            <Layers className="w-6 h-6" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-indigo-950 rounded-full"></span>
          </div>

          <div className="w-[60%] border-b border-indigo-900/40 my-1"></div>

          {/* Action portals navigation buttons */}
          <div className="flex flex-col gap-3 w-full px-2">
            <button
              id="nav-btn-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all cursor-pointer group select-none ${
                activeTab === "dashboard"
                  ? "bg-white/10 text-white font-bold shadow-xs"
                  : "text-indigo-300/80 hover:bg-white/5 hover:text-indigo-100"
              }`}
              title="Lista spraw wsparcia IT"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">
                📋
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                Zgłoszenia
              </span>
            </button>

            <button
              id="nav-btn-submit"
              onClick={() => setActiveTab("submit")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all cursor-pointer group select-none ${
                activeTab === "submit"
                  ? "bg-white/10 text-white font-bold shadow-xs"
                  : "text-indigo-300/80 hover:bg-white/5 hover:text-indigo-100"
              }`}
              title="Zgłoś nowy problem techniczny"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">
                ✏️
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                Nowe
              </span>
            </button>

            <button
              id="nav-btn-mailbox"
              onClick={() => setActiveTab("mailbox")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all cursor-pointer group select-none ${
                activeTab === "mailbox"
                  ? "bg-white/10 text-white font-bold shadow-xs"
                  : "text-indigo-300/80 hover:bg-white/5 hover:text-indigo-100"
              }`}
              title="Logi powiadomień e-mail SMTP"
            >
              <div className="relative">
                <span className="text-xl group-hover:scale-110 transition-transform">
                  ✉️
                </span>
                {logs.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-bold px-1 rounded-full">
                    {logs.length}
                  </span>
                )}
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                E-maile
              </span>
            </button>

            <button
              id="nav-btn-docker"
              onClick={() => setActiveTab("docker")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all cursor-pointer group select-none ${
                activeTab === "docker"
                  ? "bg-white/10 text-white font-bold shadow-xs"
                  : "text-indigo-300/80 hover:bg-white/5 hover:text-indigo-100"
              }`}
              title="Architektura Docker"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">
                🐳
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                Docker
              </span>
            </button>

            <button
              id="nav-btn-analytics"
              onClick={() => setActiveTab("analytics")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all cursor-pointer group select-none ${
                activeTab === "analytics"
                  ? "bg-white/10 text-white font-bold shadow-xs"
                  : "text-indigo-300/80 hover:bg-white/5 hover:text-indigo-100"
              }`}
              title="Analityka i raporty"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">
                📊
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                Analizy
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Avatar profile */}
        <div
          id="bento-sidebar-bottom"
          className="flex flex-col items-center gap-3 w-full px-2"
        >
          <div className="w-[60%] border-t border-indigo-900/40 my-1"></div>
          <div
            className="w-10 h-10 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-[11px] font-bold text-indigo-100 font-mono tracking-wider select-none shrink-0"
            title={`Aktywny profil: ${currentUser.name}`}
          >
            {currentUser.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <span className="text-[7px] uppercase tracking-widest text-indigo-400 font-bold font-mono">
            {currentUser.role}
          </span>
        </div>
      </nav>

      {/* 2. Main Workspace Layout */}
      <div
        id="bento-workspace-root"
        className="flex-1 min-w-0 flex flex-col min-h-screen"
      >
        {/* Testing Suite identity switcher (Modern Top Banner) */}
        <div
          id="bento-identity-switcher-banner"
          className="bg-slate-900 px-4 py-2 text-slate-305 border-b border-slate-950 text-xs flex flex-wrap justify-between items-center gap-3 z-30 shadow-inner"
        >
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-2 py-0.5 rounded text-[9px] uppercase font-mono font-bold tracking-wider text-white shadow-sm">
              Środowisko testowe RBAC
            </span>
            <span className="text-slate-400 font-medium">
              Zmień portal użytkownika, aby sprawdzić uprawnienia roli w czasie
              rzeczywistym:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="user-switch-select" className="sr-only">
              Wybierz portal
            </label>
            <select
              id="user-switch-select"
              value={currentUser.id}
              onChange={(e) => handleUserSwitch(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-[11px] text-slate-100 rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans font-semibold cursor-pointer shadow-xs transition-colors hover:bg-slate-750"
            >
              {DEMO_USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  Portal {user.role.toUpperCase()}: {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile top navigation header (Only visible below md) */}
        <div
          id="bento-mobile-header"
          className="md:hidden bg-indigo-950 px-4 py-3 pb-4 flex flex-col gap-3 border-b border-indigo-900 text-white z-20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight block">
                  Centrum Wsparcia IT
                </span>
                <span className="text-[10px] text-indigo-300 font-mono">
                  Rola: {currentUser.role.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Quick action role display */}
            <div className="w-8 h-8 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center text-xs font-bold text-indigo-100 select-none">
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
          </div>

          {/* Selector Navigation Row */}
          <div className="grid grid-cols-5 gap-1 text-center text-[9px] select-none font-bold">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-900/50 text-indigo-300"
              }`}
            >
              📋 Zgł.
            </button>
            <button
              onClick={() => setActiveTab("submit")}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                activeTab === "submit"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-900/50 text-indigo-300"
              }`}
            >
              ✏️ Nowe
            </button>
            <button
              onClick={() => setActiveTab("mailbox")}
              className={`py-2 rounded-lg transition-colors cursor-pointer relative ${
                activeTab === "mailbox"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-900/50 text-indigo-300"
              }`}
            >
              ✉️ Mail
              {logs.length > 0 && (
                <span className="absolute -top-1 right-0 bg-red-500 text-white text-[7px] px-1 rounded-full">
                  {logs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("docker")}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                activeTab === "docker"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-900/50 text-indigo-300"
              }`}
            >
              🐳 Docker
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-900/50 text-indigo-300"
              }`}
            >
              📊 Analizy
            </button>
          </div>
        </div>

        {/* 3. Top Header Panel (ServiceOps Styled) */}
        <header
          id="bento-top-header"
          className="bg-white border-b border-slate-200 py-6 px-6 md:px-8"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans flex items-center gap-2">
                Panel ServiceOps
              </h1>
              <p className="text-slate-550 text-xs mt-1">
                Witaj z powrotem,{" "}
                <strong className="text-slate-700 font-semibold">
                  {currentUser.name}
                </strong>{" "}
                • Uprawnienia sektora:{" "}
                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border border-slate-200 uppercase">
                  {currentUser.role}
                </span>
              </p>
            </div>

            {/* Live system telemetry trackers styled as Bento chips */}
            <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto">
              {/* WebSocket Ping status */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  wsConnected
                    ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                    : "bg-rose-50 border-rose-250 text-rose-800"
                }`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {wsConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? "bg-emerald-500" : "bg-rose-500"}`}
                  ></span>
                </span>
                <span>
                  {wsConnected ? "Połączenie aktywne" : "WebSocket offline"}
                </span>
              </div>

              {/* Database indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-850 shadow-2xs">
                <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  Baza danych:{" "}
                  <strong className="font-bold">{dbMode.toUpperCase()}</strong>
                </span>
              </div>

              {/* Quick action portal link button tailored to role */}
              {activeTab !== "submit" && (
                <button
                  onClick={() => setActiveTab("submit")}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold text-xs shadow-xs transition-all cursor-pointer select-none"
                >
                  + Nowe zgłoszenie
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 4. Primary Workspace Content Panel */}
        <main
          id="bento-main-workspace"
          className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 space-y-6"
        >
          {/* Global Connectivity Errors Banner */}
          {apiError && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <strong className="font-bold">
                  Przerwa w połączeniu z bazą danych:
                </strong>
                <p className="leading-normal">
                  {apiError} Sprawdź logi piaskownicy systemowej, aby
                  zweryfikować stan synchronizacji schematu lub poświadczenia
                  bazy.
                </p>
                <button
                  onClick={async () => {
                    setApiError(null);
                    setLoading(true);
                    await Promise.all([
                      fetchTickets(),
                      fetchNotificationLogs(),
                      fetchSystemStatus(),
                    ]);
                    setLoading(false);
                  }}
                  className="mt-2.5 flex items-center gap-1.5 bg-white border border-rose-205 hover:bg-rose-100/30 text-[10px] text-rose-800 font-bold px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Ponów połączenie
                </button>
              </div>
            </div>
          )}

          {/* Dynamic inner container router */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-205 py-36 text-center flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-9 w-9 border-3 border-indigo-600 border-t-transparent mb-4"></div>
              <p className="text-xs text-slate-500 font-semibold tracking-wide">
                Pobieranie klastrów systemowych. Proszę czekać...
              </p>
            </div>
          ) : (
            <div
              id="bento-inner-view-container"
              className="fade-in duration-300"
            >
              {activeTab === "dashboard" && (
                <TicketDashboard
                  tickets={tickets}
                  currentUser={currentUser}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdatePriority={handleUpdatePriority}
                  onAssignTicket={handleAssignTicket}
                  onPostMessage={handlePostMessage}
                />
              )}

              {activeTab === "submit" && (
                <TicketForm
                  clientId={currentUser.id}
                  clientName={currentUser.name}
                  clientEmail={currentUser.email}
                  onTicketSubmitted={handleTicketSubmitted}
                />
              )}

              {activeTab === "mailbox" && (
                <NotificationCenter
                  logs={logs}
                  onRefreshLogs={fetchNotificationLogs}
                />
              )}

              {activeTab === "docker" && <DockerGuide />}

              {activeTab === "analytics" && <Dashboard onError={setApiError} />}
            </div>
          )}
        </main>

        {/* 5. Sticky Professional Technical Footer */}
        <footer
          id="bento-footer"
          className="bg-slate-900 text-slate-400 border-t border-slate-950 py-6 text-center text-xs space-y-1.5 mt-auto"
        >
          <p className="text-slate-300 font-sans font-medium tracking-wide">
            Panel Zarządzania Zgłoszeniami Wsparcia IT &copy;{" "}
            {new Date().getFullYear()} – bento panel
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span>
              Użytkownik:{" "}
              <strong className="text-slate-300">{currentUser.name}</strong>
            </span>
            <span>•</span>
            <span>
              Rola dostępu:{" "}
              <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-[9px] font-bold uppercase">
                {currentUser.role}
              </span>
            </span>
            <span>•</span>
            <span>
              Środowisko:{" "}
              <span className="text-indigo-400 font-mono">v22.x</span>
            </span>
          </div>
        </footer>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
