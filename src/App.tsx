import React, { useEffect } from "react";
import { useTicketStore } from "./store/useTicketStore";
import { useWebSocket } from "./hooks/useWebSocket";
import { useToast } from "./hooks/useToast";
import TicketForm from "./components/TicketForm";
import TicketDashboard from "./components/TicketDashboard";
import NotificationCenter from "./components/NotificationCenter";
import DockerGuide from "./components/DockerGuide";
import Dashboard from "./components/Dashboard";
import { ToastContainer } from "./components/Toast";
import LoginPage from "./components/LoginPage";
import {
  Wifi,
  WifiOff,
  Database,
  Layers,
  ShieldCheck,
  Mail,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  LogOut,
  Zap,
  Terminal,
  Activity,
} from "lucide-react";

const SUPPORT_ENGINEERS = [{ id: "admin-1", name: "Administrator (IT)" }];

export default function App() {
  const {
    isLoggedIn,
    currentUser,
    tickets,
    logs,
    activeTab,
    wsConnected,
    dbMode,
    activeUsersCount,
    loading,
    apiError,
    unseenUpdates,
    login,
    logout,
    setActiveTab,
    fetchTickets,
    fetchNotificationLogs,
    fetchSystemStatus,
    submitTicket,
    updateTicketStatus,
    updateTicketPriority,
    assignTicket,
    postMessage,
  } = useTicketStore();

  const { toasts, addToast, dismissToast } = useToast();
  useWebSocket();

  useEffect(() => {
    if (!isLoggedIn) return;
    const bootstrap = async () => {
      useTicketStore.getState().setLoading(true);
      useTicketStore.getState().setApiError(null);
      await Promise.all([fetchTickets(), fetchNotificationLogs(), fetchSystemStatus()]);
      useTicketStore.getState().setLoading(false);
    };
    bootstrap();
  }, [isLoggedIn, fetchTickets, fetchNotificationLogs, fetchSystemStatus]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setInterval(fetchSystemStatus, 15000);
    return () => clearInterval(timer);
  }, [isLoggedIn, fetchSystemStatus]);

  const handleUpdateStatus = async (ticketId: string, status: any) => {
    try {
      await updateTicketStatus(ticketId, status);
      addToast("success", "Status zgłoszenia zaktualizowany.");
    } catch (err: any) {
      addToast("error", `Błąd aktualizacji statusu: ${err.message}`);
    }
  };

  const handleUpdatePriority = async (ticketId: string, priority: any) => {
    try {
      await updateTicketPriority(ticketId, priority);
      addToast("success", "Priorytet zgłoszenia zaktualizowany.");
    } catch (err: any) {
      addToast("error", `Błąd aktualizacji priorytetu: ${err.message}`);
    }
  };

  const handleAssignTicket = async (ticketId: string, agentId: string, agentName: string) => {
    try {
      await assignTicket(ticketId, agentId, agentName);
      addToast("success", "Zgłoszenie przypisane do pracownika.");
    } catch (err: any) {
      addToast("error", `Błąd przypisania: ${err.message}`);
    }
  };

  const handlePostMessage = async (ticketId: string, messageText: string, isInternal: boolean) => {
    try {
      await postMessage(ticketId, messageText, isInternal);
      addToast("success", "Wiadomość wysłana.");
    } catch (err: any) {
      addToast("error", `Błąd wysyłania wiadomości: ${err.message}`);
    }
  };

  const handleTicketSubmitted = async (ticketData: any) => {
    await submitTicket(ticketData);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col md:flex-row font-sans antialiased overflow-hidden">
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <nav className="hidden md:flex w-20 bg-[#0d0d14]/80 backdrop-blur-xl border-r border-white/5 flex-col items-center py-6 gap-4 shrink-0 z-10 justify-between">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo */}
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 relative group cursor-pointer">
            <Zap className="w-5 h-5 text-white" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d0d14] ${wsConnected ? "bg-emerald-400 shadow-emerald-400/50 shadow-sm" : "bg-red-400"}`} />
          </div>

          <div className="w-8 border-b border-white/5 my-1" />

          {/* Nav buttons */}
          {[
            { id: "dashboard" as const, icon: <Terminal className="w-4 h-4" />, label: "Zgłoszenia", badge: unseenUpdates },
            { id: "analytics" as const, icon: <BarChart3 className="w-4 h-4" />, label: "Analityka", badge: 0 },
            { id: "submit" as const, icon: <Zap className="w-4 h-4" />, label: "Nowe", badge: 0 },
            { id: "mailbox" as const, icon: <Mail className="w-4 h-4" />, label: "Poczta", badge: 0 },
            { id: "docker" as const, icon: <Database className="w-4 h-4" />, label: "Deploy", badge: 0 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-2.5 px-2 w-full rounded-xl transition-all duration-200 cursor-pointer group select-none relative ${
                activeTab === item.id
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[7px] font-bold px-1 rounded-full min-w-[14px] text-center leading-[14px]">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[8px] uppercase tracking-[0.15em] font-semibold">{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-indigo-400 to-violet-500 rounded-r" />
              )}
            </button>
          ))}
        </div>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-1 text-[8px] text-white/20 uppercase tracking-widest">
            <Activity className={`w-3 h-3 ${wsConnected ? "text-emerald-400" : "text-red-400"}`} />
            <span>{wsConnected ? "LIVE" : "OFF"}</span>
          </div>
          <button
            onClick={logout}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
            title="Wyloguj"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0d0d14]/80 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">IT Support</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400" : "bg-red-400"}`} />
          <button onClick={logout} className="text-white/30 hover:text-rose-400 cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden flex items-center gap-1 px-2 py-2 bg-[#0d0d14]/60 backdrop-blur border-b border-white/5 overflow-x-auto z-10">
        {[
          { id: "dashboard" as const, label: "Zgłoszenia" },
          { id: "analytics" as const, label: "Analityka" },
          { id: "submit" as const, label: "Nowe" },
          { id: "mailbox" as const, label: "Poczta" },
          { id: "docker" as const, label: "Deploy" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === item.id
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        {/* Top status bar */}
        <div className="sticky top-0 z-20 px-6 py-3 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                {activeTab === "dashboard" && "Panel Zgłoszeń"}
                {activeTab === "analytics" && "Analityka & Raporty"}
                {activeTab === "submit" && "Nowe Zgłoszenie"}
                {activeTab === "mailbox" && "Centrum Powiadomień"}
                {activeTab === "docker" && "Wdrożenie & Infrastruktura"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Status chips */}
              <div className="hidden sm:flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                  wsConnected
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/20 bg-red-500/10 text-red-400"
                }`}>
                  {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {wsConnected ? "POŁĄCZONO" : "ROZŁĄCZONO"}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-violet-500/20 bg-violet-500/10 text-violet-400">
                  <Database className="w-3 h-3" />
                  {dbMode === "postgresql" ? "PostgreSQL" : "JSON"}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/50">
                  <ShieldCheck className="w-3 h-3" />
                  {currentUser.name}
                </div>
              </div>
              <button
                onClick={() => {
                  fetchTickets();
                  fetchNotificationLogs();
                  fetchSystemStatus();
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer"
                title="Odśwież"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="p-4 md:p-6">
          {apiError && (
            <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {apiError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-xs text-white/30 uppercase tracking-widest">Ładowanie systemu...</span>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <TicketDashboard
                  tickets={tickets}
                  currentUser={currentUser}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdatePriority={handleUpdatePriority}
                  onAssignTicket={handleAssignTicket}
                  onPostMessage={handlePostMessage}
                  supportEngineers={SUPPORT_ENGINEERS}
                />
              )}
              {activeTab === "analytics" && (
                <Dashboard onError={(msg) => addToast("error", msg)} />
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
                <NotificationCenter logs={logs} onRefreshLogs={fetchNotificationLogs} />
              )}
              {activeTab === "docker" && <DockerGuide />}
            </>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
