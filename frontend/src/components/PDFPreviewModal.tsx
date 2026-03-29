'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Download, Check, Loader2, Eye } from 'lucide-react';
import clsx from 'clsx';

const TEMPLATES = [
  { key: 'classic',     label: 'Classic',      icon: '📄', desc: 'Logo gauche, style professionnel' },
  { key: 'compact',     label: 'Compact',       icon: '📋', desc: 'Condensé, bannière sombre' },
  { key: 'detailed',    label: 'Détaillé',      icon: '📑', desc: 'Émetteur / destinataire en blocs' },
  { key: 'corporate',   label: 'Corporate',     icon: '🏢', desc: 'Logo centré, en-tête formel' },
  { key: 'table_focus', label: 'Tableau Focus', icon: '📊', desc: 'Titre large, tableau premium' },
];

interface Props {
  invoice: any;
  company: any;
  onClose: () => void;
  onDownload: (invoice: any, company: any) => void;
  onTemplateChange?: (t: string) => Promise<void>;
}

export default function PDFPreviewModal({ invoice, company, onClose, onDownload, onTemplateChange }: Props) {
  const prevUrlRef = useRef<string>('');
  const [selected, setSelected] = useState(invoice.templateType || 'classic');
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const renderPreview = useCallback(async (tmpl: string) => {
    setRendering(true);
    try {
      const { generateInvoicePDFDoc } = await import('@/lib/pdfGenerator');
      const doc = generateInvoicePDFDoc({ ...invoice, templateType: tmpl }, company);
      const blob = doc.output('blob');
      // Revoke previous blob URL to avoid memory leak
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      console.error('Preview error', err);
    }
    setRendering(false);
  }, [invoice, company]);

  useEffect(() => {
    renderPreview(selected);
  }, [selected]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); };
  }, []);

  const handleDownload = async () => {
    setSaving(true);
    try {
      if (onTemplateChange && selected !== invoice.templateType) {
        await onTemplateChange(selected);
      }
      onDownload({ ...invoice, templateType: selected }, company);
    } catch {
      onDownload({ ...invoice, templateType: selected }, company);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <Eye size={16} className="text-slate-600" />
            </div>
            <div>
              <h2 className="font-display font-700 text-slate-900">Aperçu du document</h2>
              <p className="text-xs text-slate-500">{invoice.number} · Sélectionnez un template puis téléchargez</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">

          {/* Left — template selector */}
          <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50 flex flex-col overflow-y-auto">
            <p className="text-xs font-600 text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2">Template</p>
            <div className="px-3 pb-4 space-y-1.5 flex-1">
              {TEMPLATES.map((t) => {
                const isActive = selected === t.key;
                const isCurrent = invoice.templateType === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelected(t.key)}
                    disabled={rendering}
                    className={clsx(
                      'w-full text-left px-3 py-3 rounded-xl border-2 transition-all duration-150',
                      isActive ? 'border-brand-500 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{t.icon}</span>
                        <span className={clsx('text-sm font-medium', isActive ? 'text-brand-700' : 'text-slate-800')}>
                          {t.label}
                        </span>
                      </div>
                      <div className={clsx(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                        isActive ? 'border-brand-600 bg-brand-600' : 'border-slate-300',
                      )}>
                        {isActive && <Check size={9} className="text-white" strokeWidth={3} />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-tight">{t.desc}</p>
                    {isCurrent && (
                      <span className={clsx('text-xs font-medium mt-1 block', isActive ? 'text-brand-600' : 'text-emerald-600')}>
                        {isActive ? '✓ Template actuel' : '← actuel'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selected !== invoice.templateType && (
              <div className="mx-3 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">⚡ Nouveau template</p>
                <p className="text-xs text-amber-600 mt-0.5">Sera sauvegardé au téléchargement</p>
              </div>
            )}
          </div>

          {/* Center — real PDF iframe */}
          <div className="flex-1 bg-slate-300 relative overflow-hidden flex flex-col">
            {rendering && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-200/95 gap-3">
                <Loader2 size={30} className="animate-spin text-brand-500" />
                <span className="text-sm font-medium text-slate-600">Génération de l'aperçu…</span>
              </div>
            )}

            {previewUrl && !rendering && (
              <iframe
                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-full border-0 bg-white"
                title="Aperçu PDF"
              />
            )}

            {/* Bottom label */}
            {!rendering && previewUrl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm font-medium flex items-center gap-1.5">
                  <span>{TEMPLATES.find(t => t.key === selected)?.icon}</span>
                  <span>{TEMPLATES.find(t => t.key === selected)?.label}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white shrink-0">
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <span>Template :</span>
            <strong className="text-slate-900">
              {TEMPLATES.find(t => t.key === selected)?.icon} {TEMPLATES.find(t => t.key === selected)?.label}
            </strong>
            {selected !== invoice.templateType && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Modifié
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary">Annuler</button>
            <button onClick={handleDownload} disabled={saving || rendering} className="btn-primary px-6">
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Préparation…</>
                : <><Download size={15} /> Télécharger le PDF</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}