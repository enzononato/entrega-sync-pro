import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import ProtectedRoute from './ProtectedRoute';
import Login from '@/pages/auth/Login';
import AdminLayout from '@/components/admin/AdminLayout';
import ColaboradorLayout from '@/components/colaborador/ColaboradorLayout';
import Dashboard from '@/pages/admin/Dashboard';
import Unidades from '@/pages/admin/Unidades';
import Rotas from '@/pages/admin/Rotas';
import Colaboradores from '@/pages/admin/Colaboradores';
import ColaboradorHome from '@/pages/colaborador/Home';
import NotFound from '@/pages/NotFound';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'administrador' ? '/admin/dashboard' : '/colaborador/home'} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<ProtectedRoute allowedRole="administrador"><AdminLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="unidades" element={<Unidades />} />
        <Route path="rotas" element={<Rotas />} />
        <Route path="colaboradores" element={<Colaboradores />} />
        <Route path="desempenho" element={<PlaceholderPage title="Desempenho" />} />
        <Route path="indicadores" element={<PlaceholderPage title="Indicadores" />} />
        <Route path="metas" element={<PlaceholderPage title="Metas" />} />
        <Route path="incentivos" element={<PlaceholderPage title="Incentivos" />} />
        <Route path="feedbacks" element={<PlaceholderPage title="Feedbacks" />} />
        <Route path="planos-de-acao" element={<PlaceholderPage title="Planos de Ação" />} />
        <Route path="causa-raiz" element={<PlaceholderPage title="Causa Raiz" />} />
      </Route>

      <Route path="/colaborador" element={<ProtectedRoute allowedRole="colaborador"><ColaboradorLayout /></ProtectedRoute>}>
        <Route path="home" element={<ColaboradorHome />} />
        <Route path="indicadores" element={<PlaceholderPage title="Indicadores" />} />
        <Route path="incentivo" element={<PlaceholderPage title="Incentivo" />} />
        <Route path="causa-raiz" element={<PlaceholderPage title="Causa Raiz" />} />
        <Route path="planos-de-acao" element={<PlaceholderPage title="Planos de Ação" />} />
        <Route path="feedbacks" element={<PlaceholderPage title="Feedbacks" />} />
        <Route path="perfil" element={<PlaceholderPage title="Meu Perfil" />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-muted-foreground">Em desenvolvimento...</p>
    </div>
  );
}
