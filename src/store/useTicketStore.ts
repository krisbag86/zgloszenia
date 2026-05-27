import { create } from "zustand";
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  NotificationLog,
  Attachment,
  User,
} from "../types";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface TicketStore {
  // Auth
  isLoggedIn: boolean;
  currentUser: User;
  login: (username: string, password: string) => boolean;
  logout: () => void;

  // Tickets
  tickets: Ticket[];
  pagination: PaginationMeta;
  loading: boolean;
  apiError: string | null;

  // Notifications
  logs: NotificationLog[];

  // Connection
  wsConnected: boolean;
  dbMode: "postgresql" | "local-json-memory";
  activeUsersCount: number;

  // UI state
  activeTab: "dashboard" | "analytics" | "submit" | "mailbox" | "docker";
  unseenUpdates: number;

  // Actions
  setActiveTab: (tab: TicketStore["activeTab"]) => void;
  setWsConnected: (connected: boolean) => void;
  setDbMode: (mode: TicketStore["dbMode"]) => void;
  setActiveUsersCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  setApiError: (error: string | null) => void;
  incrementUnseen: () => void;
  clearUnseen: () => void;

  // Ticket mutations
  setTickets: (tickets: Ticket[]) => void;
  setPagination: (pagination: PaginationMeta) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicketInStore: (ticket: Ticket) => void;

  // Log mutations
  setLogs: (logs: NotificationLog[]) => void;
  addLog: (log: NotificationLog) => void;

  // API actions
  fetchTickets: (params?: Record<string, string>) => Promise<void>;
  fetchNotificationLogs: () => Promise<void>;
  fetchSystemStatus: () => Promise<void>;
  submitTicket: (ticketData: {
    title: string;
    description: string;
    category: string;
    priority: string;
    attachments: Attachment[];
    location?: string;
  }) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  updateTicketPriority: (ticketId: string, priority: TicketPriority) => Promise<void>;
  assignTicket: (ticketId: string, agentId: string, agentName: string) => Promise<void>;
  postMessage: (ticketId: string, messageText: string, isInternal: boolean) => Promise<void>;
}

const ADMIN_USER: User = {
  id: "admin-1",
  name: "Administrator",
  email: "admin@bagietka.pl",
  role: "admin",
};

const VALID_CREDENTIALS = { username: "admin", password: "admin" };

export const useTicketStore = create<TicketStore>((set, get) => ({
  // Auth
  isLoggedIn: sessionStorage.getItem("it_auth") === "1",
  currentUser: ADMIN_USER,

  login: (username: string, password: string) => {
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
      set({ isLoggedIn: true });
      sessionStorage.setItem("it_auth", "1");
      return true;
    }
    return false;
  },

  logout: () => {
    set({ isLoggedIn: false });
    sessionStorage.removeItem("it_auth");
  },

  // Tickets
  tickets: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  loading: true,
  apiError: null,

  // Notifications
  logs: [],

  // Connection
  wsConnected: false,
  dbMode: "local-json-memory",
  activeUsersCount: 0,

  // UI state
  activeTab: "dashboard",
  unseenUpdates: 0,

  // Actions
  setActiveTab: (tab) => {
    set({ activeTab: tab });
    if (tab === "dashboard") set({ unseenUpdates: 0 });
  },
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setDbMode: (mode) => set({ dbMode: mode }),
  setActiveUsersCount: (count) => set({ activeUsersCount: count }),
  setLoading: (loading) => set({ loading }),
  setApiError: (error) => set({ apiError: error }),
  incrementUnseen: () => {
    const state = get();
    if (state.activeTab !== "dashboard") {
      set({ unseenUpdates: state.unseenUpdates + 1 });
    }
  },
  clearUnseen: () => set({ unseenUpdates: 0 }),

  // Ticket mutations
  setTickets: (tickets) => set({ tickets }),
  setPagination: (pagination) => set({ pagination }),
  addTicket: (ticket) => {
    const state = get();
    if (!state.tickets.some((t) => t.id === ticket.id)) {
      set({ tickets: [ticket, ...state.tickets] });
    }
  },
  updateTicketInStore: (ticket) => {
    set({ tickets: get().tickets.map((t) => (t.id === ticket.id ? ticket : t)) });
  },

  // Log mutations
  setLogs: (logs) => set({ logs }),
  addLog: (log) => {
    const state = get();
    if (!state.logs.some((l) => l.id === log.id)) {
      set({ logs: [log, ...state.logs] });
    }
  },

  // API actions
  fetchTickets: async (params) => {
    try {
      const searchParams = new URLSearchParams(params);
      const resp = await fetch(`/api/tickets?${searchParams.toString()}`);
      if (!resp.ok) throw new Error("Failed to retrieve support queue.");
      const data = await resp.json();
      // Support both paginated and non-paginated responses
      if (data.data && data.pagination) {
        set({ tickets: data.data, pagination: data.pagination });
      } else if (Array.isArray(data)) {
        set({ tickets: data });
      }
    } catch (err: any) {
      set({ apiError: "Unable to communicate with the IT Helpdesk API server." });
    }
  },

  fetchNotificationLogs: async () => {
    try {
      const resp = await fetch("/api/notifications");
      if (resp.ok) {
        set({ logs: await resp.json() });
      }
    } catch (err) {
      console.error("Failed to sync outgoing log history:", err);
    }
  },

  fetchSystemStatus: async () => {
    try {
      const resp = await fetch("/api/status");
      if (resp.ok) {
        const data = await resp.json();
        set({ dbMode: data.database, activeUsersCount: data.connectedClients });
      }
    } catch (err) {
      console.error("System status ping failed:", err);
    }
  },

  submitTicket: async (ticketData) => {
    const state = get();
    const payload = {
      ...ticketData,
      clientId: state.currentUser.id,
      clientName: state.currentUser.name,
      clientEmail: state.currentUser.email,
    };

    const resp = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorMsg = await resp.json();
      throw new Error(errorMsg.error || "Failed to file your ticket application.");
    }

    set({ activeTab: "dashboard" });
  },

  updateTicketStatus: async (ticketId, status) => {
    const state = get();
    const resp = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        currentUserRole: state.currentUser.role,
        currentUserId: state.currentUser.id,
      }),
    });
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error);
    }
  },

  updateTicketPriority: async (ticketId, priority) => {
    const state = get();
    const resp = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priority,
        currentUserRole: state.currentUser.role,
        currentUserId: state.currentUser.id,
      }),
    });
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error);
    }
  },

  assignTicket: async (ticketId, agentId, agentName) => {
    const state = get();
    const resp = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedTo: agentId,
        assignedName: agentName,
        currentUserRole: state.currentUser.role,
        currentUserId: state.currentUser.id,
      }),
    });
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error);
    }
  },

  postMessage: async (ticketId, messageText, isInternal) => {
    const state = get();
    const resp = await fetch(`/api/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId: state.currentUser.id,
        senderName: state.currentUser.name,
        senderRole: state.currentUser.role,
        message: messageText,
        isInternal,
      }),
    });
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error);
    }
  },
}));
