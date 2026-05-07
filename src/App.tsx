import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Home } from '@/pages/Home';
import { Training } from '@/pages/Training';
import { Statistics } from '@/pages/Statistics';
import { Settings } from '@/pages/Settings';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { Gamepad } from '@/pages/Gamepad';
import { CustomTaskEditor } from '@/pages/CustomTaskEditor';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';

function AppInner() {
  useTheme();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="training" element={<Training />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="gamepad" element={<Gamepad />} />
          <Route path="custom-task" element={<CustomTaskEditor />} />
        </Route>
      </Routes>
    </Router>
  );
}

function App() {
  return <AppInner />;
}

export default App;
