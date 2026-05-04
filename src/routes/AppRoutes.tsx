import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import ProtectedRoute from './ProtectedRoute';
import Login from '@/pages/auth/Login';
import LoginAdmin from '@/pages/auth/LoginAdmin';
import LoginColaborador from '@/pages/auth/LoginColaborador';
import AdminLayout from '@/components/admin/AdminLayout';
import ColaboradorLayout from '@/components/colaborador/ColaboradorLayout';
import Dashboard from '@/pages/admin/Dashboard';
import Unidades from '@/pages/admin/Unidades';
import Rotas from '@/pages/admin/Rotas';
import Colaboradores from '@/pages/admin/Colaboradores';
import IndicadoresAdmin from '@/pages/admin/Indicadores';
import MetasAdmin from '@/pages/admin/Metas';

import DesempenhoAdmin from '@/pages/admin/Desempenho';
import CausaRaizAdmin from '@/pages/admin/CausaRaiz';
import PlanosDeAcaoAdmin from '@/pages/admin/PlanosDeAcao';
import FeedbacksAdmin from '@/pages/admin/Feedbacks';
import AuditoriaAdmin from '@/pages/admin/Auditoria';
import LogsLoginAdmin from '@/pages/admin/LogsLogin';
import DescontosAdmin from '@/pages/admin/Descontos';
import RankingAdmin from '@/pages/admin/Ranking';
import UsuariosAdmin from '@/pages/admin/Usuarios';
import HistoricoMapasAdmin from '@/pages/admin/HistoricoMapas';
import ImportacoesAdmin from '@/pages/admin/Importacoes';
import ColaboradorHome from '@/pages/colaborador/Home';
import IncentivoColaborador from '@/pages/colaborador/Incentivo';
import PlanosDeAcaoColaborador from '@/pages/colaborador/PlanosDeAcao';
import FeedbacksColaborador from '@/pages/colaborador/Feedbacks';
import PerfilColaborador from '@/pages/colaborador/Perfil';
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
      <Route path="/login/admin" element={<LoginAdmin />} />
      <Route path="/login/colaborador" element={<LoginColaborador />} />

      <Route path="/admin" element={<ProtectedRoute allowedRole="administrador"><AdminLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="unidades" element={<Unidades />} />
        <Route path="rotas" element={<Rotas />} />
        <Route path="colaboradores" element={<Colaboradores />} />
        <Route path="desempenho" element={<DesempenhoAdmin />} />
        <Route path="indicadores" element={<IndicadoresAdmin />} />
        <Route path="metas" element={<MetasAdmin />} />
        
        <Route path="descontos" element={<DescontosAdmin />} />
        <Route path="causa-raiz" element={<CausaRaizAdmin />} />
        <Route path="planos-de-acao" element={<PlanosDeAcaoAdmin />} />
        <Route path="feedbacks" element={<FeedbacksAdmin />} />
        <Route path="auditoria" element={<AuditoriaAdmin />} />
        <Route path="logs-login" element={<LogsLoginAdmin />} />
        <Route path="ranking" element={<RankingAdmin />} />
        <Route path="usuarios" element={<UsuariosAdmin />} />
        <Route path="importacoes" element={<ImportacoesAdmin />} />
      </Route>

      <Route path="/colaborador" element={<ProtectedRoute allowedRole="colaborador"><ColaboradorLayout /></ProtectedRoute>}>
        <Route path="home" element={<ColaboradorHome />} />
        <Route path="incentivo" element={<IncentivoColaborador />} />
        <Route path="planos-de-acao" element={<PlanosDeAcaoColaborador />} />
        <Route path="feedbacks" element={<FeedbacksColaborador />} />
        <Route path="perfil" element={<PerfilColaborador />} />
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
