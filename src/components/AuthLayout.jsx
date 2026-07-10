import React from 'react';
import { LOGO_URL } from '@/lib/helpers';

export default function AuthLayout({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-sidebar border border-border shadow-sm flex items-center justify-center mb-4 overflow-hidden">
            {Icon ? <Icon className="w-9 h-9 text-accent" /> : <img src={LOGO_URL} alt="MercadoFlow PDV" className="w-full h-full object-contain p-1.5" />}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground text-center">{subtitle}</p>}
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1 text-center">{title}</h1>
        </div>

        <div className="bg-card rounded-2xl shadow-xl border border-border p-7">
          {children}
        </div>

        {footer && <div className="text-center text-sm text-muted-foreground mt-5">{footer}</div>}
        <p className="text-center text-xs text-muted-foreground mt-4">
          © {new Date().getFullYear()} MercadoFlow PDV
        </p>
      </div>
    </div>
  );
}
