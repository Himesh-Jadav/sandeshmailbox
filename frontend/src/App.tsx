import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { FaqChatbot } from './components/faq/FaqChatbot';
import { Outlet } from 'react-router-dom';

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <>
      <Outlet />
      <FaqChatbot />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/',
        element: <LoginPage initialMode="signin" />,
      },
      {
        path: '/login',
        element: <LoginPage initialMode="signin" />,
      },
      {
        path: '/signin',
        element: <LoginPage initialMode="signin" />,
      },
      {
        path: '/register',
        element: <LoginPage initialMode="register" />,
      },
      {
        path: '/terms',
        element: <TermsPage />,
      },
      {
        path: '/privacy',
        element: <PrivacyPage />,
      },
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/profile',
        element: <ProfilePage />,
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
