import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
// import {Building, Phone} from 'lucide-react'
import { User, Mail, Shield, Settings, Crown, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../context/AuthContext';

type UserTier = 'Básico' | 'Profesional' | 'Empresa' | 'Administrador';

interface AccountSectionProps {
  onNavigateToSubscription: () => void;
  userTier: UserTier;
  onTierChange: (tier: UserTier) => void;
}

export function AccountSection({ onNavigateToSubscription, userTier, onTierChange }: AccountSectionProps) {
  const { user } = useAuth();

  const accountData = {
    name: user?.nombre || '0',
    email: user?.email || '0',
    firm: user?.especialidad || user?.matricula_profesional || '0',
    memberSince: user?.fecha_registro ? new Date(user.fecha_registro).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : '0',
    activeCases: 0,
    totalCases: 0,
    subscription: user?.rol_nombre || userTier
  };

  const getInitials = (name: string) => {
    if (name === '0') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-gray-900">Configuración de Cuenta</h2>
        <p className="text-gray-600 mt-1">Administre su perfil y preferencias</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl">{getInitials(accountData.name)}</AvatarFallback>
              </Avatar>
              <h3 className="mt-4 text-xl">{accountData.name}</h3>
              <p className="text-sm text-gray-600 mt-2">
                Miembro desde {accountData.memberSince}
              </p>
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Casos Activos</span>
                <span className="text-sm">{accountData.activeCases}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total de Casos</span>
                <span className="text-sm">{accountData.totalCases}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plan</span>
                <Badge className="bg-blue-600">{accountData.subscription}</Badge>
              </div>
            </div>

            <Button className="w-full gap-2">
              <Settings className="w-4 h-4" />
              Editar Perfil
            </Button>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información de Cuenta</CardTitle>
            <CardDescription>Actualice los detalles de su cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full-name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nombre Completo
                </Label>
                <Input id="full-name" defaultValue={accountData.name} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Correo Electrónico
                </Label>
                <Input id="email" type="email" defaultValue={accountData.email} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button>Guardar Cambios</Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Subscription */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Plan de Suscripción
            </CardTitle>
            <CardDescription>Su plan actual y beneficios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600 text-lg px-3 py-1">
                      {accountData.subscription}
                    </Badge>
                  </div>
                  <p className="text-gray-700 mb-1">
                    {userTier === 'Básico' 
                      ? 'Plan básico con funciones limitadas. Actualice para descargar y subir documentos.'
                      : 'Su plan actual incluye casos ilimitados, 100 GB de almacenamiento y soporte prioritario.'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Próxima facturación: 5 de Diciembre, 2025
                  </p>
                </div>
                <Button onClick={onNavigateToSubscription} className="gap-2">
                  Ver Todos los Planes
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Demo: Change Tier */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="tier-select">Cambiar Plan (Demo)</Label>
              <Select value={userTier} onValueChange={onTierChange}>
                <SelectTrigger id="tier-select">
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico</SelectItem>
                  <SelectItem value="Profesional">Profesional</SelectItem>
                  <SelectItem value="Empresa">Empresa</SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Use este selector para probar diferentes niveles de acceso
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Seguridad y Privacidad
            </CardTitle>
            <CardDescription>Administre su configuración de seguridad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contraseña Actual</Label>
                <Input id="current-password" type="password" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <Input id="new-password" type="password" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button>Actualizar Contraseña</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
