import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DiceProvider } from './context/DiceContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import DiceWidget from './components/DiceWidget';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Spellbook from './pages/Spellbook';
import SpellView from './pages/SpellView';
import SpellForm from './pages/SpellForm';
import EquipmentCatalog from './pages/EquipmentCatalog';
import EquipmentView from './pages/EquipmentView';
import EquipmentForm from './pages/EquipmentForm';
import ManeuverCatalog from './pages/ManeuverCatalog';
import ManeuverView from './pages/ManeuverView';
import ManeuverForm from './pages/ManeuverForm';
import AbilityCatalog from './pages/AbilityCatalog';
import AbilityView from './pages/AbilityView';
import AbilityForm from './pages/AbilityForm';
import SkillTree from './pages/SkillTree';
import CharacterList from './pages/CharacterList';
import CharacterNew from './pages/CharacterNew';
import CharacterSheet from './pages/CharacterSheet';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DiceProvider>
            <div className="flex h-dvh flex-col">
              <Navbar />
              <div className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="/spellbook" element={<PrivateRoute><Spellbook /></PrivateRoute>} />
                  <Route path="/spellbook/new" element={<PrivateRoute><SpellForm /></PrivateRoute>} />
                  <Route path="/spellbook/:id" element={<PrivateRoute><SpellView /></PrivateRoute>} />
                  <Route path="/spellbook/:id/edit" element={<PrivateRoute><SpellForm /></PrivateRoute>} />
                  <Route path="/equipment" element={<PrivateRoute><EquipmentCatalog /></PrivateRoute>} />
                  <Route path="/equipment/new" element={<PrivateRoute><EquipmentForm /></PrivateRoute>} />
                  <Route path="/equipment/:id" element={<PrivateRoute><EquipmentView /></PrivateRoute>} />
                  <Route path="/equipment/:id/edit" element={<PrivateRoute><EquipmentForm /></PrivateRoute>} />
                  <Route path="/maneuvers" element={<PrivateRoute><ManeuverCatalog /></PrivateRoute>} />
                  <Route path="/maneuvers/new" element={<PrivateRoute><ManeuverForm /></PrivateRoute>} />
                  <Route path="/maneuvers/:id" element={<PrivateRoute><ManeuverView /></PrivateRoute>} />
                  <Route path="/maneuvers/:id/edit" element={<PrivateRoute><ManeuverForm /></PrivateRoute>} />
                  <Route path="/abilities" element={<PrivateRoute><AbilityCatalog /></PrivateRoute>} />
                  <Route path="/abilities/new" element={<PrivateRoute><AbilityForm /></PrivateRoute>} />
                  <Route path="/abilities/:id" element={<PrivateRoute><AbilityView /></PrivateRoute>} />
                  <Route path="/abilities/:id/edit" element={<PrivateRoute><AbilityForm /></PrivateRoute>} />
                  <Route path="/skill-tree" element={<PrivateRoute><SkillTree /></PrivateRoute>} />
                  <Route path="/characters" element={<PrivateRoute><CharacterList /></PrivateRoute>} />
                  <Route path="/characters/new" element={<PrivateRoute><CharacterNew /></PrivateRoute>} />
                  <Route path="/characters/:id" element={<PrivateRoute><CharacterSheet /></PrivateRoute>} />
                  <Route path="/characters/public/:id" element={<CharacterSheet publicView />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
              <BottomNav />
              <DiceWidget />
            </div>
          </DiceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
