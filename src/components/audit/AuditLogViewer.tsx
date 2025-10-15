/**
 * Audit Log Viewer
 * GDPR Article 15 - Right to Access
 * HIPAA §164.312(b) - Audit Controls
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { X, Download, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AuditEvent {
  timestamp: string;
  event: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  user?: string;
  details?: Record<string, unknown>;
  result: 'SUCCESS' | 'FAILURE';
}

interface AuditStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByResult: Record<string, number>;
  recentFailures: number;
}

export default function AuditLogViewer({ isOpen, onClose }: AuditLogViewerProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      loadStats();
    }
  }, [isOpen, page, eventTypeFilter, resultFilter, severityFilter, searchTerm, startDate, endDate]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });

      if (eventTypeFilter) params.append('eventType', eventTypeFilter);
      if (resultFilter) params.append('result', resultFilter);
      if (severityFilter) params.append('severity', severityFilter);
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`http://localhost:3010/api/audit/logs?${params}`);
      const data = await response.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3010/api/audit/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load audit stats:', error);
    }
  };

  const handleExport = async (filtered: boolean) => {
    try {
      let url = 'http://localhost:3010/api/audit/export';

      if (filtered && (startDate || endDate)) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        url += `?${params}`;
      }

      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      toast.error('Failed to export audit logs');
    }
  };

  const resetFilters = () => {
    setEventTypeFilter('');
    setResultFilter('');
    setSeverityFilter('');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'WARNING':
        return <AlertTriangle size={16} className="text-amber-500" />;
      case 'INFO':
        return <Info size={16} className="text-blue-500" />;
      default:
        return <Info size={16} className="text-gray-500" />;
    }
  };

  const getResultIcon = (result: string) => {
    return result === 'SUCCESS' ? (
      <CheckCircle size={16} className="text-green-500" />
    ) : (
      <AlertCircle size={16} className="text-red-500" />
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  if (!isOpen) return null;

  // Get unique event types from stats
  const eventTypes = stats ? Object.keys(stats.eventsByType).sort() : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4 pointer-events-none">
        <div
          className="bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-full max-w-6xl max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h1 className="header-title text-gradient">
            Audit Log Viewer
          </h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => loadLogs()}
              className="p-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 cursor-pointer flex items-center transition-colors"
              title="Refresh logs"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => handleExport(false)}
              className="p-2 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/15 cursor-pointer flex items-center transition-colors"
              title="Export all logs"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Statistics Bar */}
        {stats && (
          <div className="flex gap-8 p-4 px-6 border-b border-white/10 text-sm flex-shrink-0">
            <Stat label="Total Events" value={stats.totalEvents.toString()} />
            <Stat label="Recent Failures" value={stats.recentFailures.toString()} color="text-red-500" />
            <Stat
              label="Success Rate"
              value={`${Math.round((stats.eventsByResult.SUCCESS || 0) / stats.totalEvents * 100)}%`}
              color="text-green-500"
            />
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 p-4 px-6 border-b border-white/10 flex-shrink-0">
          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-md border border-white/10 bg-white/[0.03] text-sm"
          >
            <option value="">All Event Types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-md border border-white/10 bg-white/[0.03] text-sm"
          >
            <option value="">All Results</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-md border border-white/10 bg-white/[0.03] text-sm"
          >
            <option value="">All Severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-md border border-white/10 bg-white/[0.03] text-sm"
          />

          <button
            onClick={resetFilters}
            className="p-2 rounded-md border border-white/20 bg-white/[0.05] hover:bg-white/10 text-gray-400 text-sm cursor-pointer transition-colors"
          >
            Reset Filters
          </button>
        </div>

        {/* Log Table */}
        <div className="flex-1 overflow-y-auto px-6">
          {loading ? (
            <div className="text-center p-8 text-gray-400">
              Loading audit logs...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center p-8 text-gray-400">
              No audit logs found
            </div>
          ) : (
            <div className="my-4">
              {events.map((event, index) => (
                <LogEntry key={index} event={event} formatDate={formatDate} getSeverityIcon={getSeverityIcon} getResultIcon={getResultIcon} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 px-6 border-t border-white/10 flex-shrink-0">
            <div className="text-sm text-gray-400">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} events
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={`p-2 rounded-md border border-white/10 flex items-center ${
                  page === 1
                    ? 'bg-white/[0.03] text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500/10 cursor-pointer'
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="py-2 px-4 rounded-md border border-white/10 bg-white/[0.03] text-sm">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={`p-2 rounded-md border border-white/10 flex items-center ${
                  page === totalPages
                    ? 'bg-white/[0.03] text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500/10 cursor-pointer'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-gray-400 text-xs">{label}</div>
      <div className={`font-semibold text-base ${color || ''}`}>{value}</div>
    </div>
  );
}

function LogEntry({
  event,
  formatDate,
  getSeverityIcon,
  getResultIcon,
}: {
  event: AuditEvent;
  formatDate: (isoString: string) => string;
  getSeverityIcon: (severity: string) => React.ReactElement;
  getResultIcon: (result: string) => React.ReactElement;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2 bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3 grid grid-cols-[1fr_2fr_100px_100px_100px] gap-4 items-center cursor-pointer hover:bg-white/[0.05] transition-colors"
      >
        <div className="text-xs text-gray-400">
          {formatDate(event.timestamp)}
        </div>
        <div className="text-sm font-medium">
          {event.event.replace(/_/g, ' ')}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {getResultIcon(event.result)}
          {event.result}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {getSeverityIcon(event.severity)}
          {event.severity}
        </div>
        <div className="text-right text-xs text-gray-400">
          {expanded ? '▼' : '▶'} {event.details ? 'Details' : ''}
        </div>
      </div>
      {expanded && event.details && (
        <div className="p-3 border-t border-white/10 bg-black/20">
          <pre className="m-0 text-xs text-gray-400 whitespace-pre-wrap break-words">
            {JSON.stringify(event.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
