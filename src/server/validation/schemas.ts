import { z } from "zod";

const VALID_CATEGORIES = ["hardware", "software", "network", "access", "other"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const VALID_ROLES = ["client", "agent", "admin"] as const;

export const AttachmentSchema = z.object({
  name: z.string().min(1, "Attachment name is required"),
  type: z.string().min(1),
  size: z.number().positive().max(10 * 1024 * 1024, "Attachment exceeds 10MB limit"),
  data: z.string().min(1, "Attachment data is required"),
});

export const CreateTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().min(1, "Description is required").max(10000, "Description too long"),
  category: z.enum(VALID_CATEGORIES, { error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}` }),
  priority: z.enum(VALID_PRIORITIES, { error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` }),
  clientName: z.string().min(1, "Client name is required").max(150),
  clientEmail: z.string().email("Invalid email format").max(150),
  clientId: z.string().min(1, "Client ID is required").max(100),
  attachments: z.array(AttachmentSchema).max(10, "Maximum 10 attachments").optional().default([]),
  location: z.string().max(255).optional(),
});

export const UpdateTicketSchema = z.object({
  status: z.enum(VALID_STATUSES, { error: `Status must be one of: ${VALID_STATUSES.join(", ")}` }).optional(),
  priority: z.enum(VALID_PRIORITIES, { error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` }).optional(),
  assignedTo: z.string().max(100).optional(),
  assignedName: z.string().max(150).optional(),
  currentUserRole: z.enum(VALID_ROLES, { error: "Invalid user role" }),
  currentUserId: z.string().min(1, "User ID is required"),
});

export const PostMessageSchema = z.object({
  senderId: z.string().min(1, "Sender ID is required"),
  senderName: z.string().min(1, "Sender name is required").max(150),
  senderRole: z.enum(VALID_ROLES, { error: "Invalid sender role" }),
  message: z.string().min(1, "Message cannot be empty").max(5000, "Message too long"),
  isInternal: z.boolean().optional().default(false),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(VALID_STATUSES).optional(),
  priority: z.enum(VALID_PRIORITIES).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "priority", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type PostMessageInput = z.infer<typeof PostMessageSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
