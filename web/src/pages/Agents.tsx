import { useState, useEffect, useCallback } from 'react';
import {
  listAgents,
  registerAgent,
  deleteAgent,
  patchAgentPermissions,
  getStoredHubToken,
  setStoredHubToken,
} from '../api';
import { AppDialog } from '@/components/ui/AppDialog';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relativeTime, agentStatusLabel, agentTypeLabel } from '../utils';
import i18n from '../i18n';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useTranslation } from 'react-i18next';
import type { Agent, AgentType, PermissionLevel, VisibilityScope } from '../types';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
  offline: 'bg-gray-500',
  busy: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]',
};

const PERMISSION_ORDER: PermissionLevel[] = ['readonly', 'task-self', 'task-any', 'admin'];

function normalizePermission(a: Agent): PermissionLevel {
  return (a.permissionLevel ?? 'task-any') as PermissionLevel;
}

function normalizeVisibility(a: Agent): VisibilityScope {
  return (a.visibilityScope ?? 'global') as VisibilityScope;
}

function permissionBadgeClass(l: PermissionLevel): string {
  switch (l) {
    case 'readonly':
      return 'border-zinc-500/40 bg-zinc-500/15 text-zinc-200 hover:bg-zinc-500/25';
    case 'task-self':
      return 'border-blue-500/45 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25';
    case 'task-any':
      return 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25';
    case 'admin':
      return 'border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25';
    default:
      return 'border-border bg-muted';
  }
}

function visibilityBadgeClass(v: VisibilityScope): string {
  return v === 'own'
    ? 'border-violet-500/45 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25'
    : 'border-cyan-500/45 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25';
}

export function Agents() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AgentType>('manual');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formHeartbeat, setFormHeartbeat] = useState('60');
  const [formCapabilities, setFormCapabilities] = useState('');
  const [formRules, setFormRules] = useState('');
  const [capabilitiesError, setCapabilitiesError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [hubTokenInput, setHubTokenInput] = useState('');
  const [permAgent, setPermAgent] = useState<Agent | null>(null);
  const [permLevel, setPermLevel] = useState<PermissionLevel>('task-any');
  const [permVis, setPermVis] = useState<VisibilityScope>('global');
  const [permSaving, setPermSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listAgents();
      setAgents(data);
    } catch (err: any) {
      toast(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(null, load);

  useEffect(() => {
    setHubTokenInput(getStoredHubToken() ?? '');
  }, []);

  const resetForm = () => {
    setFormId('');
    setFormName('');
    setFormType('manual');
    setFormEndpoint('');
    setFormHeartbeat('60');
    setFormCapabilities('');
    setFormRules('');
    setCapabilitiesError('');
  };

  const validateCapabilities = (value: string) => {
    if (!value.trim()) {
      setCapabilitiesError('');
      return true;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null) {
        setCapabilitiesError(i18n.t('agentsPage.valErrors.mustBeObject'));
        return false;
      }
      if (!Array.isArray(parsed.taskTypes)) {
        setCapabilitiesError(i18n.t('agentsPage.valErrors.taskTypesArray'));
        return false;
      }
      if (!Array.isArray(parsed.languages)) {
        setCapabilitiesError(i18n.t('agentsPage.valErrors.languagesArray'));
        return false;
      }
      setCapabilitiesError('');
      return true;
    } catch {
      setCapabilitiesError(i18n.t('agentsPage.valErrors.invalidJson'));
      return false;
    }
  };

  const handleCreate = async () => {
    if (!formId.trim() || !formName.trim()) return;
    if (!validateCapabilities(formCapabilities)) return;
    setSubmitting(true);
    try {
      const input: Record<string, any> = {
        id: formId.trim(),
        name: formName.trim(),
        type: formType,
      };
      if (formType === 'webhook') {
        input.endpoint = formEndpoint.trim();
        input.heartbeatInterval = parseInt(formHeartbeat, 10) || 60;
      }
      if (formCapabilities.trim()) {
        input.capabilities = JSON.parse(formCapabilities.trim());
      }
      if (formRules.trim()) {
        input.rules = formRules.trim();
      }
      await registerAgent(input as any);
      setModalOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormId(agent.id);
    setFormName(agent.name);
    setFormType(agent.type);
    setFormEndpoint(agent.endpoint || '');
    setFormHeartbeat((agent.heartbeatInterval || 60).toString());
    setFormCapabilities(agent.capabilities ? JSON.stringify(agent.capabilities, null, 2) : '');
    setFormRules(agent.rules || '');
    setCapabilitiesError('');
    setEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteAgent(confirmDeleteId);
      setConfirmDeleteId(null);
      load();
    } catch (err: any) {
      toast(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveHubToken = () => {
    setStoredHubToken(hubTokenInput.trim() || null);
    toast(t('agentsPage.tokenSaved'), 'success');
  };

  const openPermissionDialog = (agent: Agent) => {
    setPermAgent(agent);
    setPermLevel(normalizePermission(agent));
    setPermVis(normalizeVisibility(agent));
  };

  const handleSavePermissions = async () => {
    if (!permAgent) return;
    setPermSaving(true);
    try {
      await patchAgentPermissions(permAgent.id, {
        permissionLevel: permLevel,
        visibilityScope: permVis,
      });
      toast(t('agentsPage.permissionUpdated'), 'success');
      setPermAgent(null);
      load();
    } catch (err: any) {
      toast(err.message || String(err));
    } finally {
      setPermSaving(false);
    }
  };

  const comboWarning = permVis === 'own' && permLevel === 'task-any';

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('page.agents')}</h1>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} size="sm">
          + {t('agentsPage.registerAgent')}
        </Button>
      </div>

      <div className="surface-card space-y-3 p-4">
        <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
          {t('agentsPage.adminTokenHint')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="hub-token" className="text-xs text-muted-foreground">
              {t('agentsPage.adminApiToken')}
            </Label>
            <Input
              id="hub-token"
              type="password"
              autoComplete="off"
              value={hubTokenInput}
              onChange={(e) => setHubTokenInput(e.target.value)}
              placeholder={t('agentsPage.tokenPlaceholder')}
              className="font-mono text-sm bg-muted/50 border-border/50"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={handleSaveHubToken}>
            {t('agentsPage.saveToBrowser')}
          </Button>
        </div>
      </div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-20 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div className="text-base font-medium mb-1">{t('agentsPage.emptyTitle')}</div>
          <div className="text-sm opacity-70">{t('agentsPage.emptyHint')}</div>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="px-3 py-3 w-10 font-medium" aria-label={t('common.connectionAria')} />
                <th className="px-4 py-3 font-medium w-[190px]">{t('agentsPage.colName')}</th>
                <th className="px-4 py-3 font-medium w-[110px]">{t('agentsPage.colType')}</th>
                <th className="px-4 py-3 font-medium w-[120px]">{t('agentsPage.colPermission')}</th>
                <th className="px-4 py-3 font-medium w-[110px]">{t('agentsPage.colVisibility')}</th>
                <th className="px-4 py-3 font-medium w-[90px]">{t('agentsPage.colState')}</th>
                <th className="px-4 py-3 font-medium w-[120px]">{t('agentsPage.colLastSeen')}</th>
                <th className="px-4 py-3 font-medium min-w-[360px]">{t('agentsPage.colCapabilities')}</th>
                <th className="px-4 py-3 font-medium text-right w-[120px]">{t('agentsPage.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-border/30 last:border-0 hover:bg-background/45 transition-colors">
                  <td className="px-3 py-4 align-top">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[agent.status] || STATUS_COLORS.offline}`} />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold leading-5 text-foreground">{agent.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{agent.id}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      agent.type === 'webhook'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-purple-500/15 text-purple-400'
                    }`}>
                      {agentTypeLabel(agent.type)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      onClick={() => openPermissionDialog(agent)}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${permissionBadgeClass(normalizePermission(agent))}`}
                    >
                      {t(`permission.${normalizePermission(agent)}`)}
                    </button>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      onClick={() => openPermissionDialog(agent)}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${visibilityBadgeClass(normalizeVisibility(agent))}`}
                    >
                      {t(`visibility.${normalizeVisibility(agent)}`)}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground capitalize align-top">{agentStatusLabel(agent.status)}</td>
                  <td className="px-4 py-4 text-muted-foreground text-xs align-top">
                    {agent.lastSeen ? relativeTime(agent.lastSeen) : t('common.dash')}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {agent.capabilities && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {agent.capabilities.taskTypes?.map((type, index) => (
                          <span key={index} className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
                            {type}
                          </span>
                        ))}
                        {agent.capabilities.languages?.map((lang, index) => (
                          <span key={index} className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                    {agent.rules && (
                      <details className="mt-2 max-w-3xl text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium text-foreground/80 hover:text-primary">{t('agentsPage.viewRules')}</summary>
                        <div className="mt-2 max-h-32 overflow-auto rounded-md border border-border/60 bg-background/70 p-3 font-mono leading-5 whitespace-pre-wrap">
                          {agent.rules}
                        </div>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleEdit(agent)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setConfirmDeleteId(agent.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permission edit (PATCH /agents/:id — requires admin token in browser) */}
      <AppDialog
        open={!!permAgent}
        onClose={() => {
          if (!permSaving) setPermAgent(null);
        }}
        title={
          permAgent
            ? t('agentsPage.permissionTitle', { name: permAgent.name })
            : t('agentsPage.permissionTitleFallback')
        }
      >
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label>{t('agentsPage.labelPermissionLevel')}</Label>
            <Select value={permLevel} onValueChange={(v) => setPermLevel(v as PermissionLevel)}>
              <SelectTrigger className="bg-muted/50 border-border/50">
                <SelectValue placeholder={t('agentsPage.labelPermissionLevel')} />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`permission.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('agentsPage.labelVisibilityScope')}</Label>
            <Select value={permVis} onValueChange={(v) => setPermVis(v as VisibilityScope)}>
              <SelectTrigger className="bg-muted/50 border-border/50">
                <SelectValue placeholder={t('agentsPage.labelVisibilityScope')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own">{t('visibility.own')}</SelectItem>
                <SelectItem value="global">{t('visibility.global')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {comboWarning && (
            <div className="rounded-md border border-yellow-500/45 bg-yellow-500/10 px-3 py-2 text-[13px] text-yellow-100/95">
              {t('agentsPage.comboWarning')}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPermAgent(null)} disabled={permSaving}>
              {t('common.cancel')}
            </Button>
            <Button type="button" size="sm" onClick={handleSavePermissions} disabled={permSaving}>
              {permSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </AppDialog>

      {/* Register Dialog */}
      <AppDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('agentsPage.registerTitle')}>
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="agent-id">{t('agentsPage.fieldId')}</Label>
            <Input
              id="agent-id"
              placeholder={t('agentsPage.idPlaceholder')}
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-name">{t('agentsPage.fieldName')}</Label>
            <Input
              id="agent-name"
              placeholder={t('agentsPage.namePlaceholder')}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-type">{t('agentsPage.fieldType')}</Label>
            <select
              id="agent-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as AgentType)}
              className="w-full rounded-md border border-border/50 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="manual">{t('agentType.manual')}</option>
              <option value="webhook">{t('agentType.webhook')}</option>
            </select>
          </div>
          {formType === 'webhook' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="agent-endpoint">{t('agentsPage.fieldEndpoint')}</Label>
                <Input
                  id="agent-endpoint"
                  placeholder="https://hooks.example.com/agent"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-heartbeat">{t('agentsPage.fieldHeartbeat')}</Label>
                <Input
                  id="agent-heartbeat"
                  type="number"
                  value={formHeartbeat}
                  onChange={(e) => setFormHeartbeat(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="agent-capabilities">{t('agentsPage.fieldCapabilities')}</Label>
            <textarea
              id="agent-capabilities"
              placeholder={t('agentsPage.capabilitiesPlaceholder')}
              value={formCapabilities}
              onChange={(e) => setFormCapabilities(e.target.value)}
              onBlur={(e) => validateCapabilities(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] ${capabilitiesError ? 'border-destructive' : 'bg-muted/50 border-border/50'}`}
            />
            {capabilitiesError && (
              <p className="text-xs text-destructive">{capabilitiesError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-rules">
              {t('agentsPage.fieldRules')}
              <span className="ml-1 text-xs text-gray-400 font-normal">{t('common.markdownOptional')}</span>
            </Label>
            <textarea
              id="agent-rules"
              placeholder={t('agentsPage.rulesPlaceholder')}
              value={formRules}
              onChange={(e) => setFormRules(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono bg-muted/50 border-border/50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} size="sm">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formId.trim() || !formName.trim() || submitting}
              size="sm"
            >
              {submitting ? t('common.registering') : t('common.register')}
            </Button>
          </div>
        </div>
      </AppDialog>

      {/* Edit Dialog */}
      <AppDialog open={editModalOpen} onClose={() => setEditModalOpen(false)} title={t('agentsPage.editTitle')}>
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="edit-agent-id">{t('agentsPage.fieldId')}</Label>
            <Input
              id="edit-agent-id"
              placeholder={t('agentsPage.idPlaceholder')}
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="bg-muted/50 border-border/50"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-name">{t('agentsPage.fieldName')}</Label>
            <Input
              id="edit-agent-name"
              placeholder={t('agentsPage.namePlaceholder')}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-type">{t('agentsPage.fieldType')}</Label>
            <select
              id="edit-agent-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as AgentType)}
              className="w-full rounded-md border border-border/50 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="manual">{t('agentType.manual')}</option>
              <option value="webhook">{t('agentType.webhook')}</option>
            </select>
          </div>
          {formType === 'webhook' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-agent-endpoint">{t('agentsPage.fieldEndpoint')}</Label>
                <Input
                  id="edit-agent-endpoint"
                  placeholder="https://hooks.example.com/agent"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-agent-heartbeat">{t('agentsPage.fieldHeartbeat')}</Label>
                <Input
                  id="edit-agent-heartbeat"
                  type="number"
                  value={formHeartbeat}
                  onChange={(e) => setFormHeartbeat(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-agent-capabilities">{t('agentsPage.fieldCapabilities')}</Label>
            <textarea
              id="edit-agent-capabilities"
              placeholder={t('agentsPage.capabilitiesPlaceholder')}
              value={formCapabilities}
              onChange={(e) => setFormCapabilities(e.target.value)}
              onBlur={(e) => validateCapabilities(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] ${capabilitiesError ? 'border-destructive' : 'bg-muted/50 border-border/50'}`}
            />
            {capabilitiesError && (
              <p className="text-xs text-destructive">{capabilitiesError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-rules">
              {t('agentsPage.fieldRules')}
              <span className="ml-1 text-xs text-gray-400 font-normal">{t('common.markdownOptional')}</span>
            </Label>
            <textarea
              id="edit-agent-rules"
              placeholder={t('agentsPage.rulesPlaceholder')}
              value={formRules}
              onChange={(e) => setFormRules(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono bg-muted/50 border-border/50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)} size="sm">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                handleCreate();
                setEditModalOpen(false);
              }}
              disabled={!formId.trim() || !formName.trim() || submitting}
              size="sm"
            >
              {submitting ? t('common.updating') : t('common.update')}
            </Button>
          </div>
        </div>
      </AppDialog>

      {/* Delete Confirm Dialog */}
      <AppDialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title={t('agentsPage.deleteAgentTitle')}>
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground mb-4">
            {t('agentsPage.deleteAgentConfirm')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} size="sm">
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} size="sm">
              {deleting ? t('agentsPage.deleting') : t('common.delete')}
            </Button>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
