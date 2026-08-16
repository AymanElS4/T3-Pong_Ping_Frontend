import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../context/AuthContext';

interface AdminLoginPageProps {
  onLogin: () => void;
  onBackToUserLogin: () => void;
}

export function AdminLoginPage({ onLogin, onBackToUserLogin }: AdminLoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (adminCode !== 'admin123' && adminCode !== 'ADMIN2025') {
      setError('Código de administrador inválido');
      setIsSubmitting(false);
      return;
    }

    try {
      await login(email, password);
      onLogin();
    } catch (err) {
      setError((err as Error).message|| 'Error de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1920&q=80"
          alt="Admin Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 to-blue-900/90" />
      </div>

      {/* Back Button */}
      <Button
        variant="ghost"
        className="absolute top-4 left-4 z-20 text-white hover:bg-white/10"
        onClick={onBackToUserLogin}
        disabled={isSubmitting}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al Login de Usuario
      </Button>

      {/* Admin Login Card */}
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-2 border-blue-600/50">
        <CardHeader className="space-y-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-full shadow-lg">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl text-white font-bold">
              Panel de Administración
            </CardTitle>
            <CardDescription className="text-blue-100">
              Control centralizado para firmas legales
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="mt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Administrativo</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@legalfile.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-password">Contraseña</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-code">Código de Seguridad</Label>
              <Input
                id="admin-code"
                type="password"
                placeholder="Ingresa el código de 2FA"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                required
                disabled={isSubmitting}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Para demo use: admin123
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold" disabled={isSubmitting}>
                {isSubmitting ? 'Verificando...' : 'Acceder al Panel'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
