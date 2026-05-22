import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, AlertCircle, Clock, Users, Activity } from 'lucide-react';
import { DashboardData } from '../types';

interface DashboardProps {
  onError: (message: string) => void;
}

export default function Dashboard({ onError }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Failed to fetch dashboard');
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch (err) {
        onError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (['ticket_created', 'ticket_updated', 'notification_logged'].includes(message.type)) {
          fetchDashboard();
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      console.warn('Dashboard WebSocket connection failed. Falling back to polling.');
    };

    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [onError]);

  if (isLoading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-red-600">Failed to load dashboard data</div>;
  }

  const { metrics, trends, agentPerformance, categoryBreakdown, priorityBreakdown } = data;

  const COLORS = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#eab308',
    low: '#22c55e',
    open: '#ef4444',
    inProgress: '#f97316',
    resolved: '#84cc16',
    closed: '#6b7280'
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">IT Support Dashboard</h1>
        <p className="text-gray-600">Real-time metrics and performance analytics</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-4 py-2 rounded ${timeRange === '7d' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-4 py-2 rounded ${timeRange === '30d' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-4 py-2 rounded ${timeRange === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Total Tickets */}
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Tickets</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalTickets}</p>
            </div>
            <Activity className="text-blue-500" size={32} />
          </div>
        </div>

        {/* Open Tickets */}
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Open</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{metrics.openTickets}</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.totalTickets > 0 ? Math.round((metrics.openTickets / metrics.totalTickets) * 100) : 0}% of total</p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">In Progress</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.inProgressTickets}</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.totalTickets > 0 ? Math.round((metrics.inProgressTickets / metrics.totalTickets) * 100) : 0}% of total</p>
            </div>
            <TrendingUp className="text-orange-500" size={32} />
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Resolved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{metrics.resolvedTickets}</p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.totalTickets > 0 ? Math.round((metrics.resolvedTickets / metrics.totalTickets) * 100) : 0}% completion
              </p>
            </div>
            <Activity className="text-green-500" size={32} />
          </div>
        </div>

        {/* Avg Resolution Time */}
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Avg Resolution</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{metrics.avgResolutionTimeHours}h</p>
              <p className="text-xs text-gray-500 mt-1">Time to resolve</p>
            </div>
            <Clock className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      {/* Charts Row 1: Trends & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Ticket Trends */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Volume Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                interval={Math.floor(trends.length / 7)}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#ef4444" name="Created" />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Open', value: metrics.openTickets },
                  { name: 'In Progress', value: metrics.inProgressTickets },
                  { name: 'Resolved', value: metrics.resolvedTickets },
                  { name: 'Closed', value: metrics.closedTickets }
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill={COLORS.open} />
                <Cell fill={COLORS.inProgress} />
                <Cell fill={COLORS.resolved} />
                <Cell fill={COLORS.closed} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Categories & Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tickets by Category</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" name="Ticket Count" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {categoryBreakdown.map(cat => (
              <div key={cat.category} className="flex justify-between text-sm">
                <span className="text-gray-700 capitalize">{cat.category}</span>
                <span className="text-gray-900 font-semibold">
                  {cat.count} ({cat.percentage}%) - Avg: {cat.avgResolutionTimeHours}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tickets by Priority</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={priorityBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ priority, value }) => `${priority}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                <Cell fill={COLORS.critical} />
                <Cell fill={COLORS.high} />
                <Cell fill={COLORS.medium} />
                <Cell fill={COLORS.low} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {priorityBreakdown.map(pri => (
              <div key={pri.priority} className="flex justify-between text-sm">
                <span className="text-gray-700 capitalize font-medium">{pri.priority}</span>
                <span className="text-gray-900 font-semibold">{pri.count} ({pri.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={24} />
          Agent Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Agent</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Assigned</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Resolved</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Resolution Rate</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Time</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Response Rate</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map(agent => (
                <tr key={agent.agentId} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{agent.agentName}</td>
                  <td className="text-center py-3 px-4 text-gray-700">{agent.assignedTickets}</td>
                  <td className="text-center py-3 px-4 font-semibold text-green-600">{agent.resolvedTickets}</td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {agent.assignedTickets > 0 
                        ? Math.round((agent.resolvedTickets / agent.assignedTickets) * 100)
                        : 0
                      }%
                    </span>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-700">{agent.avgResolutionTimeHours}h</td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {agent.responseRatePercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agentPerformance.length === 0 && (
          <p className="text-center text-gray-500 py-8">No agent data available</p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-right text-xs text-gray-500">
        Last updated: {new Date(data.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}
