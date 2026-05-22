export type UserRole = 'client' | 'agent' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export type TicketCategory = 'hardware' | 'software' | 'network' | 'access' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Attachment {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded content
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  createdAt: string;
  isInternal?: boolean; // Internal notes for agents/admins
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  clientId: string;
  clientName: string;
  clientEmail: string;
  assignedTo?: string; // Agent ID
  assignedName?: string; // Agent Name
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  messages: TicketMessage[];
  location?: string; // Store code or description
}

export interface NotificationLog {
  id: string;
  ticketId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'simulated' | 'sent';
}

export interface DBState {
  tickets: Ticket[];
  notifications: NotificationLog[];
}
