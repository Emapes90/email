"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { Button, Input, Textarea, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventPayload } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

const COLORS = [
  "#667eea",
  "#f5576c",
  "#43e97b",
  "#fa709a",
  "#4facfe",
  "#fee140",
  "#a18cd1",
  "#ff9a9e",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const { success, error: showError } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<CalendarEventPayload>({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    all_day: false,
    color: COLORS[0],
    location: "",
  });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ events: CalendarEvent[] }>(
        "/calendar/events",
        {
          year: String(year),
          month: String(month + 1),
        },
      );
      setEvents(data.events || []);
    } catch {
      showError("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [year, month, showError]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  function openNewEvent(day?: number) {
    const dateStr = day
      ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : new Date().toISOString().slice(0, 10);
    setForm({
      title: "",
      description: "",
      start_date: dateStr,
      end_date: dateStr,
      all_day: false,
      color: COLORS[0],
      location: "",
    });
    setEditingEvent(null);
    setModalOpen(true);
  }

  function openEditEvent(event: CalendarEvent) {
    setForm({
      title: event.title,
      description: event.description || "",
      start_date: event.start_date.slice(0, 16),
      end_date: event.end_date?.slice(0, 16) || "",
      all_day: event.all_day,
      color: event.color || COLORS[0],
      location: event.location || "",
    });
    setEditingEvent(event);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return showError("Title is required");
    setSaving(true);
    try {
      if (editingEvent) {
        await api.put(`/calendar/events/${editingEvent.id}`, form);
        success("Event updated");
      } else {
        await api.post("/calendar/events", form);
        success("Event created");
      }
      setModalOpen(false);
      loadEvents();
    } catch {
      showError("Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await api.delete(`/calendar/events/${editingEvent.id}`);
      success("Event deleted");
      setModalOpen(false);
      loadEvents();
    } catch {
      showError("Failed to delete event");
    } finally {
      setSaving(false);
    }
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells: { day: number; currentMonth: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDay) {
      cells.push({
        day: prevMonthDays - firstDay + i + 1,
        currentMonth: false,
        isToday: false,
      });
    } else if (i - firstDay < daysInMonth) {
      const d = i - firstDay + 1;
      const isToday =
        d === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();
      cells.push({ day: d, currentMonth: true, isToday });
    } else {
      cells.push({
        day: i - firstDay - daysInMonth + 1,
        currentMonth: false,
        isToday: false,
      });
    }
  }

  function getEventsForDay(day: number): CalendarEvent[] {
    return events.filter((e) => {
      const d = new Date(e.start_date);
      return (
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    });
  }

  return (
    <>
      <TopBar
        title="Calendar"
        icon={<CalIcon className="w-5 h-5" />}
        onRefresh={loadEvents}
        actions={
          <Button size="sm" onClick={() => openNewEvent()}>
            <Plus className="w-4 h-4" /> New Event
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={goToday} className="btn btn-ghost btn-sm">
              Today
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="card overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-surface-200 bg-brand-900/50">
            {DAYS.map((d) => (
              <div
                key={d}
                className="py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-brand-400"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const dayEvents = cell.currentMonth
                ? getEventsForDay(cell.day)
                : [];
              return (
                <div
                  key={i}
                  onClick={() => cell.currentMonth && openNewEvent(cell.day)}
                  className={cn(
                    "min-h-[100px] p-1.5 border-b border-r border-surface-200 cursor-pointer transition-colors hover:bg-surface-50/30",
                    !cell.currentMonth && "opacity-30",
                  )}
                >
                  <div
                    className={cn(
                      "text-xs font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                      cell.isToday
                        ? "bg-white text-brand-900 font-bold"
                        : "text-brand-300",
                    )}
                  >
                    {cell.day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <button
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditEvent(evt);
                        }}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium text-white truncate transition-opacity hover:opacity-80"
                        style={{ backgroundColor: evt.color || COLORS[0] }}
                      >
                        {evt.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-brand-400 px-1.5">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEvent ? "Edit Event" : "New Event"}
        icon={<CalIcon className="w-4 h-4 text-accent" />}
        footer={
          <>
            {editingEvent && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={saving}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingEvent ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Event title"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start"
              type={form.all_day ? "date" : "datetime-local"}
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="End"
              type={form.all_day ? "date" : "datetime-local"}
              value={form.end_date || ""}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
              className="w-4 h-4 rounded bg-brand-900 border-surface-200 text-accent focus:ring-accent/30"
            />
            All day event
          </label>
          <Input
            label="Location"
            value={form.location || ""}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Add location"
            icon={<MapPin className="w-4 h-4" />}
          />
          <Textarea
            label="Description"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add description"
            className="min-h-[80px]"
          />
          {/* Color Picker */}
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    form.color === c
                      ? "ring-2 ring-offset-2 ring-offset-brand-800 ring-white scale-110"
                      : "opacity-60 hover:opacity-100",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
