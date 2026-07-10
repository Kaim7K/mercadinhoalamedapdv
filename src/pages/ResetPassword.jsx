import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let invalidTimer;
    const callbackInUrl = window.location.search.includes('code=')
      || window.location.hash.includes('access_token=')
      || window.location.hash.includes('type=recovery');

    appClient.supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setHasRecoverySession(true);
        setChecking(false);
        return;
      }
      if (callbackInUrl) {
        invalidTimer = window.setTimeout(() => {
          if (mounted) setChecking(false);
        }, 2500);
      } else {
        setChecking(false);
      }
    });

    const { data: listener } = appClient.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (invalidTimer) window.clearTimeout(invalidTimer);
        setHasRecoverySession(Boolean(session));
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
      if (invalidTimer) window.clearTimeout(invalidTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await appClient.auth.resetPassword({ newPassword });
      await appClient.auth.logout(null);
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="fixed inset-0 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  if (!hasRecoverySession) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Link de redefinição inválido"
        subtitle="Este link está ausente, inválido ou expirado"
        footer={<Link to="/forgot-password" className="text-primary font-medium hover:underline">Solicitar um novo link</Link>}
      >
        <p className="text-sm text-foreground text-center">Solicite uma nova redefinição de senha para continuar.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="Nova senha" subtitle="Digite sua nova senha abaixo">
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="new-password" autoFocus placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 h-12" minLength={6} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" minLength={6} required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redefinindo...</> : "Redefinir senha"}
        </Button>
      </form>
    </AuthLayout>
  );
}
