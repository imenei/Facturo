'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Aperçu PDF multi-pages.
 *
 * Sur ordinateur on garde le lecteur PDF natif du navigateur (zoom, recherche…).
 * Sur mobile / tablette, les lecteurs intégrés n'affichent souvent QUE la première page :
 * on dessine alors chaque page du PDF dans un canvas (pdf.js), toutes les pages sont visibles
 * en faisant défiler. Si pdf.js ne peut pas se charger, on retombe sur le lecteur natif.
 */
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Boolean(coarse || mobileUA);
}

export default function PdfPagesViewer({ url, title, className = '' }: { url: string; title: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [useCanvas] = useState(() => isTouchDevice());
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!useCanvas || !url) return;
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    setFailed(false);
    setLoading(true);

    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

        const data = await (await fetch(url)).arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        const cssWidth = Math.max(container.clientWidth - 16, 280);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const scale = (cssWidth / base.width) * ratio;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${(cssWidth / base.width) * base.height}px`;
          canvas.className = 'bg-white shadow-md mx-auto mb-3 block';
          container.appendChild(canvas);

          const context = canvas.getContext('2d');
          if (!context) throw new Error('canvas');
          await page.render({ canvasContext: context, viewport }).promise;
          if (pageNumber === 1) setLoading(false);
        }
        setLoading(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, useCanvas]);

  if (!useCanvas || failed) {
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
        className={`w-full h-full border-0 bg-white ${className}`}
        title={title}
      />
    );
  }

  return (
    <div className={`relative w-full h-full overflow-y-auto bg-slate-200 p-2 ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={26} className="animate-spin text-brand-500" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
