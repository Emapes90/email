"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Globe, Plus, Trash2, Users, ExternalLink, Info } from "lucide-react";
import TopBar from "@/components/TopBar";
import {
  Button,
  Input,
  Modal,
  EmptyState,
  ConfirmDialog,
  SkeletonRows,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate, isValidDomain } from "@/lib/utils";
import type { Domain } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function DomainsPage() {
  const { success, error: showError } = useToast();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ domains: Domain[] }>("/admin/domains");
      setDomains(data.domains || []);
    } catch {
      showError("Failed to load domains");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  async function handleAdd() {
    if (!newDomain.trim()) return showError("Domain name is required");
    if (!isValidDomain(newDomain.trim()))
      return showError("Invalid domain name");
    setSaving(true);
    try {
      await api.post("/admin/domains", {
        name: newDomain.trim().toLowerCase(),
      });
      success("Domain added successfully");
      setAddOpen(false);
      setNewDomain("");
      loadDomains();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/admin/domains/${deleteTarget.id}`);
      success("Domain deleted");
      setDeleteTarget(null);
      loadDomains();
    } catch {
      showError("Failed to delete domain");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar
        title="Domains"
        icon={<Globe className="w-5 h-5" />}
        onRefresh={loadDomains}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add Domain
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Domain Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : domains.length === 0 ? (
            <EmptyState
              icon={<Globe className="w-8 h-8" />}
              title="No domains configured"
              description="Add your first domain to start receiving email"
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="w-4 h-4" /> Add Domain
                </Button>
              }
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Accounts</th>
                  <th>Aliases</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {domain.name}
                          </div>
                          <div className="text-[11px] text-brand-400">
                            ID: {domain.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-default">
                        {domain.accounts_count}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-default">
                        {domain.aliases_count}
                      </span>
                    </td>
                    <td className="text-xs text-brand-400">
                      {formatDate(domain.created_at)}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "badge",
                          domain.active ? "badge-success" : "badge-danger",
                        )}
                      >
                        <span
                          className={cn(
                            "status-dot",
                            domain.active
                              ? "status-dot-active"
                              : "status-dot-inactive",
                          )}
                        />
                        {domain.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/accounts?domain=${domain.name}`}
                          className="btn btn-ghost btn-icon btn-sm"
                          title="View accounts"
                        >
                          <Users className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(domain)}
                          className="btn btn-ghost btn-icon btn-sm text-red-400 hover:text-red-300"
                          title="Delete domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DNS Reference */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-accent" /> Required DNS Records
            </h3>
          </div>
          <div className="card-body space-y-2">
            <p className="text-xs text-brand-400 mb-3">
              For each domain, configure these DNS records:
            </p>
            {[
              { type: "MX", record: "@ IN MX 10 mail.yourdomain.com." },
              { type: "A", record: "mail IN A <server-ip>" },
              { type: "TXT", record: '@ IN TXT "v=spf1 mx a ~all"' },
              {
                type: "TXT",
                record:
                  '_dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"',
              },
              {
                type: "TXT",
                record: 'mail._domainkey IN TXT "v=DKIM1; k=rsa; p=..."',
              },
            ].map((dns, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 bg-brand-900/50 rounded-lg"
              >
                <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded min-w-[32px] text-center">
                  {dns.type}
                </span>
                <code className="text-xs text-brand-300 break-all">
                  {dns.record}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Domain Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Domain"
        icon={<Globe className="w-4 h-4 text-accent" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={saving}>
              <Plus className="w-4 h-4" /> Add Domain
            </Button>
          </>
        }
      >
        <Input
          label="Domain Name"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          hint="Enter the domain you want to receive email for"
          icon={<Globe className="w-4 h-4" />}
          autoFocus
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Domain"
        message={`Delete "${deleteTarget?.name}"? This will also delete all accounts and aliases for this domain. This action cannot be undone.`}
        loading={saving}
      />
    </>
  );
}
