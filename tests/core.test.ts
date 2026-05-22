import test from "node:test";
import assert from "node:assert";
import {
  getTickets,
  createTicket,
  getTicketById,
  updateTicket,
  addTicketMessage,
  addNotification,
  getNotifications,
} from "../src/dataStore";
import { Ticket, TicketMessage, NotificationLog } from "../src/types";

// Fast core unit tests run with Node.js built-in runner.
test("IT Support Core System Test Suite", async (t) => {
  await t.test("1. Ticket store initialises empty", async () => {
    const list = await getTickets();
    assert.ok(Array.isArray(list), "Tickets list must be an array");
    assert.strictEqual(list.length, 0, "Fresh store should contain no tickets");
  });

  await t.test(
    "2. Ticket registration persistent creation matches values",
    async () => {
      const mockTicket: Ticket = {
        id: "tk-test-999",
        title: "Database connection pool leakage",
        description:
          "Backend is throwing max connection limits reached errors when running heavy query loops during backups.",
        category: "software",
        priority: "urgent",
        status: "open",
        clientId: "client-99",
        clientName: "Alice Dev",
        clientEmail: "alice@eng.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: [],
        messages: [],
      };

      const saved = await createTicket(mockTicket);
      assert.strictEqual(saved.id, "tk-test-999");
      assert.strictEqual(saved.title, "Database connection pool leakage");
      assert.strictEqual(saved.category, "software");

      // Retrieve and verify
      const retrieved = await getTicketById("tk-test-999");
      assert.ok(retrieved, "Should retrieve created test ticket");
      assert.strictEqual(retrieved?.clientId, "client-99");
      assert.strictEqual(retrieved?.status, "open");
    },
  );

  await t.test("3. Modifying status is correctly persisted", async () => {
    const ticketId = "tk-test-999";

    const updated = await updateTicket(ticketId, {
      status: "resolved",
      assignedTo: "agent-10",
      assignedName: "Marcus Miller (Senior Ops)",
    });

    assert.ok(updated, "Ticket update should succeed");
    assert.strictEqual(
      updated?.status,
      "resolved",
      "Status must transition to resolved",
    );
    assert.strictEqual(updated?.assignedTo, "agent-10");
    assert.strictEqual(updated?.assignedName, "Marcus Miller (Senior Ops)");

    const fetched = await getTicketById(ticketId);
    assert.strictEqual(fetched?.status, "resolved");
    assert.strictEqual(fetched?.assignedTo, "agent-10");
  });

  await t.test("4. Ticket conversations appending updates feed", async () => {
    const ticketId = "tk-test-999";
    const msg: TicketMessage = {
      id: "m-test-1",
      ticketId,
      senderId: "agent-10",
      senderName: "Marcus Miller (Senior Ops)",
      senderRole: "agent",
      message:
        "Added pg_pool stats logging. Leakage was on server index. Fixed connections overflow.",
      createdAt: new Date().toISOString(),
      isInternal: false,
    };

    const result = await addTicketMessage(ticketId, msg);
    assert.ok(result, "Appending message should return ticket object");
    assert.strictEqual(result?.messages.length, 1);
    assert.strictEqual(
      result?.messages[0].message,
      "Added pg_pool stats logging. Leakage was on server index. Fixed connections overflow.",
    );
    assert.strictEqual(result?.messages[0].senderRole, "agent");
  });

  await t.test("5. Trigger notification logging", async () => {
    const log: NotificationLog = {
      id: "notif-test-1",
      ticketId: "tk-test-999",
      recipientEmail: "alice@eng.com",
      recipientName: "Alice Dev",
      subject: "IT Support Ticket Update: tk-test-999 is now RESOLVED",
      body: "Hi Alice, your ticket connection leakage is fixed.",
      sentAt: new Date().toISOString(),
      status: "simulated",
    };

    const savedLog = await addNotification(log);
    assert.strictEqual(savedLog.id, "notif-test-1");
    assert.strictEqual(savedLog.recipientEmail, "alice@eng.com");

    const totalLogs = await getNotifications();
    const found = totalLogs.find((l) => l.id === "notif-test-1");
    assert.ok(found, "Should find the notification log in storage");
  });
});
