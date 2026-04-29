import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listAgents, issueAgentCredential } from '../api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useTranslation } from 'react-i18next';
import type { Agent } from '../types';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import {
  buildLocalStdioConfig,
  buildRemoteSseConfig,
  stringifyMcpConfig,
} from '@/lib/mcpConfig';

const PRESET_AGENT_IDS = ['claude-desktop', 'claude-code', 'cursor'];

export function Setup() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [remoteBase, setRemoteBase] = useState('');
  const [hubBin, setHubBin] = useState('~/.nerve-hub/nerve-hub');
  const [dbPath, setDbPath] = useState('~/.nerve/hub.db');
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listAgents();
      setAgents(data);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(null, load);

  const sortedAgents = useMemo(() => {
    const presetRank = (id: string) => {
      const i = PRESET_AGENT_IDS.indexOf(id);
      return i === -1 ? 999 : i;
    };
    return [...agents].sort((a, b) => presetRank(a.id) - presetRank(b.id) || a.id.localeCompare(b.id));
  }, [agents]);

  const buildJsonForAgent = useCallback(
    (agent: Agent, token: string) =>
      stringifyMcpConfig(buildLocalStdioConfig(agent.id, token, hubBin.trim(), dbPath.trim())),
    [hubBin, dbPath],
  );

  const handleIssueToken = async (agentId: string) => {
    setIssuing(agentId);
    try {
      const res = await issueAgentCredential(agentId);
      setTokens((prev) => ({ ...prev, [agentId]: res.token }));
      toast(t('setup.tokenIssued'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(/403|forbidden/i.test(msg) ? `${msg}${t('setup.tokenForbiddenHint')}` : msg);
    } finally {
      setIssuing(null);
    }
  };

  const handleCopy = async (agent: Agent) => {
    try {
      let text: string;
      if (remoteBase.trim()) {
        text = stringifyMcpConfig(buildRemoteSseConfig(agent.id, remoteBase.trim()));
      } else {
        const tok = tokens[agent.id];
        if (!tok) {
          toast(t('setup.generateTokenFirst'));
          return;
        }
        text = buildJsonForAgent(agent, tok);
      }
      await navigator.clipboard.writeText(text);
      toast(t('setup.copiedMcpJson'), 'success');
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      toast(`${t('setup.copyFailed')} ${detail ? `(${detail})` : ''}`);
    }
  };

  return (
    <div className="page-shell max-w-5xl">
      <div>
        <Link to="/agents" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block no-underline">
          {t('setup.linkAgents')}
        </Link>
        <h1 className="page-title">{t('page.setupMcp')}</h1>
        <p className="page-description">
          {t('setup.intro')}
        </p>
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('setup.connectionCardTitle')}</CardTitle>
          <CardDescription>{t('setup.connectionCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="remote-base">{t('setup.remoteHub')}</Label>
            <Input
              id="remote-base"
              value={remoteBase}
              onChange={(e) => setRemoteBase(e.target.value)}
              placeholder={t('setup.remotePlaceholder')}
              className="font-mono text-[13px]"
            />
          </div>
          {!remoteBase.trim() && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hub-bin">{t('setup.commandLabel')}</Label>
                <Input
                  id="hub-bin"
                  value={hubBin}
                  onChange={(e) => setHubBin(e.target.value)}
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-path">{t('setup.dbPathLabel')}</Label>
                <Input
                  id="db-path"
                  value={dbPath}
                  onChange={(e) => setDbPath(e.target.value)}
                  className="font-mono text-[13px]"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {sortedAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('setup.noAgentsPlain', { ids: PRESET_AGENT_IDS.join(', ') })}
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sortedAgents.map((agent) => {
            const tok = tokens[agent.id];
            const preset = PRESET_AGENT_IDS.includes(agent.id);
            return (
              <Card key={agent.id} className="surface-card overflow-hidden">
                <CardHeader className="pb-3 flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      {agent.name}
                      {preset && (
                        <span className="text-[10px] font-normal uppercase tracking-wide px-1.5 py-0 rounded bg-primary/15 text-primary shrink-0">
                          {t('common.preset')}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="font-mono text-[12px] truncate">{agent.id}</CardDescription>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                    {!remoteBase.trim() && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1"
                        disabled={!!issuing}
                        onClick={() => handleIssueToken(agent.id)}
                      >
                        {issuing === agent.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5" />
                        )}
                        {t('common.issueToken')}
                      </Button>
                    )}
                    <Button type="button" variant="default" size="sm" className="gap-1" onClick={() => handleCopy(agent)}>
                      <Copy className="w-3.5 h-3.5" />
                      {t('common.copyJson')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {remoteBase.trim() ? (
                    <pre className="max-h-52 overflow-auto rounded-md border border-border bg-black/40 p-3 font-mono text-xs leading-relaxed text-sky-100/95 whitespace-pre-wrap break-all">
                      {stringifyMcpConfig(buildRemoteSseConfig(agent.id, remoteBase.trim()))}
                    </pre>
                  ) : !tok ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t('setup.hintAfterIssue')}
                    </p>
                  ) : (
                    <pre className="max-h-52 overflow-auto rounded-md border border-border bg-black/40 p-3 font-mono text-xs leading-relaxed text-emerald-100/95 whitespace-pre-wrap break-all">
                      {buildJsonForAgent(agent, tok)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
