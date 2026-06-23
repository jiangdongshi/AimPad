import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Home } from '@/pages/Home';
import { Training } from '@/pages/Training';
import { Statistics } from '@/pages/Statistics';
import { Settings } from '@/pages/Settings';
import { Profile } from '@/pages/Profile';
import { Gamepad } from '@/pages/Gamepad';
import { CustomTaskEditor } from '@/pages/CustomTaskEditor';
import { Admin } from '@/pages/Admin';
import { useTheme } from '@/hooks/useTheme';

function AppInner() {
  useTheme();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="training" element={<Training />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="gamepad" element={<Gamepad />} />
          <Route path="custom-task" element={<CustomTaskEditor />} />
            <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </Router>
  );
}

function App() {
  return <AppInner />;
}

export default App;
