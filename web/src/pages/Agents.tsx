import { useState, useEffect, useCallback } from 'react';
import { listAgents, registerAgent, deleteAgent } from '../api';
import { AppDialog } from '@/components/ui/AppDialog';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { relativeTime } from '../utils';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Agent, AgentType } from '../types';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
  offline: 'bg-gray-500',
  busy: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]',
};

export function Agents() {
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
        setCapabilitiesError('Must be a JSON object');
        return false;
      }
      if (!Array.isArray(parsed.taskTypes)) {
        setCapabilitiesError('taskTypes must be an array');
        return false;
      }
      if (!Array.isArray(parsed.languages)) {
        setCapabilitiesError('languages must be an array');
        return false;
      }
      setCapabilitiesError('');
      return true;
    } catch (e) {
      setCapabilitiesError('Invalid JSON format');
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} size="sm">
          + Register Agent
        </Button>
      </div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5 text-muted-foreground">
          <svg className="w-12 h-12 mb-4 opacity-20 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div className="text-base font-medium mb-1">No agents registered</div>
          <div className="text-sm opacity-70">Click "Register Agent" to add your first agent.</div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Seen</th>
                <th className="px-4 py-3 font-medium">Capabilities</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-border/30 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[agent.status] || STATUS_COLORS.offline}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      agent.type === 'webhook'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-purple-500/15 text-purple-400'
                    }`}>
                      {agent.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{agent.status}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {agent.lastSeen ? relativeTime(agent.lastSeen) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {agent.capabilities && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {agent.capabilities.taskTypes?.map((type, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400">
                            {type}
                          </span>
                        ))}
                        {agent.capabilities.languages?.map((lang, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                    {agent.rules && (
                      <details className="mt-2 text-xs text-gray-500">
                        <summary className="cursor-pointer font-medium text-gray-600">查看规则</summary>
                        <div className="mt-1 bg-gray-50 rounded p-2 whitespace-pre-wrap line-clamp-6">
                          {agent.rules}
                        </div>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleEdit(agent)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setConfirmDeleteId(agent.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Dialog */}
      <AppDialog open={modalOpen} onClose={() => setModalOpen(false)} title="Register Agent">
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="agent-id">ID</Label>
            <Input
              id="agent-id"
              placeholder="e.g. claude-opus"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. Claude Opus 4"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-type">Type</Label>
            <select
              id="agent-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as AgentType)}
              className="w-full rounded-md border border-border/50 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="manual">Manual</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          {formType === 'webhook' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="agent-endpoint">Endpoint URL</Label>
                <Input
                  id="agent-endpoint"
                  placeholder="https://hooks.example.com/agent"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-heartbeat">Heartbeat Interval (seconds)</Label>
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
            <Label htmlFor="agent-capabilities">Capabilities (JSON)</Label>
            <textarea
              id="agent-capabilities"
              placeholder='{"taskTypes": ["code", "review"], "languages": ["Chinese", "English"]}'
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
              行为规则
              <span className="ml-1 text-xs text-gray-400 font-normal">（可选，Markdown）</span>
            </Label>
            <textarea
              id="agent-rules"
              placeholder="本 Agent 的行为约束、自测规程、不允许的行为……"
              value={formRules}
              onChange={(e) => setFormRules(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono bg-muted/50 border-border/50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formId.trim() || !formName.trim() || submitting}
              size="sm"
            >
              {submitting ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </div>
      </AppDialog>

      {/* Edit Dialog */}
      <AppDialog open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Agent">
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="edit-agent-id">ID</Label>
            <Input
              id="edit-agent-id"
              placeholder="e.g. claude-opus"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="bg-muted/50 border-border/50"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-name">Name</Label>
            <Input
              id="edit-agent-name"
              placeholder="e.g. Claude Opus 4"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-type">Type</Label>
            <select
              id="edit-agent-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as AgentType)}
              className="w-full rounded-md border border-border/50 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="manual">Manual</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          {formType === 'webhook' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-agent-endpoint">Endpoint URL</Label>
                <Input
                  id="edit-agent-endpoint"
                  placeholder="https://hooks.example.com/agent"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-agent-heartbeat">Heartbeat Interval (seconds)</Label>
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
            <Label htmlFor="edit-agent-capabilities">Capabilities (JSON)</Label>
            <textarea
              id="edit-agent-capabilities"
              placeholder='{"taskTypes": ["code", "review"], "languages": ["Chinese", "English"]}'
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
              行为规则
              <span className="ml-1 text-xs text-gray-400 font-normal">（可选，Markdown）</span>
            </Label>
            <textarea
              id="edit-agent-rules"
              placeholder="本 Agent 的行为约束、自测规程、不允许的行为……"
              value={formRules}
              onChange={(e) => setFormRules(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono bg-muted/50 border-border/50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)} size="sm">
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleCreate();
                setEditModalOpen(false);
              }}
              disabled={!formId.trim() || !formName.trim() || submitting}
              size="sm"
            >
              {submitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </AppDialog>

      {/* Delete Confirm Dialog */}
      <AppDialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Delete Agent">
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete this agent? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} size="sm">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} size="sm">
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
