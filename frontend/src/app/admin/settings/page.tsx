"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings as SettingsIcon, Save, RotateCcw } from "lucide-react";
import TopBar from "@/components/TopBar";
import { Button, Input, SkeletonRows } from "@/components/ui";
import { api } from "@/lib/api";
import type { AdminSetting } from "@/lib/types";
import { useToast } from "@/providers/ToastProvider";

export default function SettingsPage() {
  const { success, error: showError } = useToast();

  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ settings: AdminSetting[] }>(
        "/admin/settings",
      );
      setSettings(data.settings || []);
      setDirty(false);
    } catch {
      showError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function updateSetting(key: string, value: string) {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s)),
    );
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/admin/settings", {
        settings: settings.reduce(
          (acc, s) => ({ ...acc, [s.key]: s.value }),
          {} as Record<string, string>,
        ),
      });
      success("Settings saved");
      setDirty(false);
    } catch {
      showError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  // Group settings by category (prefix before first _)
  const grouped = settings.reduce<Record<string, AdminSetting[]>>((acc, s) => {
    const cat = s.key.split("_")[0] || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <>
      <TopBar
        title="Settings"
        icon={<SettingsIcon className="w-5 h-5" />}
        onRefresh={loadSettings}
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-xs text-amber-400 animate-fade-in">
                Unsaved changes
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSettings}
              disabled={!dirty}
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              loading={saving}
              disabled={!dirty}
            >
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="card">
            <SkeletonRows rows={8} />
          </div>
        ) : settings.length === 0 ? (
          <div className="card">
            <div className="card-body text-center text-brand-400 py-16">
              <SettingsIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No settings configured yet</p>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-white capitalize">
                  {category} Settings
                </h3>
              </div>
              <div className="divide-y divide-surface-200">
                {items.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-start gap-6 px-5 py-4"
                  >
                    <div className="flex-1 min-w-0 pt-2">
                      <div className="text-sm font-medium text-white">
                        {setting.key}
                      </div>
                      {setting.description && (
                        <div className="text-[11px] text-brand-400 mt-0.5">
                          {setting.description}
                        </div>
                      )}
                    </div>
                    <div className="w-80 shrink-0">
                      {setting.value === "true" || setting.value === "false" ? (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={setting.value === "true"}
                            onChange={(e) =>
                              updateSetting(
                                setting.key,
                                e.target.checked ? "true" : "false",
                              )
                            }
                            className="w-4 h-4 rounded bg-brand-900 border-surface-200"
                          />
                          <span className="text-sm text-brand-300">
                            {setting.value === "true" ? "Enabled" : "Disabled"}
                          </span>
                        </label>
                      ) : (
                        <input
                          type="text"
                          value={setting.value}
                          onChange={(e) =>
                            updateSetting(setting.key, e.target.value)
                          }
                          className="input text-sm"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Save bar (sticky) */}
        {dirty && (
          <div className="sticky bottom-6 flex items-center justify-end gap-3 px-5 py-3 bg-brand-800/90 backdrop-blur border border-surface-200 rounded-xl shadow-card animate-slide-up">
            <span className="text-sm text-brand-300">
              You have unsaved changes
            </span>
            <Button variant="ghost" size="sm" onClick={loadSettings}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
