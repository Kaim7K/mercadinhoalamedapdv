import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { resetToken } = await appClient.auth.resetPasswordRequest(email);
      navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    } catch (err) {
      setError(err.message || 'Não foi possível localizar o usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Redefinir senha"
      subtitle="Confirme seu email para criar uma nova senha"
      footer={<Link to="/login" className="text-primary font-medium hover:underline"><ArrowLeft className="w-3 h-3 inline mr-1" />Voltar ao login</Link>}
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Continuando...</> : 'Continuar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
