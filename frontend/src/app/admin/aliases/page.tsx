"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import {
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
  ConfirmDialog,
  SkeletonRows,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { Alias, AliasPayload, Domain } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function AliasesPage() {
  const { success, error: showError } = useToast();

  const [aliases, setAliases] = useState<Alias[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Alias | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<AliasPayload>({
    source: "",
    destination: "",
    domain_id: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aliasRes, domRes] = await Promise.all([
        api.get<{ aliases: Alias[] }>("/admin/aliases"),
        api.get<{ domains: Domain[] }>("/admin/domains"),
      ]);
      setAliases(aliasRes.aliases || []);
      setDomains(domRes.domains || []);
    } catch {
      showError("Failed to load aliases");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openAdd() {
    setForm({
      source: "",
      destination: "",
      domain_id: domains.length > 0 ? domains[0].id : 0,
    });
    setAddOpen(true);
  }

  async function handleAdd() {
    if (!form.source.trim() || !form.destination.trim())
      return showError("All fields are required");
    if (!form.domain_id) return showError("Select a domain");
    setSaving(true);
    try {
      await api.post("/admin/aliases", form);
      success("Alias created");
      setAddOpen(false);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create alias");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/admin/aliases/${deleteTarget.id}`);
      success("Alias deleted");
      setDeleteTarget(null);
      loadData();
    } catch {
      showError("Failed to delete alias");
    } finally {
      setSaving(false);
    }
  }

  const domainOptions = domains.map((d) => ({ value: d.id, label: d.name }));

  return (
    <>
      <TopBar
        title="Email Aliases"
        icon={<ArrowLeftRight className="w-5 h-5" />}
        onRefresh={loadData}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Alias
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="card overflow-hidden">
          {loading ? (
            <SkeletonRows rows={6} />
          ) : aliases.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="w-8 h-8" />}
              title="No aliases configured"
              description="Create email forwarding aliases"
              action={
                <Button size="sm" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> Add Alias
                </Button>
              }
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th></th>
                  <th>Destination</th>
                  <th>Domain</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((alias) => (
                  <tr key={alias.id}>
                    <td className="text-sm font-medium text-white">
                      {alias.source}
                    </td>
                    <td className="text-center">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-brand-400 mx-auto" />
                    </td>
                    <td className="text-sm text-brand-300">
                      {alias.destination}
                    </td>
                    <td className="text-xs text-brand-400">
                      {alias.domain_name}
                    </td>
                    <td className="text-xs text-brand-400">
                      {formatDate(alias.created_at)}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "badge",
                          alias.active ? "badge-success" : "badge-danger",
                        )}
                      >
                        <span
                          className={cn(
                            "status-dot",
                            alias.active
                              ? "status-dot-active"
                              : "status-dot-inactive",
                          )}
                        />
                        {alias.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setDeleteTarget(alias)}
                        className="btn btn-ghost btn-icon btn-sm text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Alias Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Alias"
        icon={<ArrowLeftRight className="w-4 h-4 text-accent" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={saving}>
              <Plus className="w-4 h-4" /> Create Alias
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Domain"
            value={form.domain_id}
            onChange={(e) =>
              setForm({ ...form, domain_id: Number(e.target.value) })
            }
            options={
              domainOptions.length > 0
                ? domainOptions
                : [{ value: 0, label: "No domains available" }]
            }
          />
          <Input
            label="Source Address"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="alias@domain.com"
            hint="The email address that forwards mail"
            autoFocus
          />
          <Input
            label="Destination Address"
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            placeholder="real@domain.com"
            hint="Where mail gets delivered to"
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Alias"
        message={`Delete alias "${deleteTarget?.source}" → "${deleteTarget?.destination}"?`}
        loading={saving}
      />
    </>
  );
}
