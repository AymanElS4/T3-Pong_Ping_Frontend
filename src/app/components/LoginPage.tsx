import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Scale, Shield } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface LoginPageProps {
  onLogin: () => void;
  onShowAdminLogin: () => void;
}

export function LoginPage({ onLogin, onShowAdminLogin }: LoginPageProps) {
  const { login } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState(''); // Estado para el código de 6 dígitos de confirmación
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFormStates = () => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isForgotPassword) {
        if (recoveryStep === 1) {
          // PASO 1: Enviar código al correo
          await api.post('/auth/password-reset-request/', { email });
          setRecoveryStep(2);
          alert('Se ha enviado un código de verificación a tu correo.');
        } else {
          // PASO 2: Confirmar código y nueva clave
          if (password !== confirmPassword) {
            throw new Error('Las contraseñas no coinciden');
          }
          if (code.length !== 6) {
            throw new Error('El código debe tener 6 dígitos');
          }
          await api.post('/auth/password-reset-confirm/', {
            email,
            codigo: code,
            password
          });
          alert('Contraseña restablecida con éxito. Ya puedes iniciar sesión.');
          setIsForgotPassword(false);
          setRecoveryStep(1);
          resetFormStates();
        }
      }else if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden');
        }
        // Registro
        await api.post('/auth/register/', { 
          nombre: email.split('@')[0], // Mock name from email
          email, 
          password 
        });
        setIsSignUp(false);
        alert('Cuenta creada. Ya puedes iniciar sesión.');
      } else {
        // Login
        await login(email, password);
        onLogin();
      }
    } catch (err) {
      if(err instanceof Error){
        setError(err.message || 'Error en la operación');
      }else{ //para evadir el uso de any, si es cualquier otro string
        //igualmente se da el mensaje de error
        setError('Error en la operación');
      }
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCardTitle = () => {
    if (isForgotPassword) {
      return recoveryStep === 1 ? 'Recuperar Contraseña' : 'Establecer Nueva Contraseña';
    }
    return isSignUp ? 'Crear Cuenta' : 'Bienvenido de Nuevo';
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80"
          alt="Law Library Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md relative z-10 shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-3 rounded-full shadow-lg">
              <Scale className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">{getCardTitle()}</CardTitle>
            <CardDescription className="text-gray-500">
              {isForgotPassword 
                ? (recoveryStep === 1 ? 'Ingresa tu correo para recibir un código de verificación de 6 dígitos' : 'Ingresa el código enviado y tu nueva contraseña')
                : (isSignUp ? 'Regístrate para acceder al sistema' : 'Inicia sesión en tu sistema de gestión legal')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo EMAIL: Se muestra en Login, Registro y en el Paso 1 de recuperación. En el paso 2 se queda bloqueado para recordar el correo */}
            {(!isForgotPassword || recoveryStep === 1) ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nombre@firma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email-readonly">Recuperando cuenta para:</Label>
                <Input id="email-readonly" type="email" value={email} disabled className="bg-gray-100" />
              </div>
            )}

            {/* Campo CÓDIGO VERIFICACIÓN: Solo en el Paso 2 de recuperación */}
            {isForgotPassword && recoveryStep === 2 && (
              <div className="space-y-2">
                <Label htmlFor="verification-code">Código de Verificación (6 dígitos)</Label>
                <Input
                  id="verification-code"
                  type="text"
                  maxLength={6}
                  placeholder="Ej: 123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} // Solo números
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}
            
            {/* Campos CONTRASEÑA: Se ocultan en el Paso 1 de recuperación */}
            {(!isForgotPassword || recoveryStep === 2) && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  {isForgotPassword ? 'Nueva Contraseña' : 'Contraseña'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Ingresa la contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Campo CONFIRMAR CONTRASEÑA: En Registro o Paso 2 de recuperación */}
            {(isSignUp || (isForgotPassword && recoveryStep === 2)) && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirma la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? 'Procesando...' : 
                  isForgotPassword ? (recoveryStep === 1 ? 'Enviar Código' : 'Restablecer Contraseña') :
                  isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </Button>

              {/* Botones de navegación interna de estados */}
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setIsForgotPassword(false);
                  setRecoveryStep(1);
                  setIsSignUp(!isSignUp);
                  resetFormStates();
                }}
                disabled={isSubmitting}
              >
                {isForgotPassword ? 'Volver al Login' : isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
              </Button>
            </div>

            {/* Enlace "¿Olvidaste tu contraseña?" original */}
            {!isSignUp && !isForgotPassword && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setRecoveryStep(1);
                    resetFormStates();
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
                </div>
              )}
              {/* Cancelar proceso de recuperación */}
              {isForgotPassword && (
                <div className="text-center">
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:underline"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setRecoveryStep(1);
                      resetFormStates();
                    }}
                  >
                    Cancelar recuperación
                  </button>
                </div>
              )}
          </form>
           <div className="mt-6 pt-6 border-t">
            <Button
              variant="outline"
              className="w-full gap-2 border-gray-300"
              onClick={onShowAdminLogin}
              type="button"
              disabled={isSubmitting}
            >
              <Shield className="w-4 h-4 text-gray-500" />
              Acceso de Administrador
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
