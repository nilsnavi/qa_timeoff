import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Loader } from '../../components/ui';
import { api } from '../../shared/api';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PermissionsMatrix({ open, onClose }: Props) {
  const matrixQuery = useQuery({
    queryKey: ['permissions', 'matrix'],
    queryFn: api.permissionsMatrix,
    enabled: open,
  });

  const data = matrixQuery.data;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-8 overflow-auto">
        <div className="w-full max-w-[90vw] enterprise-card p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06] shrink-0">
            <h2 className="text-[16px] font-bold text-white">Матрица прав</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          <div className="overflow-auto max-h-[75vh]">
            {matrixQuery.isLoading && <div className="p-8"><Loader /></div>}
            {data && (
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-[#0B1220] z-10">
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-2 font-bold text-white/40 uppercase text-[11px]">Право</th>
                    <th className="text-left px-4 py-2 font-bold text-white/40 uppercase text-[11px]">Группа</th>
                    {data.roles.map(r => (
                      <th key={r.id} className="text-center px-3 py-2 font-bold text-white/40 uppercase text-[11px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{r.name}</span>
                          <span className={`text-[10px] ${r.isSystem ? 'text-amber-400/60' : 'text-blue-400/60'}`}>{r.code}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.permissions.map((row) => (
                    <tr key={row.code} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-white/70">{row.name}</td>
                      <td className="px-4 py-2 text-white/30 text-[12px]">{row.group}</td>
                      {data.roles.map(r => (
                        <td key={r.id} className="text-center px-3 py-2">
                          {row[r.code] ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 text-emerald-400 text-[12px] font-bold">✓</span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded text-white/10 text-[12px]">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    </>
  );
}
