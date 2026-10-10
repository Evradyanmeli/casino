import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Shared locks preserve the original overflow when dialogs overlap.
const dialogs: HTMLElement[] = [];
let originalOverflow = '';

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialogs.push(dialog);
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter(el => el.tabIndex >= 0 && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
    (focusable()[0] || dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (dialogs[dialogs.length - 1] === dialog && !dialog.contains(event.target as Node)) {
        (focusable()[0] || dialog).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      const wasTop = dialogs[dialogs.length - 1] === dialog;
      dialogs.splice(dialogs.indexOf(dialog), 1);
      if (!dialogs.length) document.body.style.overflow = originalOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="relative bg-[#1A1A2E] rounded-xl border border-gray-800 w-full max-w-md p-6 shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 id={titleId} className="text-xl font-display text-gold break-words min-w-0">{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="shrink-0 text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>, document.body,
  );
}
