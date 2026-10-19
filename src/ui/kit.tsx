import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Gem, ImageOff, Loader2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Photo, Privacy, User } from '../backend/types';
import { usePhotoUrl, useReducedMotion } from '../lib/hooks';
import { PRIVACY } from './meta';

// ------------------------------------------------------------------ Frame portal

export function FramePortal({ children }: { children: ReactNode }) {
  const [el, setEl] = useState(() => document.getElementById('frame'));
  useEffect(() => {
    if (!el) setEl(document.getElementById('frame'));
  }, [el]);
  return el ? createPortal(children, el) : null;
}

// ------------------------------------------------------------------ Button

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', loading, block, icon, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="spin" size={18} aria-hidden /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Top bar

export function TopBar({ title, back = true, right, transparent, onBack }: { title?: ReactNode; back?: boolean; right?: ReactNode; transparent?: boolean; onBack?: () => void }) {
  const nav = useNavigate();
  return (
    <header className={`topbar ${transparent ? 'topbar-transparent' : ''}`}>
      <div className="topbar-side">
        {back && (
          <IconButton label="Back" onClick={() => (onBack ? onBack() : history.length > 1 ? nav(-1) : nav('/'))}>
            <ChevronLeft size={22} />
          </IconButton>
        )}
      </div>
      {title && <h1 className="topbar-title">{title}</h1>}
      <div className="topbar-side topbar-right">{right}</div>
    </header>
  );
}

// ------------------------------------------------------------------ Images

export function PhotoImg({ photo, variant = 'thumb', alt, className = '', style, eager }: { photo?: Photo; variant?: 'thumb' | 'full'; alt?: string; className?: string; style?: React.CSSProperties; eager?: boolean }) {
  const { url, error } = usePhotoUrl(photo, variant);
  const [loaded, setLoaded] = useState(false);
  if (!photo || error)
    return (
      <div className={`img-fallback ${className}`} style={style} role="img" aria-label={alt ?? 'Photo unavailable'}>
        <ImageOff size={22} />
      </div>
    );
  return (
    <img
      src={url}
      alt={alt ?? photo.caption ?? photo.name}
      className={`photo ${loaded ? 'is-loaded' : ''} ${className}`}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
    />
  );
}

export function Avatar({ user, size = 40 }: { user?: User; size?: number }) {
  if (user?.avatar) return <img className="avatar" src={user.avatar} alt={user.name} width={size} height={size} style={{ width: size, height: size }} />;
  const initials = (user?.name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('');
  const hue = [...(user?.id ?? 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 60% 92%)`, color: `hsl(${hue} 35% 35%)` }} aria-label={user?.name}>
      {initials}
    </span>
  );
}

// ------------------------------------------------------------------ Badges

export function PrivacyBadge({ privacy, solid }: { privacy: Privacy; solid?: boolean }) {
  const m = PRIVACY[privacy];
  const I = m.icon;
  return (
    <span className={`badge badge-${m.tone} ${solid ? 'badge-solid' : ''}`}>
      <I size={12} aria-hidden /> {m.short}
    </span>
  );
}

export function NftBadge({ label = 'Collectible Linked', solid }: { label?: string; solid?: boolean }) {
  return (
    <span className={`badge badge-nft ${solid ? 'badge-solid' : ''}`}>
      <Gem size={12} aria-hidden /> {label}
    </span>
  );
}

export function DemoTag({ children = 'Demo' }: { children?: ReactNode }) {
  return <span className="demo-tag">{children}</span>;
}

// ------------------------------------------------------------------ Empty / loading

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="center-pad" role="status" aria-live="polite">
      <Loader2 className="spin" size={26} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------ Bottom sheet

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; tall?: boolean }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,button,select,textarea,[tabindex]')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FramePortal>
      <AnimatePresence>
        {open && (
          <motion.div className="sheet-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }}>
            <div className="sheet-scrim" onClick={onClose} />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === 'string' ? title : undefined}
              className={`sheet ${tall ? 'sheet-tall' : ''}`}
              initial={{ y: reduced ? 0 : '100%' }}
              animate={{ y: 0 }}
              exit={{ y: reduced ? 0 : '100%' }}
              transition={reduced ? { duration: 0 } : { type: 'spring', damping: 32, stiffness: 340 }}
              drag={reduced ? false : 'y'}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
            >
              <div className="sheet-handle" aria-hidden />
              {title && (
                <div className="sheet-head">
                  <h2>{title}</h2>
                  <IconButton label="Close" onClick={onClose}>
                    <X size={20} />
                  </IconButton>
                </div>
              )}
              <div className="sheet-body" onPointerDownCapture={(e) => e.stopPropagation()}>
                {children}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </FramePortal>
  );
}

// ------------------------------------------------------------------ Toasts & confirm

type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info'; action?: { label: string; run: () => void } };
type ConfirmReq = { title: string; body?: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void };

const UICtx = createContext<{
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  confirm: (o: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>;
}>(null!);

export const useUI = () => useContext(UICtx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3200);
  }, []);
  const confirm = useCallback((o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })), []);
  const close = (v: boolean) => {
    req?.resolve(v);
    setReq(null);
  };
  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <FramePortal>
        <div className="toasts" role="status" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div key={t.id} className={`toast toast-${t.tone}`} initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
                <span>{t.text}</span>
                {t.action && (
                  <button className="toast-action" onClick={t.action.run}>
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {req && (
            <motion.div className="dialog-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sheet-scrim" onClick={() => close(false)} />
              <motion.div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
                <h2 id="dlg-t">{req.title}</h2>
                {req.body && <p>{req.body}</p>}
                <div className="dialog-actions">
                  <Button variant="secondary" onClick={() => close(false)} autoFocus>
                    Cancel
                  </Button>
                  <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                    {req.confirmLabel ?? 'Confirm'}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </FramePortal>
    </UICtx.Provider>
  );
}

// ------------------------------------------------------------------ Forms

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
