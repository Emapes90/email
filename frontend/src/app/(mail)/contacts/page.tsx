"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Star,
  Phone,
  Mail,
  Building2,
  Trash2,
  Edit3,
  Heart,
  UserPlus,
  Filter,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import {
  Button,
  Input,
  Textarea,
  Modal,
  Avatar,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cn, stringToColor } from "@/lib/utils";
import type { Contact, ContactPayload, ContactGroup } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function ContactsPage() {
  const { success, error: showError } = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<ContactPayload>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    address: "",
    notes: "",
    favorite: false,
  });

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const [contactsRes, groupsRes] = await Promise.all([
        api.get<{ contacts: Contact[] }>("/contacts", {
          search,
          ...(activeGroup !== "all" && activeGroup !== "favorites"
            ? { group: activeGroup }
            : {}),
        }),
        api.get<{ groups: ContactGroup[] }>("/contacts/groups"),
      ]);
      let list = contactsRes.contacts || [];
      if (activeGroup === "favorites") {
        list = list.filter((c) => c.favorite);
      }
      setContacts(list);
      setGroups(groupsRes.groups || []);
    } catch {
      showError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [search, activeGroup, showError]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  function openNew() {
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      company: "",
      job_title: "",
      address: "",
      notes: "",
      favorite: false,
    });
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(contact: Contact) {
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name || "",
      email: contact.email,
      phone: contact.phone || "",
      company: contact.company || "",
      job_title: contact.job_title || "",
      address: contact.address || "",
      notes: contact.notes || "",
      favorite: contact.favorite,
    });
    setEditing(contact);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.email.trim()) {
      return showError("Name and email are required");
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/contacts/${editing.id}`, form);
        success("Contact updated");
      } else {
        await api.post("/contacts", form);
        success("Contact created");
      }
      setModalOpen(false);
      loadContacts();
    } catch {
      showError("Failed to save contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.delete(`/contacts/${editing.id}`);
      success("Contact deleted");
      setModalOpen(false);
      loadContacts();
    } catch {
      showError("Failed to delete contact");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(contact: Contact, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.put(`/contacts/${contact.id}`, {
        ...contact,
        favorite: !contact.favorite,
      });
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id ? { ...c, favorite: !c.favorite } : c,
        ),
      );
    } catch {
      showError("Failed to update contact");
    }
  }

  return (
    <>
      <TopBar
        title="Contacts"
        icon={<Users className="w-5 h-5" />}
        onSearch={(q) => setSearch(q)}
        onRefresh={loadContacts}
        actions={
          <Button size="sm" onClick={openNew}>
            <UserPlus className="w-4 h-4" /> Add Contact
          </Button>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[220px] border-r border-surface-200 flex flex-col shrink-0 bg-brand-800/50">
          <div className="p-3 space-y-0.5">
            <button
              onClick={() => setActiveGroup("all")}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors",
                activeGroup === "all"
                  ? "bg-white/[0.08] text-white"
                  : "text-brand-300 hover:bg-white/[0.04]",
              )}
            >
              <Users className="w-4 h-4" /> All Contacts
              <span className="ml-auto text-[11px] text-brand-400">
                {contacts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveGroup("favorites")}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors",
                activeGroup === "favorites"
                  ? "bg-white/[0.08] text-white"
                  : "text-brand-300 hover:bg-white/[0.04]",
              )}
            >
              <Heart className="w-4 h-4" /> Favorites
            </button>

            {groups.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                  Groups
                </div>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroup(String(g.id))}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors",
                      activeGroup === String(g.id)
                        ? "bg-white/[0.08] text-white"
                        : "text-brand-300 hover:bg-white/[0.04]",
                    )}
                  >
                    <Filter className="w-4 h-4" /> {g.name}
                    {g.count !== undefined && (
                      <span className="ml-auto text-[11px] text-brand-400">
                        {g.count}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Contact Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No contacts yet"
              description="Add your first contact to get started"
              action={
                <Button size="sm" onClick={openNew}>
                  <UserPlus className="w-4 h-4" /> Add Contact
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => openEdit(contact)}
                  className="card p-4 cursor-pointer hover:border-surface-300 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={`${contact.first_name} ${contact.last_name || ""}`}
                      color={
                        contact.avatar_color || stringToColor(contact.email)
                      }
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {contact.first_name} {contact.last_name}
                        </span>
                        <button
                          onClick={(e) => toggleFavorite(contact, e)}
                          className={cn(
                            "shrink-0 transition-colors",
                            contact.favorite
                              ? "text-amber-400"
                              : "text-brand-500 opacity-0 group-hover:opacity-100",
                          )}
                        >
                          <Heart
                            className={cn(
                              "w-3.5 h-3.5",
                              contact.favorite && "fill-current",
                            )}
                          />
                        </button>
                      </div>
                      {contact.job_title && contact.company && (
                        <div className="text-[11px] text-brand-400 truncate mt-0.5">
                          {contact.job_title} at {contact.company}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-brand-400">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3 h-3 shrink-0" /> {contact.email}
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3 h-3 shrink-0" /> {contact.phone}
                      </div>
                    )}
                    {contact.company && (
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3 h-3 shrink-0" />{" "}
                        {contact.company}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Contact" : "New Contact"}
        icon={<Users className="w-4 h-4 text-accent" />}
        className="max-w-xl"
        footer={
          <>
            {editing && (
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
              {editing ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="John"
              autoFocus
            />
            <Input
              label="Last Name"
              value={form.last_name || ""}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="Doe"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="john@example.com"
            icon={<Mail className="w-4 h-4" />}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone || ""}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
            icon={<Phone className="w-4 h-4" />}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company"
              value={form.company || ""}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Company name"
            />
            <Input
              label="Job Title"
              value={form.job_title || ""}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              placeholder="Role"
            />
          </div>
          <Input
            label="Address"
            value={form.address || ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Full address"
          />
          <Textarea
            label="Notes"
            value={form.notes || ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Additional notes…"
            className="min-h-[60px]"
          />
          <label className="flex items-center gap-2 text-sm text-brand-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(e) => setForm({ ...form, favorite: e.target.checked })}
              className="w-4 h-4 rounded bg-brand-900 border-surface-200"
            />
            <Heart className="w-3.5 h-3.5" /> Mark as favorite
          </label>
        </div>
      </Modal>
    </>
  );
}
