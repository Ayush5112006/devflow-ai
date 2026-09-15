import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar, MobileSidebar } from './components/ui/Sidebar';
import { Navbar } from './components/ui/Navbar';
import { Dashboard } from './pages/Dashboard';
import { MapView } from './pages/MapView';
import { AssetTable } from './pages/AssetTable';
import { MaintenancePlan } from './pages/MaintenancePlan';
import { AssetDetail } from './pages/AssetDetail';
import { CalendarPage } from './pages/CalendarPage';
import { WeatherPage } from './pages/WeatherPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      {/* Skip-to-main link — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]
                   focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white
                   focus:text-sm focus:font-semibold focus:shadow-xl"
      >
        Skip to main content
      </a>

      <div className="flex h-full bg-navy-950">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Mobile drawer */}
        <MobileSidebar />

        {/* Main content area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-screen">
          <Navbar />
          <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
            <Routes>
              <Route path="/"                element={<Dashboard />} />
              <Route path="/map"             element={<MapView />} />
              <Route path="/assets"          element={<AssetTable />} />
              <Route path="/assets/:assetId" element={<AssetDetail />} />
              <Route path="/maintenance"     element={<MaintenancePlan />} />
              <Route path="/calendar"        element={<CalendarPage />} />
              <Route path="/weather"         element={<WeatherPage />} />
              <Route path="/settings"        element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
