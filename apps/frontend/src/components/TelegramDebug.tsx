import { useState } from 'react';

export function TelegramDebug() {
    const [copied, setCopied] = useState(false);
    const tg = window.Telegram?.WebApp;

    const debugData = {
        initDataLength: tg?.initData?.length ?? 0,
        version: tg?.version ?? 'unknown',
        platform: tg?.platform ?? 'unknown',
        colorScheme: tg?.colorScheme ?? 'unknown',
        isExpanded: tg?.isExpanded ?? false,
        initDataUnsafe: (tg as any)?.initDataUnsafe ?? null,
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(debugData, null, 2);
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="rounded-2xl bg-white/80 p-4 shadow-soft ring-1 ring-white/70 dark:bg-slate-900/70 dark:ring-slate-700">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Telegram Debug Info</h3>
            <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                    <dt className="text-slate-500">initData.length</dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200">{debugData.initDataLength}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-slate-500">version</dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200">{debugData.version}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-slate-500">platform</dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200">{debugData.platform}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-slate-500">colorScheme</dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200">{debugData.colorScheme}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-slate-500">isExpanded</dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-200">{String(debugData.isExpanded)}</dd>
                </div>
                <div>
                    <dt className="text-slate-500">initDataUnsafe.user</dt>
                    <dd className="mt-1 break-all font-mono text-slate-800 dark:text-slate-200">
                        {JSON.stringify(debugData.initDataUnsafe?.user ?? null)}
                    </dd>
                </div>
            </dl>
            <button
                type="button"
                onClick={handleCopy}
                className="mt-3 w-full rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-white shadow-soft active:scale-95"
            >
                {copied ? 'Скопировано!' : 'Скопировать данные'}
            </button>
        </div>
    );
}
