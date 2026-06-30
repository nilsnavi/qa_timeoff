import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Download, Eye, History, RefreshCw, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, EmptyState, ErrorState, Loader, Modal } from '../components/ui';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { clsx } from 'clsx';

type Step = 'select' | 'upload' | 'validate' | 'result';
type ImportType = 'USERS' | 'TEAMS' | 'BALANCES';

const typeLabels: Record<ImportType, string> = { USERS: 'Сотрудники', TEAMS: 'Команды', BALANCES: 'Балансы' };
const statusLabels: Record<string, string> = {
  PENDING: 'Ожидание', VALIDATING: 'Проверка', READY: 'Готов', PROCESSING: 'Выполнение', SUCCESS: 'Успешно', PARTIAL_SUCCESS: 'Частично', FAILED: 'Ошибка', CANCELLED: 'Отменён',
};

export function ImportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const [step, setStep] = useState<Step>('select');
  const [importType, setImportType] = useState<ImportType>('USERS');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kpiQuery = useQuery({ queryKey: ['imports', 'kpi'], queryFn: api.importsKpi, enabled: isAdmin });

  const handleDownloadTemplate = () => {
    const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
    window.open(`${apiUrl}/imports/templates/${importType.toLowerCase()}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 10 * 1024 * 1024) { alert('Файл слишком большой. Максимум 10 МБ.'); return; }
      setFile(f);
    }
  };

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Нет файла');
      return api.validateImport(importType, file);
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportJobId(data.importJobId);
      setStep('validate');
    },
    onError: (err: any) => { alert(err?.message ?? 'Ошибка валидации'); },
  });

  const runMutation = useMutation({
    mutationFn: (onlyValid: boolean) => api.runImport(importJobId!, onlyValid),
    onSuccess: (data) => { setResult(data); setStep('result'); queryClient.invalidateQueries({ queryKey: ['imports'] }); },
    onError: (err: any) => { alert(err?.message ?? 'Ошибка импорта'); },
  });

  const handleRestart = () => { setStep('select'); setImportType('USERS'); setFile(null); setPreview(null); setImportJobId(null); setResult(null); };

  if (!isAdmin) return <ErrorState title="У вас нет доступа к импорту данных" />;

  const kpi = kpiQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Импорт данных</h1>
          <p className="text-[15px] text-white/40 mt-1">Массовая загрузка сотрудников, команд и балансов</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}><Download size={14} className="mr-1" />Скачать шаблон</Button>
          <Button variant="secondary" size="sm" onClick={() => { setHistoryOpen(true); }}><History size={14} className="mr-1" />История импортов</Button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['imports'] })} className="grid h-9 w-9 place-items-center rounded-lg text-white/30 hover:text-white/60"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Всего импортов" value={kpi?.total ?? 0} loading={kpiQuery.isLoading} />
        <KpiCard label="Успешных" value={kpi?.success ?? 0} loading={kpiQuery.isLoading} />
        <KpiCard label="С ошибками" value={kpi?.failed ?? 0} loading={kpiQuery.isLoading} />
        <KpiCard label="Последний импорт" value={kpi?.lastImport ? `${new Date(kpi.lastImport.createdAt).toLocaleDateString('ru-RU')}, ${statusLabels[kpi.lastImport.status]}` : '—'} loading={kpiQuery.isLoading} stringValue />
      </div>

      {step === 'select' && (
        <div className="enterprise-card p-6 space-y-6">
          <h2 className="text-[18px] font-bold text-white">Шаг 1. Выберите тип импорта</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['USERS', 'TEAMS', 'BALANCES'] as ImportType[]).map(t => (
              <button key={t} onClick={() => setImportType(t)} className={clsx('enterprise-card p-4 text-left hover-lift transition-colors', importType === t ? 'ring-2 ring-[#4C7DFF]' : '')}>
                <span className="text-[15px] font-bold text-white">{typeLabels[t]}</span>
                <p className="text-[13px] text-white/30 mt-1">
                  {t === 'USERS' ? 'fullName, email, role, team' : t === 'TEAMS' ? 'name, description, lead' : 'email, balanceHours, comment'}
                </p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleDownloadTemplate}><Download size={14} className="mr-1" />Скачать шаблон</Button>
            <input type="file" ref={fileInputRef} accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()}><Upload size={14} className="mr-1" />Загрузить файл</Button>
            {file && <span className="text-[14px] text-white/60">{file.name} ({(file.size / 1024).toFixed(1)} КБ)</span>}
          </div>
          {file && (
            <Button onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending} className="w-full">
              {validateMutation.isPending ? 'Проверка...' : 'Проверить файл'}
            </Button>
          )}
        </div>
      )}

      {step === 'validate' && preview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Всего строк" value={preview.totalRows} />
            <KpiCard label="Готово к импорту" value={preview.validRows} />
            <KpiCard label="Ошибок" value={preview.errorCount} />
          </div>

          {preview.errors.length > 0 && (
            <div className="enterprise-card p-4 space-y-3">
              <h3 className="text-[15px] font-bold text-white/60">Ошибки ({preview.errors.length})</h3>
              <table className="w-full text-[13px]">
                <thead><tr className="text-white/30 text-left"><th className="p-2">Строка</th><th className="p-2">Поле</th><th className="p-2">Ошибка</th><th className="p-2">Значение</th></tr></thead>
                <tbody>
                  {preview.errors.map((err: any, i: number) => (
                    <tr key={i} className="border-t border-white/[0.04]"><td className="p-2 text-white/60">{err.rowNumber}</td><td className="p-2 text-white/40">{err.field}</td><td className="p-2 text-rose-400">{err.message}</td><td className="p-2 text-white/30 font-mono">{err.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="enterprise-card p-4 space-y-2">
            <h3 className="text-[15px] font-bold text-white/60">Предпросмотр</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]"><thead><tr className="text-white/30 text-left">
                {preview.preview[0] && Object.keys(preview.preview[0].data).map(k => <th key={k} className="p-2">{k}</th>)}
              </tr></thead><tbody>
                {preview.preview.slice(0, 10).map((r: any, i: number) => (
                  <tr key={i} className="border-t border-white/[0.04]">
                    {Object.values(r.data as Record<string, string>).map((v, j) => <td key={j} className="p-2 text-white/60">{v}</td>)}
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => runMutation.mutate(true)} disabled={runMutation.isPending}>
              {runMutation.isPending ? 'Импорт...' : 'Запустить импорт'}
            </Button>
            <Button variant="secondary" onClick={handleRestart}>Отменить</Button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="enterprise-card p-6 space-y-4">
          <div className="flex items-center gap-2"><CheckCircle size={20} className="text-emerald-400" /><h2 className="text-[18px] font-bold text-white">Импорт завершён</h2></div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ResultCard label="Создано" value={result.createdRows} color="emerald" />
            <ResultCard label="Обновлено" value={result.updatedRows} color="blue" />
            <ResultCard label="Пропущено" value={result.skippedRows} color="amber" />
            <ResultCard label="Ошибок" value={result.errorRows} color="rose" />
          </div>
          <Button onClick={handleRestart} variant="secondary" className="w-full">Новый импорт</Button>
        </div>
      )}

      {historyOpen && <ImportHistoryModal open onClose={() => setHistoryOpen(false)} onOpenDetail={setDetailId} />}
      {detailId && <ImportDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function KpiCard({ label, value, loading, stringValue }: { label: string; value: any; loading?: boolean; stringValue?: boolean }) {
  return (
    <div className="enterprise-card p-4">
      <span className="text-[13px] font-semibold text-white/40">{label}</span>
      <div className="text-xl font-bold text-white mt-1">
        {loading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/[0.04]" /> : stringValue ? <span className="text-[13px]">{value}</span> : value}
      </div>
    </div>
  );
}

function ResultCard({ label, value, color }: { label: string; value: number; color: string }) {
  const cls = { emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', rose: 'text-rose-400' }[color] ?? 'text-white';
  return (
    <div className="text-center"><span className="text-[13px] text-white/30">{label}</span><p className={`text-2xl font-bold ${cls}`}>{value}</p></div>
  );
}

function ImportHistoryModal({ open, onClose, onOpenDetail }: { open: boolean; onClose: () => void; onOpenDetail: (id: string) => void }) {
  const query = useQuery({ queryKey: ['imports', 'history'], queryFn: () => api.getImports({}), enabled: open });
  if (!open) return null;
  const items = query.data?.items ?? [];
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-8 overflow-auto">
        <div className="w-full max-w-4xl enterprise-card p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-white">История импортов</h2><Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button></div>
          {query.isLoading && <Loader />}
          {items.length === 0 && !query.isLoading && <EmptyState title="Импортов пока нет" description="Загрузите файл сотрудников, команд или балансов, чтобы начать." />}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {items.map((j: any) => (
              <div key={j.id} className="enterprise-card p-3 flex items-center gap-3 hover:bg-white/[0.02] cursor-pointer" onClick={() => { onClose(); onOpenDetail(j.id); }}>
                <span className="text-[12px] text-white/30 w-32">{new Date(j.createdAt).toLocaleString('ru-RU')}</span>
                <span className="text-[13px] font-semibold text-white/60 w-24">{typeLabels[j.type as ImportType] ?? j.type}</span>
                <span className="text-[13px] text-white/30 truncate flex-1">{j.fileName}</span>
                <span className="text-[13px] text-white/50">{j.createdBy?.fullName}</span>
                <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', j.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : j.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400')}>{statusLabels[j.status] ?? j.status}</span>
                <Button size="sm" variant="ghost" className="!min-h-0 h-7 w-7 !p-0 text-white/30"><Eye size={14} /></Button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    </>
  );
}

function ImportDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ['imports', id], queryFn: () => api.getImportById(id), enabled: !!id });
  if (!id) return null;
  const job = query.data as any;
  return (
    <Modal open title="Детали импорта" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Закрыть</Button>}>
      {query.isLoading && <Loader />}
      {job && (
        <div className="space-y-3">
          <DetailRow label="Тип" value={typeLabels[job.type as ImportType] ?? job.type} />
          <DetailRow label="Статус" value={statusLabels[job.status] ?? job.status} />
          <DetailRow label="Файл" value={job.fileName} />
          <DetailRow label="Кто запустил" value={job.createdBy?.fullName ?? '—'} />
          <DetailRow label="Дата" value={new Date(job.createdAt).toLocaleString('ru-RU')} />
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
            <DetailRow label="Всего строк" value={String(job.totalRows)} />
            <DetailRow label="Корректных" value={String(job.validRows)} />
            <DetailRow label="Создано" value={String(job.createdRows)} />
            <DetailRow label="Обновлено" value={String(job.updatedRows)} />
            <DetailRow label="Пропущено" value={String(job.skippedRows)} />
            <DetailRow label="Ошибок" value={String(job.errorRows)} />
          </div>
          {job.errors?.length > 0 && (
            <div className="pt-2 border-t border-white/[0.06]">
              <span className="text-[13px] text-white/40">Ошибки ({job.errors.length})</span>
              <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                {job.errors.map((e: any, i: number) => (
                  <div key={i} className="text-[12px] text-white/30">Строка {e.rowNumber}: {e.message}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start gap-2"><span className="text-[12px] text-white/40 shrink-0">{label}</span><span className="text-[13px] text-white/80">{value}</span></div>;
}
