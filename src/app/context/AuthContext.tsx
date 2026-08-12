import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface AppNotification {
  oid_notificacion: number;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion: string;
}

interface LoginResponse {
  tokens: {
    access: string;
    refresh: string;
  };
  user: User;
}

interface User {
  oid_usuario: number;
  nombre: string;
  email: string;
  rol_nombre: string;
  fecha_registro: string;
  matricula_profesional: string;
  especialidad: string;
  telefono_contacto: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchNotifications = async () => {
    try {
      const data: any = await api.get('/notificaciones/');
      
      // Si Django manda la respuesta paginada, sacamos el array de "results"
      if (data && Array.isArray(data.results)) {
        setNotifications(data.results);
      } 
      // Si Django manda el array directo
      else if (Array.isArray(data)) {
        setNotifications(data);
      } 
      // Si algo raro pasa, seteamos un array vacío para que no explote
      else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notificaciones/marcar-leidas/', {});
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await api.get<User>('/auth/me/');
          setUser(userData);
          await fetchNotifications();
        } catch (error) {
          console.error('Error fetching user data:', error);
          localStorage.removeItem('access_token');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/auth/login/', { email, password });
    localStorage.setItem('access_token', response.tokens.access);
    localStorage.setItem('refresh_token', response.tokens.refresh);
    setUser(response.user);
    await fetchNotifications();
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.leida).length;

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoggedIn: !!user, 
      login, 
      logout, 
      isLoading,
      notifications,
      unreadCount,
      fetchNotifications,
      markAllAsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}