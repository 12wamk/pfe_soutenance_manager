import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

/* ---------------- Button ---------------- */
export function Button({ children, variant = 'primary', size = 'md', icon: Icon, loading, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const sizes = { xs: 'px-2.5 py-1.5 text-xs', sm: 'px-3 py-2 text-sm', md: 'px-4 py-2.5 text-sm' };
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200',
    outline: 'border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading} {...props}>
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

/* ---------------- Input ---------------- */
export function Input({ label, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <input
        className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}

/* ---------------- Select ---------------- */
export function Select({ label, children, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <select
        className={`w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ children, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700', purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${colors[color]}`}>{children}</span>;
}

/* ---------------- Modal (en-tête bleu dégradé, carte centrée) ---------------- */
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 text-white rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2980d9 100%)' }}>
          <h3 className="font-bold text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/15 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- ConfirmDialog ---------------- */
export function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 text-white rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg, #c0392b, #e74c3c)' }}>
          <h3 className="font-bold text-base flex items-center gap-2"><AlertTriangle size={18} /> {title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/15 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button variant="danger" onClick={onConfirm}>Supprimer</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ emoji = '📭', title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 mb-5 max-w-sm">{desc}</p>
      {action}
    </div>
  );
}

/* ---------------- StatCard ---------------- */
export function StatCard({ label, value, icon: Icon, gradient }) {
  return (
    <div className={`rounded-xl p-4 text-white shadow-sm flex items-center gap-4 ${gradient}`}>
      <div className="w-11 h-11 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-extrabold leading-none">{value ?? 0}</div>
        <div className="text-xs text-white/80 mt-1">{label}</div>
      </div>
    </div>
  );
}
