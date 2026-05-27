import { Router, Request, Response } from "express";
import { WebSocket } from "ws";
import {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addTicketMessage,
  addNotification,
  getNotifications,
  isPostgresConnected,
} from "../../dataStore";
import { Ticket, TicketMessage, NotificationLog } from "../../types";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  PostMessageSchema,
  PaginationSchema,
} from "../validation/schemas";
import { ticketCreationLimiter, messageLimiter } from "../middleware/rateLimiter";

export function createTicketRoutes(
  broadcast: (payload: any) => void,
  generateId: (prefix: string) => string,
  triggerNotification: (
    ticketId: string,
    recipientEmail: string,
    recipientName: string,
    subject: string,
    body: string,
  ) => Promise<NotificationLog>,
) {
  const router = Router();

  // Fetch all tickets (paginated)
  router.get("/", validateQuery(PaginationSchema), async (req: Request, res: Response) => {
    try {
      const { page, limit, status, priority, category, search, sortBy, sortOrder } = req.query as any;

      let tickets = await getTickets();

      // Apply filters
      if (status) tickets = tickets.filter((t) => t.status === status);
      if (priority) tickets = tickets.filter((t) => t.priority === priority);
      if (category) tickets = tickets.filter((t) => t.category === category);
      if (search) {
        const searchLower = (search as string).toLowerCase();
        tickets = tickets.filter(
          (t) =>
            t.title.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower) ||
            t.id.toLowerCase().includes(searchLower) ||
            t.clientName.toLowerCase().includes(searchLower),
        );
      }

      // Apply sorting
      const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };

      tickets.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "priority":
            comparison = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
            break;
          case "status":
            comparison = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
            break;
          case "updatedAt":
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case "createdAt":
          default:
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Apply pagination
      const total = tickets.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedTickets = tickets.slice(offset, offset + limit);

      res.json({
        data: paginatedTickets,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve tickets.", details: err.message });
    }
  });

  // Fetch ticket by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const ticket = await getTicketById(req.params.id);
      if (!ticket) {
        res.status(404).json({ error: `Ticket ${req.params.id} not found.` });
        return;
      }
      res.json(ticket);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve ticket info.", details: err.message });
    }
  });

  // Create new ticket
  router.post(
    "/",
    ticketCreationLimiter,
    validateBody(CreateTicketSchema),
    async (req: Request, res: Response) => {
      try {
        const { title, description, category, priority, clientName, clientEmail, clientId, attachments, location } = req.body;

        const ticketId = generateId("tk");
        const timeNow = new Date().toISOString();

        const newTicket: Ticket = {
          id: ticketId,
          title,
          description,
          category,
          priority,
          status: "open",
          clientId,
          clientName,
          clientEmail,
          createdAt: timeNow,
          updatedAt: timeNow,
          attachments: attachments || [],
          messages: [],
          location: location || undefined,
        };

        const savedTicket = await createTicket(newTicket);

        await triggerNotification(
          ticketId,
          clientEmail,
          clientName,
          `Ticket Created: ${title} [${ticketId}]`,
          `Hi ${clientName},\n\nYour IT Support ticket has been successfully registered under ticket ID: ${ticketId}.\nIT engineers will review and respond shortly.\n\nDescription: ${description}`,
        );

        broadcast({ type: "ticket_created", ticket: savedTicket });
        res.status(201).json(savedTicket);
      } catch (err: any) {
        res.status(500).json({ error: "Ticket registration failed.", details: err.message });
      }
    },
  );

  // Update ticket (status, priority, assignment)
  router.patch(
    "/:id",
    validateBody(UpdateTicketSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const original = await getTicketById(id);
        if (!original) {
          res.status(404).json({ error: "Ticket not found to update." });
          return;
        }

        const { status, priority, assignedTo, assignedName, currentUserRole, currentUserId } = req.body;

        // RBAC: clients may only resolve/close their own tickets
        if (currentUserRole === "client") {
          if (original.clientId !== currentUserId) {
            res.status(403).json({ error: "Forbidden: clients can only modify their own tickets." });
            return;
          }
          if (status && status !== "resolved" && status !== "closed") {
            res.status(403).json({ error: "Forbidden: clients may only resolve or close their own tickets." });
            return;
          }
          if (priority !== undefined || assignedTo !== undefined) {
            res.status(403).json({ error: "Forbidden: clients cannot change priority or assignment." });
            return;
          }
        } else if (!currentUserRole || (currentUserRole !== "agent" && currentUserRole !== "admin")) {
          res.status(403).json({ error: "Forbidden: only agents and admins can update tickets." });
          return;
        }

        // Agents may only assign tickets to themselves
        if (currentUserRole === "agent" && assignedTo !== undefined && assignedTo !== currentUserId) {
          res.status(403).json({ error: "Forbidden: agents can only assign tickets to themselves." });
          return;
        }

        const updates: Partial<Ticket> = {};
        if (status) updates.status = status;
        if (priority) updates.priority = priority;
        if (assignedTo !== undefined) updates.assignedTo = assignedTo;
        if (assignedName !== undefined) updates.assignedName = assignedName;

        const updated = await updateTicket(id, updates);
        if (!updated) {
          res.status(500).json({ error: "Failed to write updates." });
          return;
        }

        if (status && status !== original.status) {
          await triggerNotification(
            id,
            original.clientEmail,
            original.clientName,
            `IT Support Ticket Updated: ${id} is now ${status.replace("_", " ").toUpperCase()}`,
            `Hi ${original.clientName},\n\nThe status of your IT Ticket [${id}] "${original.title}" has been updated.\n\nPrevious status: ${original.status.toUpperCase()}\nNew status: ${status.toUpperCase()}\n\nYou can track ongoing diagnostics feed inside the real-time panel.`,
          );
        } else if (assignedTo && assignedTo !== original.assignedTo) {
          await triggerNotification(
            id,
            original.clientEmail,
            original.clientName,
            `IT Support Ticket Assigned: ${id}`,
            `Hi ${original.clientName},\n\nYour IT Ticket [${id}] "${original.title}" has been placed in the queue of Support Engineer: ${assignedName}.`,
          );
        }

        broadcast({ type: "ticket_updated", ticket: updated });
        res.json(updated);
      } catch (err: any) {
        res.status(500).json({ error: "Update processing failed.", details: err.message });
      }
    },
  );

  // Post discussion / comment or internal note
  router.post(
    "/:id/messages",
    messageLimiter,
    validateBody(PostMessageSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { senderId, senderName, senderRole, message, isInternal } = req.body;

        const ticket = await getTicketById(id);
        if (!ticket) {
          res.status(404).json({ error: "Ticket not found." });
          return;
        }

        // RBAC: clients may only message on their own tickets and cannot post internal notes
        if (senderRole === "client") {
          if (ticket.clientId !== senderId) {
            res.status(403).json({ error: "Forbidden: clients can only post messages on their own tickets." });
            return;
          }
          if (isInternal) {
            res.status(403).json({ error: "Forbidden: clients cannot post internal notes." });
            return;
          }
        }

        const messageObj: TicketMessage = {
          id: generateId("msg"),
          ticketId: id,
          senderId,
          senderName,
          senderRole,
          message,
          createdAt: new Date().toISOString(),
          isInternal: !!isInternal,
        };

        const updatedTicket = await addTicketMessage(id, messageObj);
        if (!updatedTicket) {
          res.status(500).json({ error: "Failed to append message." });
          return;
        }

        if (!isInternal && (senderRole === "agent" || senderRole === "admin")) {
          await triggerNotification(
            id,
            ticket.clientEmail,
            ticket.clientName,
            `New Support Message on Ticket [${id}]`,
            `Hi ${ticket.clientName},\n\nSupport Engineer ${senderName} left a message on your ticket [${id}]:\n\n"${message}"\n\nPlease check the support app to view active tracking.`,
          );
        }

        broadcast({ type: "ticket_updated", ticket: updatedTicket });
        res.status(201).json(messageObj);
      } catch (err: any) {
        res.status(500).json({ error: "Message post failed.", details: err.message });
      }
    },
  );

  return router;
}
