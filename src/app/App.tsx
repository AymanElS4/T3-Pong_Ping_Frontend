import { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { HomePage } from './components/HomePage';
import { LegalCaseManager } from './components/LegalCaseManager';
import { LegalCodeManager } from './components/LegalCodeManager';
import { NewsSection } from './components/NewsSection';
import { AccountSection } from './components/AccountSection';
import { SubscriptionPage } from './components/SubscriptionPage';
import { PaymentPage } from './components/PaymentPage';
import { PaymentConfirmation } from './components/PaymentConfirmation';
// import { MembersManager } from './components/MembersManager';
// import {Users} from 'lucide-react';
import { Button } from './components/ui/button';
import { Home, FileText, Scale, Newspaper, User, LogOut, CreditCard, Bell } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Badge } from './components/ui/badge';

type Section = 'home' | 'cases' | 'codes' | 'news' | 'account' | 'subscription' | 'payment' | 'confirmation' | 'members';

interface SelectedPlan {
  name: string;
  price: string;
  features: string[];
}

export default function App() {
  const { user, isLoggedIn, logout, isLoading, unreadCount, markAllAsRead, notifications } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);

  // Derived state from AuthContext
  const userTier = (user?.rol_nombre as unknown) || 'Básico';

  const handleLogout = () => {
    logout();
    setActiveSection('home');
    setShowAdminLogin(false);
  };

  const handleShowAdminLogin = () => {
    setShowAdminLogin(true);
  };

  const handleBackToUserLogin = () => {
    setShowAdminLogin(false);
  };

  const handleLoginSuccess = () => {
    setShowAdminLogin(false);
    setActiveSection('home');
  };

  const handleSelectPlan = (plan: SelectedPlan) => {
    setSelectedPlan(plan);
    setActiveSection('payment');
  };

  const handlePaymentConfirm = () => {
    setActiveSection('confirmation');
  };

  const handleGoHome = () => {
    setActiveSection('home');
    setSelectedPlan(null);
  };

  const handleBackFromPayment = () => {
    setActiveSection('subscription');
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!isLoggedIn) {
    if (showAdminLogin) {
      return <AdminLoginPage onLogin={handleLoginSuccess} onBackToUserLogin={handleBackToUserLogin} />;
    }
    return <LoginPage onLogin={handleLoginSuccess} onShowAdminLogin={handleShowAdminLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Scale className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl text-gray-900 font-semibold">LegalFileManager</h1>
            </div>
            
            <nav className="flex gap-2">
              <Button
                variant={activeSection === 'home' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('home')}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Inicio
              </Button>
              <Button
                variant={activeSection === 'cases' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('cases')}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Casos Legales
              </Button>
              <Button
                variant={activeSection === 'codes' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('codes')}
                className="gap-2"
              >
                <Scale className="w-4 h-4" />
                Artículos Legales
              </Button>
              <Button
                variant={activeSection === 'news' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('news')}
                className="gap-2"
              >
                <Newspaper className="w-4 h-4" />
                Noticias
              </Button>
              <Button
                variant={activeSection === 'subscription' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('subscription')}
                className="gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Planes
              </Button>
              {/* {userTier === 'Administrador' && (
                <Button
                  variant={activeSection === 'members' ? 'default' : 'ghost'}
                  onClick={() => setActiveSection('members')}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Miembros
                </Button>
              )} */}
              <Button
                variant={activeSection === 'account' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('account')}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                Cuenta
              </Button>

              
              <div className="relative">
              <Button
                variant="ghost"
                className="relative gap-2 px-3"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 px-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px]"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>

              {/* Menú Desplegable de Notificaciones */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700">Notificaciones</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={async () => {
                          await markAllAsRead();

                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No tienes notificaciones
                      </div>
                    ) : (
                      notifications.map((notif: any) => (
                        <div 
                          key={notif.oid_notificacion} 
                          className={`p-3 border-b border-gray-100 text-sm ${!notif.leida ? 'bg-blue-50/50' : ''}`}
                        >
                          <p className="font-semibold text-gray-800">{notif.titulo}</p>
                          <p className="text-gray-600 mt-1 line-clamp-2">{notif.mensaje}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

              <Button
                variant="ghost"
                onClick={handleLogout}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeSection === 'home' && <HomePage onSelectPlan={handleSelectPlan} onNavigateToNews={() => setActiveSection('news')} />}
        {activeSection === 'cases' && <LegalCaseManager userTier={userTier} />}
        {activeSection === 'codes' && <LegalCodeManager userTier={userTier} />}
        {activeSection === 'news' && <NewsSection />}
        {activeSection === 'account' && <AccountSection onNavigateToSubscription={() => setActiveSection('subscription')} userTier={userTier} onTierChange={() => {}} />}
        {activeSection === 'subscription' && <SubscriptionPage onSelectPlan={handleSelectPlan} />}
        {activeSection === 'payment' && selectedPlan && (
          <PaymentPage 
            selectedPlan={selectedPlan} 
            onConfirm={handlePaymentConfirm}
            onBack={handleBackFromPayment}
          />
        )}
        {activeSection === 'confirmation' && selectedPlan && (
          <PaymentConfirmation 
            plan={selectedPlan}
            onGoHome={handleGoHome}
          />
        )}
        {/* {activeSection === 'members' && <MembersManager />} */}
      </main>
    </div>
  );
}
