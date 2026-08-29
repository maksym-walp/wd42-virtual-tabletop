import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { DiceProvider } from './context/DiceContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import DiceWidget from './components/DiceWidget';
import ScrollToTopButton from './components/ScrollToTopButton';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Spellbook from './pages/Spellbook';
import SpellView from './pages/SpellView';
import SpellForm from './pages/SpellForm';
import EquipmentCatalog from './pages/EquipmentCatalog';
import EquipmentView from './pages/EquipmentView';
import EquipmentForm from './pages/EquipmentForm';
import ArtifactsCatalog from './pages/ArtifactsCatalog';
import ArtifactView from './pages/ArtifactView';
import ArtifactForm from './pages/ArtifactForm';
import ManeuverCatalog from './pages/ManeuverCatalog';
import ManeuverView from './pages/ManeuverView';
import ManeuverForm from './pages/ManeuverForm';
import AbilityCatalog from './pages/AbilityCatalog';
import AbilityView from './pages/AbilityView';
import AbilityForm from './pages/AbilityForm';
import CollectionsList from './pages/CollectionsList';
import CollectionForm from './pages/CollectionForm';
import CollectionView from './pages/CollectionView';
import TraditionsList from './pages/TraditionsList';
import TraditionForm from './pages/TraditionForm';
import SkillTree from './pages/SkillTree';
import CharacterList from './pages/CharacterList';
import CharacterNew from './pages/CharacterNew';
import CharacterSheet from './pages/CharacterSheet';
import CampaignList from './pages/CampaignList';
import CampaignNew from './pages/CampaignNew';
import CampaignDetail from './pages/CampaignDetail';
import MapList from './pages/MapList';
import LocationLibrary from './pages/LocationLibrary';
import MapView from './pages/MapView';
import ChronologyList from './pages/ChronologyList';
import ChronologyBuilder from './pages/ChronologyBuilder';
import ChronologyView from './pages/ChronologyView';
import ChronologyEvents from './pages/ChronologyEvents';
import LocationDetail from './pages/LocationDetail';
import CompendiumEntries from './pages/CompendiumEntries';
import CompendiumEntryForm from './pages/CompendiumEntryForm';
import CompendiumEntryView from './pages/CompendiumEntryView';
import CompendiumSpeciesList from './pages/CompendiumSpeciesList';
import CompendiumSpeciesDetail from './pages/CompendiumSpeciesDetail';
import CompendiumSpeciesForm from './pages/CompendiumSpeciesForm';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  return (
    <ThemeProvider>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DiceProvider>
            <div className="flex h-dvh flex-col">
              <Navbar />
              <div id="app-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="/profile/:username" element={<PrivateRoute><PublicProfile /></PrivateRoute>} />
                  <Route path="/spellbook" element={<PrivateRoute><Spellbook /></PrivateRoute>} />
                  <Route path="/spellbook/new" element={<PrivateRoute><SpellForm /></PrivateRoute>} />
                  <Route path="/spellbook/collections" element={<PrivateRoute><CollectionsList domainKey="spellbook" /></PrivateRoute>} />
                  <Route path="/spellbook/collections/new" element={<PrivateRoute><CollectionForm domainKey="spellbook" /></PrivateRoute>} />
                  <Route path="/spellbook/collections/public/:id" element={<CollectionView domainKey="spellbook" publicView />} />
                  <Route path="/spellbook/collections/:id" element={<PrivateRoute><CollectionView domainKey="spellbook" /></PrivateRoute>} />
                  <Route path="/spellbook/collections/:id/edit" element={<PrivateRoute><CollectionForm domainKey="spellbook" /></PrivateRoute>} />
                  <Route path="/spellbook/traditions" element={<PrivateRoute><TraditionsList /></PrivateRoute>} />
                  <Route path="/spellbook/traditions/new" element={<PrivateRoute><TraditionForm /></PrivateRoute>} />
                  <Route path="/spellbook/traditions/:id/edit" element={<PrivateRoute><TraditionForm /></PrivateRoute>} />
                  <Route path="/spellbook/:id" element={<PrivateRoute><SpellView /></PrivateRoute>} />
                  <Route path="/spellbook/:id/edit" element={<PrivateRoute><SpellForm /></PrivateRoute>} />
                  <Route path="/equipment" element={<Navigate to="/equipment/weapon" replace />} />
                  <Route path="/equipment/weapon" element={<PrivateRoute><EquipmentCatalog type="weapon" /></PrivateRoute>} />
                  <Route path="/equipment/armor" element={<PrivateRoute><EquipmentCatalog type="armor" /></PrivateRoute>} />
                  <Route path="/equipment/items" element={<PrivateRoute><EquipmentCatalog type="item" /></PrivateRoute>} />
                  <Route path="/equipment/new" element={<PrivateRoute><EquipmentForm /></PrivateRoute>} />
                  <Route path="/equipment/collections" element={<PrivateRoute><CollectionsList domainKey="equipment" /></PrivateRoute>} />
                  <Route path="/equipment/collections/new" element={<PrivateRoute><CollectionForm domainKey="equipment" /></PrivateRoute>} />
                  <Route path="/equipment/collections/public/:id" element={<CollectionView domainKey="equipment" publicView />} />
                  <Route path="/equipment/collections/:id" element={<PrivateRoute><CollectionView domainKey="equipment" /></PrivateRoute>} />
                  <Route path="/equipment/collections/:id/edit" element={<PrivateRoute><CollectionForm domainKey="equipment" /></PrivateRoute>} />
                  <Route path="/equipment/:id" element={<PrivateRoute><EquipmentView /></PrivateRoute>} />
                  <Route path="/equipment/:id/edit" element={<PrivateRoute><EquipmentForm /></PrivateRoute>} />

                  {/* Артефакти — четвертий вид спорядження (вкладка в CatalogTabs), а не
                      окремий сервіс/домен — див. 51-merge-artifacts-into-equipment.sql.
                      Власні View/Form лишаються окремо від EquipmentView/EquipmentForm,
                      бо в артефакта інші поля (creator/rarity замість зброї/обладунку). */}
                  <Route path="/equipment/artifacts" element={<PrivateRoute><ArtifactsCatalog /></PrivateRoute>} />
                  <Route path="/equipment/artifacts/new" element={<PrivateRoute><ArtifactForm /></PrivateRoute>} />
                  <Route path="/equipment/artifacts/:id" element={<PrivateRoute><ArtifactView /></PrivateRoute>} />
                  <Route path="/equipment/artifacts/:id/edit" element={<PrivateRoute><ArtifactForm /></PrivateRoute>} />
                  <Route path="/abilities" element={<PrivateRoute><AbilityCatalog /></PrivateRoute>} />
                  <Route path="/abilities/new" element={<PrivateRoute><AbilityForm /></PrivateRoute>} />
                  <Route path="/abilities/collections" element={<PrivateRoute><CollectionsList domainKey="abilities" /></PrivateRoute>} />
                  <Route path="/abilities/collections/new" element={<PrivateRoute><CollectionForm domainKey="abilities" /></PrivateRoute>} />
                  <Route path="/abilities/collections/public/:id" element={<CollectionView domainKey="abilities" publicView />} />
                  <Route path="/abilities/collections/:id" element={<PrivateRoute><CollectionView domainKey="abilities" /></PrivateRoute>} />
                  <Route path="/abilities/collections/:id/edit" element={<PrivateRoute><CollectionForm domainKey="abilities" /></PrivateRoute>} />
                  {/* Маневри — другий вид усередині сервіса "Вміння та маневри" (вкладка в
                      CatalogTabs), а не окремий сервіс/домен — див.
                      52-merge-maneuvers-into-abilities.sql. Власні View/Form лишаються
                      окремо від AbilityView/AbilityForm — інші поля (duration_actions
                      замість archetypes) і жорстко fighter-архетипний список вузлів дерева
                      розвитку. */}
                  <Route path="/abilities/maneuvers" element={<PrivateRoute><ManeuverCatalog /></PrivateRoute>} />
                  <Route path="/abilities/maneuvers/new" element={<PrivateRoute><ManeuverForm /></PrivateRoute>} />
                  <Route path="/abilities/maneuvers/:id" element={<PrivateRoute><ManeuverView /></PrivateRoute>} />
                  <Route path="/abilities/maneuvers/:id/edit" element={<PrivateRoute><ManeuverForm /></PrivateRoute>} />
                  <Route path="/abilities/:id" element={<PrivateRoute><AbilityView /></PrivateRoute>} />
                  <Route path="/abilities/:id/edit" element={<PrivateRoute><AbilityForm /></PrivateRoute>} />
                  <Route path="/skill-tree" element={<PrivateRoute><SkillTree /></PrivateRoute>} />
                  <Route path="/characters" element={<PrivateRoute><CharacterList /></PrivateRoute>} />
                  <Route path="/characters/new" element={<PrivateRoute><CharacterNew /></PrivateRoute>} />
                  <Route path="/characters/:id" element={<PrivateRoute><CharacterSheet /></PrivateRoute>} />
                  <Route path="/characters/public/:id" element={<CharacterSheet publicView />} />
                  <Route path="/campaigns" element={<PrivateRoute><CampaignList /></PrivateRoute>} />
                  <Route path="/campaigns/new" element={<PrivateRoute><CampaignNew /></PrivateRoute>} />
                  <Route path="/campaigns/:id" element={<PrivateRoute><CampaignDetail /></PrivateRoute>} />
                  <Route path="/maps" element={<PrivateRoute><MapList /></PrivateRoute>} />
                  <Route path="/maps/locations" element={<PrivateRoute><LocationLibrary /></PrivateRoute>} />
                  <Route path="/maps/:id" element={<PrivateRoute><MapView /></PrivateRoute>} />
                  <Route path="/chronology" element={<PrivateRoute><ChronologyList /></PrivateRoute>} />
                  <Route path="/chronology/:id/build" element={<PrivateRoute><ChronologyBuilder /></PrivateRoute>} />
                  <Route path="/chronology/:id" element={<PrivateRoute><ChronologyView /></PrivateRoute>} />
                  <Route path="/chronology/:id/events" element={<PrivateRoute><ChronologyEvents /></PrivateRoute>} />
                  <Route path="/locations/:id" element={<PrivateRoute><LocationDetail /></PrivateRoute>} />

                  <Route path="/compendium" element={<PrivateRoute><CompendiumEntries entityType="npc" title="НІПи" newLabel="Новий НІП" /></PrivateRoute>} />
                  <Route path="/compendium/bestiary" element={<PrivateRoute><CompendiumEntries entityType="creature" title="Бестіарій" newLabel="Нова істота" /></PrivateRoute>} />
                  <Route path="/compendium/species" element={<PrivateRoute><CompendiumSpeciesList /></PrivateRoute>} />
                  <Route path="/compendium/species/new" element={<PrivateRoute><CompendiumSpeciesForm /></PrivateRoute>} />
                  <Route path="/compendium/species/:id" element={<PrivateRoute><CompendiumSpeciesDetail /></PrivateRoute>} />
                  <Route path="/compendium/species/:id/edit" element={<PrivateRoute><CompendiumSpeciesForm /></PrivateRoute>} />
                  <Route path="/compendium/subspecies/new" element={<PrivateRoute><CompendiumSpeciesForm isSubspecies /></PrivateRoute>} />
                  <Route path="/compendium/subspecies/:id/edit" element={<PrivateRoute><CompendiumSpeciesForm isSubspecies /></PrivateRoute>} />
                  <Route path="/compendium/collections" element={<PrivateRoute><CollectionsList domainKey="compendium" /></PrivateRoute>} />
                  <Route path="/compendium/collections/new" element={<PrivateRoute><CollectionForm domainKey="compendium" /></PrivateRoute>} />
                  <Route path="/compendium/collections/public/:id" element={<CollectionView domainKey="compendium" publicView />} />
                  <Route path="/compendium/collections/:id" element={<PrivateRoute><CollectionView domainKey="compendium" /></PrivateRoute>} />
                  <Route path="/compendium/collections/:id/edit" element={<PrivateRoute><CollectionForm domainKey="compendium" /></PrivateRoute>} />
                  <Route path="/compendium/entries/new" element={<PrivateRoute><CompendiumEntryForm /></PrivateRoute>} />
                  <Route path="/compendium/entries/:id" element={<PrivateRoute><CompendiumEntryView /></PrivateRoute>} />
                  <Route path="/compendium/entries/:id/edit" element={<PrivateRoute><CompendiumEntryForm /></PrivateRoute>} />

                  <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
              <BottomNav />
              <DiceWidget />
              <ScrollToTopButton />
            </div>
          </DiceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
