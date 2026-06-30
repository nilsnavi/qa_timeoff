import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { api } from '../../shared/api';
import { showAppToast } from '../../shared/utils';

export function JiraIntegrationPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [projectKeys, setProjectKeys] = useState('');

  const connectionQuery = useQuery({
    queryKey: ['jira', 'connection'],
    queryFn: api.jiraConnection,
  });

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      showAppToast('Jira подключена успешно');
      queryClient.invalidateQueries({ queryKey: ['jira', 'connection'] });
    }
    if (searchParams.get('error')) {
      showAppToast(`Ошибка: ${searchParams.get('error')}`, undefined, 'error');
    }
  }, [searchParams, queryClient]);

  const disconnectMutation = useMutation({
    mutationFn: api.jiraDisconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira', 'connection'] });
      showAppToast('Jira отключена');
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.jiraTriggerSync,
    onSuccess: () => {
      showAppToast('Синхронизация запущена');
      queryClient.invalidateQueries({ queryKey: ['jira', 'connection'] });
    },
  });

  const setProjectsMutation = useMutation({
    mutationFn: () => api.jiraSetProjects(projectKeys.split(',').map(p => p.trim()).filter(Boolean)),
    onSuccess: () => {
      showAppToast('Проекты обновлены, запущена синхронизация');
      queryClient.invalidateQueries({ queryKey: ['jira', 'connection'] });
    },
  });

  const connection = connectionQuery.data;
  const isConnected = connection?.status === 'CONNECTED';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Интеграция с Jira</h1>
        <p className="text-[15px] text-white/40 mt-1">
          Подтягивайте задачи из Jira и списывайте время прямо из QA TimeOff
        </p>
      </div>

      <Card>
        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-[15px] text-white/50 mb-4">Jira не подключена</p>
            <a href={`${import.meta.env.VITE_API_URL ?? '/api'}/jira/oauth/start`}>
              <Button>
                <ExternalLink size={15} className="mr-1.5" /> Подключить Jira
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span className="text-[15px] font-semibold text-white">Подключено: {connection.siteUrl}</span>
            </div>

            <div className="field-shell">
              <span className="field-label">Проекты для синхронизации (через запятую)</span>
              <input
                value={projectKeys || connection.selectedProjects?.join(', ') || ''}
                onChange={e => setProjectKeys(e.target.value)}
                placeholder="QA, DEV, BACKEND"
                className="field-input"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => setProjectsMutation.mutate()} disabled={setProjectsMutation.isPending}>
                Сохранить проекты
              </Button>
              <Button size="sm" variant="secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                <RefreshCw size={14} className="mr-1" /> Синхронизировать сейчас
              </Button>
              <Button size="sm" variant="danger" onClick={() => disconnectMutation.mutate()}>
                <Unplug size={14} className="mr-1" /> Отключить
              </Button>
            </div>

            {connection.lastSyncAt && (
              <p className="text-[13px] text-white/30">
                Последняя синхронизация: {new Date(connection.lastSyncAt).toLocaleString('ru-RU')}
              </p>
            )}
            {connection.lastSyncError && (
              <p className="text-[13px] text-rose-400">Ошибка синхронизации: {connection.lastSyncError}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
