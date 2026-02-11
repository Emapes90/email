"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Users, Plus, Trash2, Shield, Edit3, Key, Ban } from "lucide-react";
import TopBar from "@/components/TopBar";
import {
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
  ConfirmDialog,
  SkeletonRows,
  Avatar,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate, formatBytes, stringToColor } from "@/lib/utils";
import type { Account, AccountPayload, Domain } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { success, error: showError } = useToast();

  const domainFilter = searchParams.get("domain") || "";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<AccountPayload>({
    username: "",
    domain_id: 0,
    password: "",
    name: "",
    quota: 1024,
    is_admin: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [acctRes, domRes] = await Promise.all([
        api.get<{ accounts: Account[] }>(
          "/admin/accounts",
          domainFilter ? { domain: domainFilter } : {},
        ),
        api.get<{ domains: Domain[] }>("/admin/domains"),
      ]);
      setAccounts(acctRes.accounts || []);
      setDomains(domRes.domains || []);
    } catch {
      showError("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [domainFilter, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openAdd() {
    setForm({
      username: "",
      domain_id: domains.length > 0 ? domains[0].id : 0,
      password: "",
      name: "",
      quota: 1024,
      is_admin: false,
    });
    setAddOpen(true);
  }

  async function handleAdd() {
    if (!form.username.trim()) return showError("Username is required");
    if (!form.password || form.password.length < 8)
      return showError("Password must be at least 8 characters");
    if (!form.domain_id) return showError("Select a domain");
    setSaving(true);
    try {
      await api.post("/admin/accounts", form);
      success("Account created successfully");
      setAddOpen(false);
      loadData();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to create account",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: Account) {
    try {
      await api.put(`/admin/accounts/${account.id}`, {
        active: !account.active,
      });
      success(`Account ${account.active ? "disabled" : "enabled"}`);
      loadData();
    } catch {
      showError("Failed to update account");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/admin/accounts/${deleteTarget.id}`);
      success("Account deleted");
      setDeleteTarget(null);
      loadData();
    } catch {
      showError("Failed to delete account");
    } finally {
      setSaving(false);
    }
  }

  const domainOptions = domains.map((d) => ({ value: d.id, label: d.name }));
  const filterOptions = [
    { value: "", label: "All Domains" },
    ...domains.map((d) => ({ value: d.name, label: d.name })),
  ];

  return (
    <>
      <TopBar
        title="Accounts"
        icon={<Users className="w-5 h-5" />}
        onSearch={(q) => {
          // client-side filter
        }}
        onRefresh={loadData}
        actions={
          <>
            <select
              value={domainFilter}
              onChange={(e) => {
                const val = e.target.value;
                router.push(
                  val ? `/admin/accounts?domain=${val}` : "/admin/accounts",
                );
              }}
              className="input h-8 w-auto text-xs pr-8"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4" /> New Account
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="card overflow-hidden">
          {loading ? (
            <SkeletonRows rows={8} />
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No accounts found"
              description={
                domainFilter
                  ? `No accounts for ${domainFilter}`
                  : "Create your first email account"
              }
              action={
                <Button size="sm" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> New Account
                </Button>
              }
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Domain</th>
                  <th>Quota</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct) => (
                  <tr key={acct.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={acct.name || acct.email}
                          color={stringToColor(acct.email)}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {acct.name || acct.email}
                          </div>
                          <div className="text-[11px] text-brand-400">
                            {acct.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-brand-300">
                      {acct.domain_name}
                    </td>
                    <td className="text-xs text-brand-400">
                      {formatBytes(acct.quota * 1024 * 1024)}
                    </td>
                    <td>
                      {acct.is_admin ? (
                        <span className="badge badge-warning">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="badge badge-default">User</span>
                      )}
                    </td>
                    <td className="text-xs text-brand-400">
                      {formatDate(acct.created_at)}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "badge",
                          acct.active ? "badge-success" : "badge-danger",
                        )}
                      >
                        <span
                          className={cn(
                            "status-dot",
                            acct.active
                              ? "status-dot-active"
                              : "status-dot-inactive",
                          )}
                        />
                        {acct.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleActive(acct)}
                          className={cn(
                            "btn btn-ghost btn-icon btn-sm",
                            !acct.active && "text-emerald-400",
                          )}
                          title={acct.active ? "Disable" : "Enable"}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(acct)}
                          className="btn btn-ghost btn-icon btn-sm text-red-400 hover:text-red-300"
                          title="Delete"
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
      </div>

      {/* Add Account Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New Email Account"
        icon={<Users className="w-4 h-4 text-accent" />}
        className="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={saving}>
              <Plus className="w-4 h-4" /> Create Account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Display Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="John Doe"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="john"
              hint="The part before @"
            />
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
          </div>
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Min 8 characters"
            icon={<Key className="w-4 h-4" />}
          />
          <Input
            label="Quota (MB)"
            type="number"
            value={String(form.quota)}
            onChange={(e) =>
              setForm({ ...form, quota: Number(e.target.value) })
            }
            hint="Max mailbox size in megabytes"
          />
          <label className="flex items-center gap-2 text-sm text-brand-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
              className="w-4 h-4 rounded bg-brand-900 border-surface-200"
            />
            <Shield className="w-3.5 h-3.5" /> Admin privileges
          </label>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Delete "${deleteTarget?.email}"? All emails and data for this account will be permanently removed.`}
        loading={saving}
      />
    </>
  );
}
