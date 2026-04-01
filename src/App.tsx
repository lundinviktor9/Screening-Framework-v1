import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RankingsPage from './pages/RankingsPage';
import AddMarketPage from './pages/AddMarketPage';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import SensitivityPage from './pages/SensitivityPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/"              element={<RankingsPage />} />
          <Route path="/add"           element={<AddMarketPage />} />
          <Route path="/edit/:id"      element={<AddMarketPage />} />
          <Route path="/dashboard"     element={<DashboardPage />} />
          <Route path="/map"           element={<MapPage />} />
          <Route path="/sensitivity"   element={<SensitivityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
