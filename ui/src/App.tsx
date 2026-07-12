import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, ProtectedRoute } from './components/auth';
import AuthCallback from './components/auth/view/AuthCallback';
import { TaskMasterProvider } from './contexts/TaskMasterContext';
import { TasksSettingsProvider } from './contexts/TasksSettingsContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { PluginsProvider } from './contexts/PluginsContext';
import { ToastProvider } from './contexts/ToastContext';
import { TeamProvider } from './contexts/TeamContext';
import AppShellV2 from './components/app-shell/AppShellV2';
import TeamManagement from './components/team/TeamManagement';
import WorkspaceList from './components/team/WorkspaceList';
import WorkspaceSettings from './components/team/WorkspaceSettings';
import AdminDashboard from './components/admin/AdminDashboard';
import i18n from './i18n/config.js';

export default function App() {
  // Single wildcard so URL changes don't remount the shell. Params are
  // resolved inside AppShellV2 via useMatch so navigation between
  // /, /p/:name, /p/:name/c/:id, and /session/:id preserves all state.
  // The /auth/callback route is outside ProtectedRoute so the OAuth callback
  // can be handled without an existing session.
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <WebSocketProvider>
              <PluginsProvider>
                <TasksSettingsProvider>
                  <TaskMasterProvider>
                    <TeamProvider>
                    <Router basename={window.__ROUTER_BASENAME__ || ''}>
                      <Routes>
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/teams" element={
                          <ProtectedRoute>
                            <TeamManagement />
                          </ProtectedRoute>
                        } />
                        <Route path="/workspaces" element={
                          <ProtectedRoute>
                            <WorkspaceList />
                          </ProtectedRoute>
                        } />
                        <Route path="/workspaces/:id/settings" element={
                          <ProtectedRoute>
                            <WorkspaceSettings />
                          </ProtectedRoute>
                        } />
                        <Route path="/admin" element={
                          <ProtectedRoute>
                            <AdminDashboard />
                          </ProtectedRoute>
                        } />
                        <Route path="*" element={
                          <ProtectedRoute>
                            <AppShellV2 />
                          </ProtectedRoute>
                        } />
                      </Routes>
                    </Router>
                    </TeamProvider>
                  </TaskMasterProvider>
                </TasksSettingsProvider>
              </PluginsProvider>
            </WebSocketProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
