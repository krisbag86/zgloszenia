# Component Development Guide: React + TypeScript Patterns

Best practices for building new dashboard features, forms, and interactive components for the IT support system.

---

## Architecture Overview

```
App.tsx (state container)
├── state: tickets, logs, notifications
├── WebSocket manager
├── user switcher (role-based rendering)
└── routes to:
    ├── TicketDashboard (list + filter)
    ├── TicketForm (create new)
    ├── NotificationCenter (email logs)
    └── DockerGuide (deployment help)
```

All data flows **down** as props; events flow **up** via callbacks.

---

## Part 1: Creating a New Component

### Template

Create `src/components/YourComponent.tsx`:

```typescript
import React, { useState, useCallback } from 'react';
import { Ticket, User } from '../types';

interface YourComponentProps {
  tickets: Ticket[];
  currentUser: User;
  onUpdate: (ticket: Ticket) => void;
  onError: (message: string) => void;
}

export default function YourComponent({
  tickets,
  currentUser,
  onUpdate,
  onError,
}: YourComponentProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = useCallback(async () => {
    setIsLoading(true);
    try {
      // Call API
      const response = await fetch('/api/tickets/...');
      if (!response.ok) throw new Error('Failed');
      
      const data = await response.json();
      onUpdate(data);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [onUpdate, onError]);

  return (
    <div className="p-4">
      {/* Your UI here */}
      <button onClick={handleAction} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Action'}
      </button>
    </div>
  );
}
```

### Register in App.tsx

```typescript
import YourComponent from './components/YourComponent';

// In the tab navigation
<nav>
  <button onClick={() => setActiveTab('your-feature')}>Your Feature</button>
</nav>

// In the render section
{activeTab === 'your-feature' && (
  <YourComponent
    tickets={tickets}
    currentUser={currentUser}
    onUpdate={(ticket) => setTickets(prev => [
      ...prev.map(t => t.id === ticket.id ? ticket : t)
    ])}
    onError={setApiError}
  />
)}
```

---

## Part 2: Role-Based Rendering

### Pattern 1: Conditional Rendering by Role

```typescript
function YourComponent({ currentUser, ...props }: YourComponentProps) {
  if (currentUser.role === 'client') {
    return (
      <div>
        <p>Client view: your tickets</p>
        {/* Limited UI */}
      </div>
    );
  }

  if (currentUser.role === 'agent') {
    return (
      <div>
        <p>Agent view: triage dashboard</p>
        {/* Triage UI */}
      </div>
    );
  }

  // admin
  return (
    <div>
      <p>Admin view: full access</p>
      {/* Admin UI */}
    </div>
  );
}
```

### Pattern 2: Permission Helper

```typescript
function canModifyTicket(ticket: Ticket, user: User): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'agent' && ticket.assignedTo === user.id) return true;
  if (user.role === 'client' && ticket.clientId === user.id) return true;
  return false;
}

// In component
<button
  onClick={() => updateTicket(ticket)}
  disabled={!canModifyTicket(ticket, currentUser)}
>
  Modify
</button>
```

---

## Part 3: Form Component Pattern

### Example: Ticket Status Update Form

```typescript
interface StatusFormProps {
  ticket: Ticket;
  onSubmit: (status: TicketStatus, notes: string) => Promise<void>;
  onCancel: () => void;
}

export default function StatusForm({
  ticket,
  onSubmit,
  onCancel,
}: StatusFormProps) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(status, notes);
      // Form will be unmounted by parent
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          New Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Internal Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          rows={3}
          placeholder="Only visible to agents..."
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Updating...' : 'Update Status'}
        </button>
      </div>
    </form>
  );
}
```

---

## Part 4: List/Table Component Pattern

```typescript
interface TicketListProps {
  tickets: Ticket[];
  currentUser: User;
  onSelectTicket: (ticket: Ticket) => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => Promise<void>;
}

export default function TicketList({
  tickets,
  currentUser,
  onSelectTicket,
  onStatusChange,
}: TicketListProps) {
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'priority'>('created');
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');

  // Filter tickets based on role
  const visibleTickets = tickets.filter(t => {
    if (currentUser.role === 'client') {
      return t.clientId === currentUser.id;
    }
    return true; // agents and admins see all
  });

  // Apply status filter
  const filtered = filter === 'all'
    ? visibleTickets
    : visibleTickets.filter(t => t.status === filter);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'updated':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'priority':
        const priorityOrder: Record<TicketPriority, number> = {
          urgent: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="border rounded px-3 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="border rounded px-3 py-2"
        >
          <option value="created">Newest First</option>
          <option value="updated">Recently Updated</option>
          <option value="priority">Highest Priority</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-gray-500">No tickets found.</p>
        ) : (
          sorted.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              className="border rounded p-4 hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{ticket.title}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    ticket.priority === 'urgent'
                      ? 'bg-red-100 text-red-700'
                      : ticket.priority === 'high'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ticket.priority}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {ticket.description.substring(0, 100)}...
              </p>
              <div className="text-xs text-gray-500">
                Ticket #{ticket.id} • {ticket.category}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Part 5: WebSocket Integration

### Real-Time Ticket Updates

```typescript
interface RealtimeTicketProps {
  ticket: Ticket;
  onUpdate: (ticket: Ticket) => void;
}

export default function RealtimeTicket({
  ticket,
  onUpdate,
}: RealtimeTicketProps) {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000');

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      // Only update if it's our ticket
      if (message.type === 'ticketChanged' && message.data.ticketId === ticket.id) {
        onUpdate({ ...ticket, ...message.data.changed });
      }
    };

    return () => ws.close();
  }, [ticket.id, onUpdate]);

  return (
    <div>
      <h2>{ticket.title}</h2>
      <p>Status: {ticket.status}</p>
      {/* UI auto-updates when WebSocket message arrives */}
    </div>
  );
}
```

---

## Part 5.1: Dashboard Component Pattern

### Recommended Dashboard Structure

- `src/components/Dashboard.tsx`
- uses `fetch('/api/dashboard')`
- renders metric cards, trend charts, category summaries, and agent performance
- listens for WebSocket events and refreshes when ticket or notification activity changes

### Example Props & API shape

```typescript
interface DashboardData {
  metrics: TicketMetrics;
  trends: TicketTrendData[];
  agentPerformance: AgentPerformance[];
  categoryBreakdown: CategoryBreakdown[];
  priorityBreakdown: PriorityBreakdown[];
  generatedAt: string;
}

interface DashboardProps {
  onError: (message: string) => void;
}
```

### Fetching and real-time updates

```typescript
useEffect(() => {
  const fetchDashboard = async () => {
    const response = await fetch('/api/dashboard');
    const dashboard = await response.json();
    setData(dashboard);
  };

  fetchDashboard();

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (['ticket_created', 'ticket_updated', 'notification_logged'].includes(payload.type)) {
      fetchDashboard();
    }
  };

  return () => ws.close();
}, [onError]);
```

### Rendering charts

- Use `Recharts` for fast chart rendering
- `LineChart` for ticket trends
- `PieChart` for status and priority distribution
- `BarChart` for category and agent metrics

---

## Part 6: Loading & Error States

```typescript
interface SafeDataProps {
  data: Ticket[];
  isLoading: boolean;
  error: string | null;
}

export default function SafeData({
  data,
  isLoading,
  error,
}: SafeDataProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="text-gray-500 text-center py-8">No data found.</div>;
  }

  return (
    <div>
      {data.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
}
```

---

## Part 7: Styling with Tailwind

### Common Classes

```typescript
// Container & spacing
className="p-4"         // padding
className="mb-4"        // margin-bottom
className="space-y-4"   // vertical spacing between children
className="flex gap-4"  // horizontal flex with gap

// Text
className="text-sm text-gray-600"     // size + color
className="font-semibold"              // bold
className="text-center"                // alignment

// Colors (light theme)
className="bg-blue-600 text-white"     // button
className="bg-red-50 text-red-700"     // error
className="bg-green-50 text-green-700" // success
className="border border-gray-300"     // border

// States
className="hover:bg-gray-50"           // hover
className="disabled:opacity-50"        // disabled

// Responsive
className="md:flex hidden"             // hidden on mobile
className="grid grid-cols-2 md:grid-cols-4" // responsive grid
```

### Dark Mode Support

```typescript
className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
```

---

## Part 8: Testing Components

### Pattern (tests/core.test.ts)

```typescript
test('TicketList renders all tickets for admin', async () => {
  const tickets = await getTickets();
  const admin = { id: 'admin-1', role: 'admin' } as User;
  
  // This is a server-side test; for React component testing,
  // use React Testing Library (requires npm install)
  
  // For now, validate data layer
  assert.ok(tickets.length > 0);
  assert.ok(tickets.every(t => 'id' in t));
});
```

### Adding React Testing Library (optional)

```bash
npm install --save-dev @testing-library/react @testing-library/user-event
```

```typescript
// Example test file
import { render, screen } from '@testing-library/react';
import TicketList from '../TicketList';

test('TicketList displays ticket titles', () => {
  const tickets = [{ id: 'tk-1', title: 'Test Issue', ... }];
  render(
    <TicketList
      tickets={tickets}
      currentUser={{ id: 'admin-1', role: 'admin' }}
      onSelectTicket={() => {}}
      onStatusChange={async () => {}}
    />
  );
  
  expect(screen.getByText('Test Issue')).toBeInTheDocument();
});
```

---

## Checklist for New Components

- [ ] Props interface defined with clear types
- [ ] Component exported as default
- [ ] Registered in `App.tsx`
- [ ] Handles loading state
- [ ] Handles error state
- [ ] Uses Tailwind for styling
- [ ] Role-based rendering if needed
- [ ] Keyboard accessible (labels, ARIA)
- [ ] Mobile responsive
- [ ] WebSocket integration (if real-time needed)
- [ ] Tests added
- [ ] Documentation updated

---

## See Also

- [AGENTS.md](AGENTS.md) - Architecture overview
- [API_EXTENSION_GUIDE.md](API_EXTENSION_GUIDE.md) - Adding backend endpoints
- [src/components/](src/components/) - Existing components as templates
- [React 19 Docs](https://react.dev) - Latest patterns
- [Tailwind Docs](https://tailwindcss.com) - CSS classes
