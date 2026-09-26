'use client';

import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  loading,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <h3 className="text-lg font-display font-700 text-slate-900 mb-3">{title}</h3>
        <div className="text-sm text-slate-600 space-y-2 mb-6">{children}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={danger ? 'btn-primary bg-red-600 hover:bg-red-700 border-red-600' : 'btn-primary'}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
