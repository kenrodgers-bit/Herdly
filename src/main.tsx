import React, { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Archive,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  Home,
  Layers,
  Lock,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wheat,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './styles.css';
import { allSpeciesKeys, speciesByKey, speciesLabel, speciesModules } from './data/species';
import { db, hashPin, parseEnabledSpecies, settingsObject } from './services/db';
import {
  activeFormsList,
  adaptiveAnimalColumns,
  enabledSpeciesModules,
  farmProduces,
  hasEggProduction,
  hasFlocks,
  hasIndividualAnimals,
  hasMilkProduction,
  hasReproduction,
  hasWeightTracking,
  hasWoolProduction,
  primarySaleUnit,
  productionSummaryLabels,
  speciesProducing,
} from './utils/reportHelpers';
import type {
  Animal,
  AnimalStatus,
  Buyer,
  EventType,
  Expense,
  FarmEvent,
  Flock,
  FormDefinition,
  InventoryItem,
  PdfExportRequest,
  ProductType,
  ProductionLog,
  Sale,
  SettingRow,
  SetupPayload,
  SpeciesKey,
  SubjectType,
  Supplier,
  Vet,
} from './types';

type ScreenKey =
  | 'dashboard'
  | 'animals'
  | 'flocks'
  | 'events'
  | 'production'
  | 'inventory'
  | 'sales'
  | 'expenses'
  | 'reports'
  | 'settings';

type FormState = Record<string, string>;

interface SubjectOption {
  id: string;
  label: string;
  species: SpeciesKey;
  type: SubjectType;
}

interface NavItem {
  key: ScreenKey;
  label: string;
  icon: ReactNode;
}

const logoFull = `${import.meta.env.BASE_URL}icons/logo-full.png`;
const logoMark = `${import.meta.env.BASE_URL}icons/icon.png`;

const eventTypes: EventType[] = ['health', 'vaccination', 'ai', 'birth', 'death', 'sale', 'note'];
const inventoryCategories = ['feed', 'medicine', 'equipment', 'supplies', 'other'];
const emptySubject = 'none';

const initialAnimalForm: FormState = {
  name: '',
  tag: '',
  species: 'dairy_cattle',
  breed: '',
  dob: '',
  sex: 'female',
  purchase_cost: '',
  notes: '',
};

const initialFlockForm: FormState = {
  name: '',
  species: 'layers',
  breed: '',
  start_date: '',
  initial_count: '',
  current_count: '',
  purchase_cost: '',
  notes: '',
};

const initialInventoryForm: FormState = {
  name: '',
  category: 'feed',
  species: '',
  quantity: '',
  unit: 'kg',
  reorder_level: '',
  total_cost: '',
  supplier: '',
};

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number, currency: string): string {
  return `${currency} ${Math.round(value).toLocaleString()}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateRangeLabel(from: string, to: string): string {
  return `${formatDate(from)} to ${formatDate(to)}`;
}

function productLabel(product: ProductType | string): string {
  const labels: Record<string, string> = {
    milk: 'Milk',
    eggs: 'Eggs',
    wool: 'Wool',
    animal: 'Animal',
    manure: 'Manure',
    weight: 'Weight',
    meat: 'Meat',
    other: 'Other',
  };
  return labels[product] ?? product;
}

function eventLabel(eventType: EventType | string): string {
  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function expectedDelivery(species: SpeciesKey, aiDate: string): string | null {
  const gestation: Partial<Record<SpeciesKey, number>> = {
    dairy_cattle: 283,
    beef_cattle: 283,
    goats: 150,
    sheep: 147,
    pigs: 114,
  };
  const days = gestation[species];
  if (!days) return null;
  const expected = addDays(aiDate, days);
  return expected || null;
}

function inRange(dateValue: string, from: string, to: string): boolean {
  return dateValue >= from && dateValue <= to;
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function isEnabledSpecies(value: string): value is SpeciesKey {
  return allSpeciesKeys.includes(value as SpeciesKey);
}

function statusClass(status: string): string {
  return `status-pill status-${status}`;
}

function fieldChange(setter: React.Dispatch<React.SetStateAction<FormState>>) {
  return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setter((previous) => ({ ...previous, [name]: value }));
  };
}

function printOnly(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  document.body.classList.add('print-only-mode');
  target.classList.add('print-target');
  window.print();
  window.setTimeout(() => {
    document.body.classList.remove('print-only-mode');
    target.classList.remove('print-target');
  }, 100);
}

async function exportPdfOnly(id: string, request: PdfExportRequest): Promise<boolean> {
  const target = document.getElementById(id);
  if (!target) return false;
  document.body.classList.add('print-only-mode');
  target.classList.add('print-target');
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  try {
    return await db.exportPdf(request);
  } finally {
    document.body.classList.remove('print-only-mode');
    target.classList.remove('print-target');
  }
}

function PrintHeader({ farmName, title, location }: { farmName: string; title: string; location?: string }) {
  return (
    <div className="print-header">
      <div className="print-header-row">
        <strong>{farmName}</strong>
        <span>Herdly Farm Management</span>
      </div>
      <div className="print-header-row subtle">
        <span>{title}</span>
        <span>Printed: {formatDate(todayInput())}</span>
      </div>
      {location ? <div className="print-location">{location}</div> : null}
      <hr />
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} value={value} onChange={onChange} type={type} placeholder={placeholder} min={min} required={required} />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  children,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange} required={required}>
        {children}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={3} />
    </label>
  );
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <Archive size={22} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon: ReactNode }) {
  return (
    <div className={`stat-card ${tone ?? ''}`}>
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

function SpeciesSelect({
  enabledSpecies,
  value,
  onChange,
  name = 'species',
  allowEmpty = false,
}: {
  enabledSpecies: SpeciesKey[];
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
  allowEmpty?: boolean;
}) {
  return (
    <SelectField label="Species" name={name} value={value} onChange={onChange}>
      {allowEmpty ? <option value="">All species</option> : null}
      {enabledSpeciesModules(enabledSpecies).map((species) => (
        <option key={species.key} value={species.key}>
          {species.label}
        </option>
      ))}
    </SelectField>
  );
}

function ProductSelect({
  products,
  value,
  onChange,
}: {
  products: ProductType[];
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <SelectField label="Product" name="product" value={value} onChange={onChange}>
      {products.map((product) => (
        <option key={product} value={product}>
          {productLabel(product)}
        </option>
      ))}
    </SelectField>
  );
}

const defaultSetup: SetupPayload = {
  farm_name: '',
  owner_name: '',
  phone: '',
  location: '',
  currency: 'KSh',
  enabled_species: ['dairy_cattle', 'layers'],
  milk_price: '50',
  goat_milk_price: '50',
  egg_price: '15',
  egg_tray_price: '450',
  animal_sale_price: '',
  other_product_price: '',
  low_stock_threshold: '10',
  gestation_cattle: '283',
  gestation_goats: '150',
  gestation_sheep: '147',
  gestation_pigs: '114',
  gestation_rabbits: '31',
  staff_forms_enabled: 'true',
  inventory_tracking: 'true',
  finance_tracking: 'true',
};

function FirstRunSetup({ onComplete }: { onComplete: (payload: SetupPayload) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SetupPayload>(defaultSetup);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const steps = ['Farm Identity', 'Species', 'Prices', 'Preferences', 'Finish'];

  useEffect(() => {
    window.history.replaceState(null, '', '#/setup');
  }, []);

  function change(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    if (type === 'checkbox') {
      const checkbox = event.target as HTMLInputElement;
      setForm((previous) => ({ ...previous, [name]: checkbox.checked ? 'true' : 'false' }));
      return;
    }
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function toggleSpecies(species: SpeciesKey) {
    setForm((previous) => ({
      ...previous,
      enabled_species: previous.enabled_species.includes(species)
        ? previous.enabled_species.filter((item) => item !== species)
        : [...previous.enabled_species, species],
    }));
  }

  function validateCurrentStep(): boolean {
    if (step === 0 && !form.farm_name.trim()) {
      setError('Enter the farm name before continuing.');
      return false;
    }
    if (step === 1 && form.enabled_species.length === 0) {
      setError('Select at least one species or module.');
      return false;
    }
    if (step === 2) {
      const prices = [form.milk_price, form.goat_milk_price, form.egg_price, form.egg_tray_price, form.animal_sale_price, form.other_product_price];
      if (prices.some((price) => price && number(price) < 0)) {
        setError('Prices cannot be negative.');
        return false;
      }
    }
    setError('');
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function finish() {
    if (!validateCurrentStep()) return;
    setSaving(true);
    setError('');
    try {
      await onComplete({
        ...form,
        farm_name: form.farm_name.trim(),
        owner_name: form.owner_name.trim() || 'Farm Admin',
        location: form.location.trim() || 'Farm location',
        currency: form.currency.trim() || 'KSh',
      });
    } catch {
      setError('Herdly could not save setup. Please try again.');
      setSaving(false);
    }
  }

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <img src={logoFull} alt="Herdly" />
        <div className="setup-progress">
          {steps.map((item, index) => (
            <span key={item} className={index === step ? 'active' : index < step ? 'done' : ''}>
              {index + 1}
            </span>
          ))}
        </div>
        <div>
          <h1>{steps[step]}</h1>
          <p>Set up Herdly with real farm details. Demo data stays off unless you load it later from Settings.</p>
        </div>

        {step === 0 ? (
          <div className="setup-grid">
            <TextField label="Farm name" name="farm_name" value={form.farm_name} onChange={change} required />
            <TextField label="Owner / manager" name="owner_name" value={form.owner_name} onChange={change} />
            <TextField label="Phone number" name="phone" value={form.phone} onChange={change} />
            <TextField label="Location / county" name="location" value={form.location} onChange={change} />
            <TextField label="Currency" name="currency" value={form.currency} onChange={change} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="setup-species-grid">
            {speciesModules.map((species) => (
              <button
                key={species.key}
                className={form.enabled_species.includes(species.key) ? 'setup-species selected' : 'setup-species'}
                onClick={() => toggleSpecies(species.key)}
                type="button"
              >
                <span>{species.icon}</span>
                <strong>{species.label}</strong>
                <small>{species.mode === 'batch' ? 'Flock/batch tracking' : 'Individual tracking'}</small>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="setup-grid">
            <TextField label="Milk price per litre" name="milk_price" value={form.milk_price} onChange={change} type="number" min="0" />
            <TextField label="Goat milk price per litre" name="goat_milk_price" value={form.goat_milk_price} onChange={change} type="number" min="0" />
            <TextField label="Egg price per egg" name="egg_price" value={form.egg_price} onChange={change} type="number" min="0" />
            <TextField label="Egg price per tray/crate" name="egg_tray_price" value={form.egg_tray_price} onChange={change} type="number" min="0" />
            <TextField label="Default animal sale price" name="animal_sale_price" value={form.animal_sale_price} onChange={change} type="number" min="0" />
            <TextField label="Other product default price" name="other_product_price" value={form.other_product_price} onChange={change} type="number" min="0" />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="setup-grid">
            <TextField label="Default low stock threshold" name="low_stock_threshold" value={form.low_stock_threshold} onChange={change} type="number" min="0" />
            <TextField label="Cattle gestation days" name="gestation_cattle" value={form.gestation_cattle} onChange={change} type="number" min="0" />
            <TextField label="Goat gestation days" name="gestation_goats" value={form.gestation_goats} onChange={change} type="number" min="0" />
            <TextField label="Sheep gestation days" name="gestation_sheep" value={form.gestation_sheep} onChange={change} type="number" min="0" />
            <TextField label="Pig gestation days" name="gestation_pigs" value={form.gestation_pigs} onChange={change} type="number" min="0" />
            <TextField label="Rabbit gestation days" name="gestation_rabbits" value={form.gestation_rabbits} onChange={change} type="number" min="0" />
            <label className="setup-check">
              <input name="staff_forms_enabled" checked={form.staff_forms_enabled === 'true'} onChange={change} type="checkbox" />
              Enable printable staff forms
            </label>
            <label className="setup-check">
              <input name="inventory_tracking" checked={form.inventory_tracking === 'true'} onChange={change} type="checkbox" />
              Enable inventory tracking
            </label>
            <label className="setup-check">
              <input name="finance_tracking" checked={form.finance_tracking === 'true'} onChange={change} type="checkbox" />
              Enable finance tracking
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="setup-finish">
            <ShieldCheck size={42} />
            <h2>Your farm is ready.</h2>
            <p>Start by adding animals, flocks, inventory, or sales. Herdly will use your real records from here.</p>
            <DataTable columns={['Setup item', 'Value']}>
              <tr>
                <td>Farm</td>
                <td>{form.farm_name || 'Not set'}</td>
              </tr>
              <tr>
                <td>Species/modules</td>
                <td>{form.enabled_species.map((species) => speciesLabel(species)).join(', ')}</td>
              </tr>
              <tr>
                <td>Demo data</td>
                <td>Off by default</td>
              </tr>
            </DataTable>
          </div>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}

        <div className="setup-actions">
          <button className="btn btn-secondary" disabled={step === 0 || saving} onClick={() => setStep((current) => Math.max(current - 1, 0))} type="button">
            Back
          </button>
          {step < steps.length - 1 ? (
            <button className="btn btn-primary" onClick={nextStep} type="button">
              Save and Continue
            </button>
          ) : (
            <button className="btn btn-primary" disabled={saving} onClick={() => void finish()} type="button">
              {saving ? 'Saving...' : 'Finish Setup'}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState<ScreenKey>('dashboard');
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [events, setEvents] = useState<FarmEvent[]>([]);
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>('');

  const settingsMap = useMemo(() => settingsObject(settings), [settings]);
  const enabledSpecies = useMemo(() => parseEnabledSpecies(settings), [settings]);
  const farmName = settingsMap.farm_name || 'Herdly Farm';
  const ownerName = settingsMap.owner_name || 'Farm Admin';
  const location = settingsMap.location || 'Kenya';
  const currency = settingsMap.currency || 'KSh';
  const pinEnabled = settingsMap.pin_enabled === 'true';
  const inventoryTracking = settingsMap.inventory_tracking !== 'false';
  const financeTracking = settingsMap.finance_tracking !== 'false';

  const subjectOptions = useMemo<SubjectOption[]>(() => {
    const animalOptions = animals
      .filter((animal) => enabledSpecies.includes(animal.species) && animal.status === 'active')
      .map((animal) => ({
        id: animal.id,
        label: `${animal.name}${animal.tag ? ` (${animal.tag})` : ''}`,
        species: animal.species,
        type: 'individual' as const,
      }));
    const flockOptions = flocks
      .filter((flock) => enabledSpecies.includes(flock.species) && flock.status === 'active')
      .map((flock) => ({
        id: flock.id,
        label: flock.name,
        species: flock.species,
        type: 'batch' as const,
      }));
    return [...animalOptions, ...flockOptions];
  }, [animals, enabledSpecies, flocks]);

  const enabledProducts = useMemo<ProductType[]>(() => {
    const products = new Set<ProductType>();
    enabledSpecies.forEach((species) => {
      speciesByKey[species]?.production.forEach((product) => products.add(product));
    });
    if (hasWeightTracking(enabledSpecies)) products.add('weight');
    return Array.from(products);
  }, [enabledSpecies]);

  const activeAnimals = animals.filter((animal) => animal.status === 'active' && enabledSpecies.includes(animal.species));
  const activeFlocks = flocks.filter((flock) => flock.status === 'active' && enabledSpecies.includes(flock.species));
  const lowStock = inventory.filter((item) => (!item.species || enabledSpecies.includes(item.species)) && item.quantity <= item.reorder_level);
  const totalRevenue = sum(sales.filter((sale) => !sale.species || enabledSpecies.includes(sale.species)), (sale) => sale.quantity * sale.unit_price);
  const totalExpenses = sum(expenses.filter((expense) => !expense.species || enabledSpecies.includes(expense.species)), (expense) => expense.amount);

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
      ...(hasIndividualAnimals(enabledSpecies) ? [{ key: 'animals' as const, label: 'Animals', icon: <Users size={18} /> }] : []),
      ...(hasFlocks(enabledSpecies) ? [{ key: 'flocks' as const, label: 'Flocks', icon: <Layers size={18} /> }] : []),
      { key: 'events', label: 'Health & Events', icon: <HeartPulse size={18} /> },
      { key: 'production', label: 'Production', icon: <Wheat size={18} /> },
      ...(inventoryTracking ? [{ key: 'inventory' as const, label: 'Inventory', icon: <Boxes size={18} /> }] : []),
      ...(financeTracking ? [{ key: 'sales' as const, label: 'Sales', icon: <BadgeDollarSign size={18} /> }] : []),
      ...(financeTracking ? [{ key: 'expenses' as const, label: 'Expenses', icon: <ClipboardList size={18} /> }] : []),
      { key: 'reports', label: 'Reports', icon: <FileText size={18} /> },
      { key: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
    ];
    return items;
  }, [enabledSpecies, financeTracking, inventoryTracking]);

  async function loadAll() {
    setLoading(true);
    const configured = await db.isSetupComplete();
    setSetupComplete(configured);
    if (!configured) {
      setSettings([]);
      setAnimals([]);
      setFlocks([]);
      setEvents([]);
      setProduction([]);
      setInventory([]);
      setSales([]);
      setExpenses([]);
      setBuyers([]);
      setVets([]);
      setSuppliers([]);
      setLoading(false);
      return;
    }
    const [
      settingsRows,
      animalRows,
      flockRows,
      eventRows,
      productionRows,
      inventoryRows,
      salesRows,
      expenseRows,
      buyerRows,
      vetRows,
      supplierRows,
    ] = await Promise.all([
      db.getSettings(),
      db.getAnimals(),
      db.getFlocks(),
      db.getEvents(),
      db.getProduction(),
      db.getInventory(),
      db.getSales(),
      db.getExpenses(),
      db.getBuyers(),
      db.getVets(),
      db.getSuppliers(),
    ]);
    setSettings(settingsRows);
    setAnimals(animalRows);
    setFlocks(flockRows);
    setEvents(eventRows);
    setProduction(productionRows);
    setInventory(inventoryRows);
    setSales(salesRows);
    setExpenses(expenseRows);
    setBuyers(buyerRows);
    setVets(vetRows);
    setSuppliers(supplierRows);
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!navItems.some((item) => item.key === screen)) {
      setScreen('dashboard');
    }
  }, [navItems, screen]);

  function updateSettingInState(key: string, value: string) {
    setSettings((previous) => {
      const filtered = previous.filter((setting) => setting.key !== key);
      return [...filtered, { key, value }];
    });
  }

  async function saveSetting(key: string, value: string) {
    updateSettingInState(key, value);
    await db.setSetting(key, value);
  }

  async function finishSetup(payload: SetupPayload) {
    await db.completeSetup(payload);
    setSetupComplete(true);
    window.history.replaceState(null, '', '#/dashboard');
    await loadAll();
    setScreen('dashboard');
  }

  function submitPin(event: FormEvent) {
    event.preventDefault();
    if (hashPin(pinAttempt) === settingsMap.pin_hash) {
      setUnlocked(true);
      setPinError('');
    } else {
      setPinError('PIN does not match.');
    }
  }

  if (loading) {
    return (
      <div className="boot-screen">
        <img src={logoFull} alt="Herdly" />
        <span>Loading farm records...</span>
      </div>
    );
  }

  if (!setupComplete) {
    return <FirstRunSetup onComplete={finishSetup} />;
  }

  if (pinEnabled && !unlocked) {
    return (
      <main className="pin-screen">
        <form onSubmit={submitPin} className="pin-card">
          <img src={logoFull} alt="Herdly" />
          <div className="pin-icon">
            <Lock size={28} />
          </div>
          <h1>Enter Admin PIN</h1>
          <p>{farmName}</p>
          <input
            value={pinAttempt}
            onChange={(event) => setPinAttempt(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            type="password"
            maxLength={4}
            autoFocus
          />
          {pinError ? <div className="form-error">{pinError}</div> : null}
          <button className="btn btn-primary" type="submit">
            <ShieldCheck size={18} />
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setScreen('dashboard')} type="button">
          <img src={logoMark} alt="" />
          <span>
            <strong>Herdly</strong>
            <small>Manage smart. Grow better.</small>
          </span>
        </button>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={screen === item.key ? 'active' : ''}
              onClick={() => setScreen(item.key)}
              type="button"
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="farm-card">
          <span>{farmName}</span>
          <strong>{enabledSpecies.length} active modules</strong>
          <small>{location}</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <strong>{farmName}</strong>
            <span>{ownerName} - {location}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => void loadAll()} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        {screen === 'dashboard' ? (
          <DashboardScreen
            currency={currency}
            enabledSpecies={enabledSpecies}
            animals={activeAnimals}
            flocks={activeFlocks}
            events={events}
            production={production}
            inventory={inventory}
            sales={sales}
            expenses={expenses}
            lowStock={lowStock}
            totalRevenue={totalRevenue}
            totalExpenses={totalExpenses}
            setScreen={setScreen}
          />
        ) : null}

        {screen === 'animals' ? (
          <AnimalsScreen
            enabledSpecies={enabledSpecies}
            animals={animals}
            events={events}
            production={production}
            sales={sales}
            expenses={expenses}
            currency={currency}
            selectedAnimalId={selectedAnimalId}
            setSelectedAnimalId={setSelectedAnimalId}
            reload={loadAll}
          />
        ) : null}

        {screen === 'flocks' ? (
          <FlocksScreen enabledSpecies={enabledSpecies} flocks={flocks} currency={currency} reload={loadAll} />
        ) : null}

        {screen === 'events' ? (
          <EventsScreen
            enabledSpecies={enabledSpecies}
            events={events}
            subjectOptions={subjectOptions}
            vets={vets}
            currency={currency}
            reload={loadAll}
          />
        ) : null}

        {screen === 'production' ? (
          <ProductionScreen
            enabledSpecies={enabledSpecies}
            products={enabledProducts}
            production={production}
            subjectOptions={subjectOptions}
            reload={loadAll}
          />
        ) : null}

        {screen === 'inventory' ? (
          <InventoryScreen enabledSpecies={enabledSpecies} inventory={inventory} currency={currency} reload={loadAll} />
        ) : null}

        {screen === 'sales' ? (
          <SalesScreen
            enabledSpecies={enabledSpecies}
            products={enabledProducts}
            sales={sales}
            buyers={buyers}
            subjectOptions={subjectOptions}
            settings={settingsMap}
            currency={currency}
            reload={loadAll}
          />
        ) : null}

        {screen === 'expenses' ? (
          <ExpensesScreen
            enabledSpecies={enabledSpecies}
            expenses={expenses}
            subjectOptions={subjectOptions}
            currency={currency}
            reload={loadAll}
          />
        ) : null}

        {screen === 'reports' ? (
          <ReportsScreen
            farmName={farmName}
            ownerName={ownerName}
            location={location}
            currency={currency}
            enabledSpecies={enabledSpecies}
            animals={animals}
            flocks={flocks}
            events={events}
            production={production}
            inventory={inventory}
            sales={sales}
            expenses={expenses}
            staffFormsEnabled={settingsMap.staff_forms_enabled !== 'false'}
          />
        ) : null}

        {screen === 'settings' ? (
          <SettingsScreen
            settings={settingsMap}
            enabledSpecies={enabledSpecies}
            buyers={buyers}
            vets={vets}
            suppliers={suppliers}
            updateSettingInState={updateSettingInState}
            saveSetting={saveSetting}
            reload={loadAll}
            setSetupComplete={setSetupComplete}
          />
        ) : null}
      </main>
    </div>
  );
}

function DashboardScreen({
  currency,
  enabledSpecies,
  animals,
  flocks,
  events,
  production,
  inventory,
  sales,
  expenses,
  lowStock,
  totalRevenue,
  totalExpenses,
  setScreen,
}: {
  currency: string;
  enabledSpecies: SpeciesKey[];
  animals: Animal[];
  flocks: Flock[];
  events: FarmEvent[];
  production: ProductionLog[];
  inventory: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
  lowStock: InventoryItem[];
  totalRevenue: number;
  totalExpenses: number;
  setScreen: (screen: ScreenKey) => void;
}) {
  const monthStart = startOfMonth();
  const monthProduction = production.filter((log) => inRange(log.date, monthStart, todayInput()));
  const productionStats = productionSummaryLabels(enabledSpecies).map((label) => {
    const product = label.includes('milk') ? 'milk' : label.includes('eggs') ? 'eggs' : label.includes('wool') ? 'wool' : 'weight';
    return {
      label,
      value: sum(monthProduction.filter((log) => log.product === product), (log) => log.quantity).toLocaleString(),
    };
  });
  const chartData = buildProductionChart(monthProduction);
  const revenueChart = buildRevenueChart(sales, expenses, enabledSpecies);
  const upcomingEvents = events.slice(0, 5);
  const activeModules = enabledSpeciesModules(enabledSpecies);

  return (
    <section>
      <PageTitle
        title="Dashboard"
        subtitle="Today at a glance across the species and products active on this farm."
        action={
          <button className="btn btn-primary" onClick={() => setScreen('reports')} type="button">
            <Printer size={16} />
            Print Report
          </button>
        }
      />

      <div className="stats-grid">
        <StatCard label="Revenue" value={money(totalRevenue, currency)} icon={<BadgeDollarSign size={20} />} />
        <StatCard label="Expenses" value={money(totalExpenses, currency)} tone="amber" icon={<ClipboardList size={20} />} />
        <StatCard
          label="Net"
          value={money(totalRevenue - totalExpenses, currency)}
          tone={totalRevenue - totalExpenses >= 0 ? 'green' : 'red'}
          icon={<BarChart3 size={20} />}
        />
        <StatCard label="Active stock" value={`${animals.length + flocks.length}`} icon={<Users size={20} />} />
      </div>

      <div className="module-grid">
        {activeModules.map((species) => (
          <button className="module-card" key={species.key} onClick={() => setScreen(species.mode === 'individual' ? 'animals' : 'flocks')} type="button">
            <span className="species-icon">{species.icon}</span>
            <strong>{species.label}</strong>
            <small>{species.mode === 'individual' ? 'Individual records' : 'Batch records'}</small>
            <em>{primarySaleUnit(species.key)}</em>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>

      <div className="two-column">
        <div className="card">
          <div className="card-heading">
            <h2>Production Trend</h2>
            <span>{productionStats.map((stat) => `${stat.label}: ${stat.value}`).join(' | ') || 'No production this month'}</span>
          </div>
          {chartData.length === 0 ? (
            <EmptyState title="No production logs" body="Production charts appear after milk, eggs, wool, or weight records are added." />
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {farmProduces(enabledSpecies, 'milk') ? <Line type="monotone" dataKey="milk" stroke="#2E7D52" strokeWidth={2} /> : null}
                  {farmProduces(enabledSpecies, 'eggs') ? <Line type="monotone" dataKey="eggs" stroke="#D97706" strokeWidth={2} /> : null}
                  {farmProduces(enabledSpecies, 'wool') ? <Line type="monotone" dataKey="wool" stroke="#1D6FA4" strokeWidth={2} /> : null}
                  {hasWeightTracking(enabledSpecies) ? <Line type="monotone" dataKey="weight" stroke="#C0392B" strokeWidth={2} /> : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Profit Movement</h2>
            <span>Sales and expenses from current records</span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#2E7D52" />
                <Bar dataKey="expenses" fill="#D97706" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="two-column">
        <div className="card">
          <div className="card-heading">
            <h2>Low Stock Alerts</h2>
            <span>{lowStock.length} items at or below reorder level</span>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState title="Stock levels are okay" body="Inventory alerts will show here when quantities reach reorder levels." />
          ) : (
            <DataTable columns={['Item', 'Species', 'Qty', 'Reorder']}>
              {lowStock.map((item) => (
                <tr className="low-stock-row" key={item.id}>
                  <td>{item.name}</td>
                  <td>{speciesLabel(item.species)}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>{item.reorder_level} {item.unit}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
        <div className="card">
          <div className="card-heading">
            <h2>Recent Events</h2>
            <span>{events.length} event records</span>
          </div>
          {upcomingEvents.length === 0 ? (
            <EmptyState title="No events yet" body="Health, vaccination, AI, birth, sale, and note records will appear here." />
          ) : (
            <div className="event-list">
              {upcomingEvents.map((event) => (
                <div className="event-row" key={event.id}>
                  <span className="event-dot" />
                  <div>
                    <strong>{event.title}</strong>
                    <small>{eventLabel(event.event_type)} - {speciesLabel(event.species)} - {formatDate(event.date)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="hidden-metrics">{inventory.length}</div>
    </section>
  );
}

function AnimalsScreen({
  enabledSpecies,
  animals,
  events,
  production,
  sales,
  expenses,
  currency,
  selectedAnimalId,
  setSelectedAnimalId,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  animals: Animal[];
  events: FarmEvent[];
  production: ProductionLog[];
  sales: Sale[];
  expenses: Expense[];
  currency: string;
  selectedAnimalId: string;
  setSelectedAnimalId: (id: string) => void;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({ ...initialAnimalForm, species: enabledSpecies[0] ?? 'dairy_cattle' });
  const change = fieldChange(setForm);
  const individualSpecies = enabledSpecies.filter((species) => speciesByKey[species]?.mode === 'individual');
  const visibleAnimals = animals.filter((animal) => enabledSpecies.includes(animal.species));
  const selectedAnimal = animals.find((animal) => animal.id === selectedAnimalId) ?? visibleAnimals[0];

  useEffect(() => {
    if (!individualSpecies.includes(form.species as SpeciesKey) && individualSpecies[0]) {
      setForm((previous) => ({ ...previous, species: individualSpecies[0] }));
    }
  }, [form.species, individualSpecies]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await db.addAnimal({
      name: form.name,
      tag: form.tag,
      species: form.species as SpeciesKey,
      breed: form.breed,
      dob: form.dob,
      sex: form.sex,
      purchase_cost: number(form.purchase_cost),
      notes: form.notes,
      status: 'active',
    });
    setForm({ ...initialAnimalForm, species: individualSpecies[0] ?? 'dairy_cattle' });
    await reload();
  }

  async function updateStatus(id: string, status: AnimalStatus) {
    await db.updateAnimalStatus(id, status);
    await reload();
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this animal and all related events, production, sales, and expenses?')) return;
    await db.deleteAnimal(id);
    setSelectedAnimalId('');
    await reload();
  }

  if (!hasIndividualAnimals(enabledSpecies)) {
    return <EmptyState title="No individual species active" body="Enable cattle, goats, sheep, or pigs in Settings to use animal records." />;
  }

  return (
    <section>
      <PageTitle title="Animals" subtitle="Individual lifetime records for cattle, goats, sheep, and pigs." />
      <div className="two-column top-align">
        <form className="card form-grid" onSubmit={submit}>
          <div className="card-heading field-wide">
            <h2>Add Animal</h2>
            <span>Named stock with lifetime production and event history</span>
          </div>
          <TextField label="Name" name="name" value={form.name} onChange={change} required />
          <TextField label="Tag" name="tag" value={form.tag} onChange={change} />
          <SelectField label="Species" name="species" value={form.species} onChange={change}>
            {individualSpecies.map((species) => (
              <option key={species} value={species}>
                {speciesLabel(species)}
              </option>
            ))}
          </SelectField>
          <TextField label="Breed" name="breed" value={form.breed} onChange={change} />
          <TextField label="Date of birth" name="dob" value={form.dob} onChange={change} type="date" />
          <SelectField label="Sex" name="sex" value={form.sex} onChange={change}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="">Unknown</option>
          </SelectField>
          <TextField label={`Purchase cost (${currency})`} name="purchase_cost" value={form.purchase_cost} onChange={change} type="number" min="0" />
          <TextAreaField label="Notes" name="notes" value={form.notes} onChange={change} />
          <button className="btn btn-primary field-wide" type="submit">
            <Plus size={16} />
            Add Animal
          </button>
        </form>

        <AnimalProfile
          animal={selectedAnimal}
          events={events}
          production={production}
          sales={sales}
          expenses={expenses}
          currency={currency}
        />
      </div>

      <div className="card">
        <div className="card-heading">
          <h2>Animal Register</h2>
          <span>{visibleAnimals.length} records</span>
        </div>
        {visibleAnimals.length === 0 ? (
          <EmptyState title="No animals recorded" body="Add the first active animal above." />
        ) : (
          <DataTable columns={['Name', 'Tag', 'Species', 'Breed', 'DOB', 'Status', 'Cost', 'Actions']}>
            {visibleAnimals.map((animal) => (
              <tr key={animal.id} className={animal.id === selectedAnimal?.id ? 'selected-row' : ''}>
                <td>
                  <button className="link-button" onClick={() => setSelectedAnimalId(animal.id)} type="button">
                    {animal.name}
                  </button>
                </td>
                <td className="mono">{animal.tag || '-'}</td>
                <td>{speciesLabel(animal.species)}</td>
                <td>{animal.breed || '-'}</td>
                <td>{formatDate(animal.dob)}</td>
                <td>
                  <span className={statusClass(animal.status)}>{animal.status}</span>
                </td>
                <td>{money(animal.purchase_cost, currency)}</td>
                <td>
                  <div className="row-actions">
                    <select value={animal.status} onChange={(event) => void updateStatus(animal.id, event.target.value as AnimalStatus)}>
                      <option value="active">active</option>
                      <option value="sold">sold</option>
                      <option value="dead">dead</option>
                    </select>
                    <button className="icon-btn danger" onClick={() => void remove(animal.id)} type="button" title="Delete animal">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function AnimalProfile({
  animal,
  events,
  production,
  sales,
  expenses,
  currency,
}: {
  animal?: Animal;
  events: FarmEvent[];
  production: ProductionLog[];
  sales: Sale[];
  expenses: Expense[];
  currency: string;
}) {
  if (!animal) {
    return (
      <div className="card">
        <EmptyState title="Select an animal" body="Animal lifetime production, costs, events, and expected delivery dates appear here." />
      </div>
    );
  }

  const animalEvents = events.filter((event) => event.subject_id === animal.id);
  const animalProduction = production.filter((log) => log.subject_id === animal.id);
  const animalSales = sales.filter((sale) => sale.subject_id === animal.id);
  const animalExpenses = expenses.filter((expense) => expense.subject_id === animal.id);
  const revenue = sum(animalSales, (sale) => sale.quantity * sale.unit_price);
  const costs = animal.purchase_cost + sum(animalEvents, (event) => event.cost) + sum(animalExpenses, (expense) => expense.amount);

  return (
    <div className="card profile-card">
      <div className="profile-head">
        <span className="species-icon large">{speciesByKey[animal.species].icon}</span>
        <div>
          <h2>{animal.name}</h2>
          <p>{animal.tag || 'No tag'} - {speciesLabel(animal.species)}</p>
        </div>
        <span className={statusClass(animal.status)}>{animal.status}</span>
      </div>
      <div className="mini-stats">
        <div>
          <span>Revenue</span>
          <strong>{money(revenue, currency)}</strong>
        </div>
        <div>
          <span>Costs</span>
          <strong>{money(costs, currency)}</strong>
        </div>
        <div>
          <span>Net</span>
          <strong>{money(revenue - costs, currency)}</strong>
        </div>
      </div>
      <div className="profile-section">
        <h3>Production</h3>
        {animalProduction.length === 0 ? (
          <p className="muted">No production logs.</p>
        ) : (
          animalProduction.slice(0, 5).map((log) => (
            <div className="compact-row" key={log.id}>
              <span>{productLabel(log.product)}</span>
              <strong>{log.quantity} {log.unit}</strong>
              <small>{formatDate(log.date)}</small>
            </div>
          ))
        )}
      </div>
      <div className="profile-section">
        <h3>Events</h3>
        {animalEvents.length === 0 ? (
          <p className="muted">No events recorded.</p>
        ) : (
          animalEvents.slice(0, 6).map((event) => {
            const expected = event.event_type === 'ai' ? expectedDelivery(animal.species, event.date) : null;
            return (
              <div className="compact-row" key={event.id}>
                <span>{event.title}</span>
                <strong>{eventLabel(event.event_type)}</strong>
                <small>{formatDate(event.date)}{expected ? ` | Expected: ${formatDate(expected)}` : ''}</small>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FlocksScreen({
  enabledSpecies,
  flocks,
  currency,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  flocks: Flock[];
  currency: string;
  reload: () => Promise<void>;
}) {
  const batchSpecies = enabledSpecies.filter((species) => speciesByKey[species]?.mode === 'batch');
  const [form, setForm] = useState<FormState>({ ...initialFlockForm, species: batchSpecies[0] ?? 'layers' });
  const change = fieldChange(setForm);
  const visibleFlocks = flocks.filter((flock) => enabledSpecies.includes(flock.species));

  async function submit(event: FormEvent) {
    event.preventDefault();
    await db.addFlock({
      name: form.name,
      species: form.species as SpeciesKey,
      breed: form.breed,
      start_date: form.start_date,
      initial_count: number(form.initial_count),
      current_count: number(form.current_count || form.initial_count),
      purchase_cost: number(form.purchase_cost),
      notes: form.notes,
      status: 'active',
    });
    setForm({ ...initialFlockForm, species: batchSpecies[0] ?? 'layers' });
    await reload();
  }

  async function updateCount(id: string, count: string) {
    await db.updateFlockCount(id, number(count));
    await reload();
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this flock and all related records?')) return;
    await db.deleteFlock(id);
    await reload();
  }

  if (!hasFlocks(enabledSpecies)) {
    return <EmptyState title="No batch species active" body="Enable layer or broiler poultry in Settings to use flock records." />;
  }

  return (
    <section>
      <PageTitle title="Flocks" subtitle="Batch tracking for layer and broiler poultry." />
      <form className="card form-grid" onSubmit={submit}>
        <div className="card-heading field-wide">
          <h2>Add Flock</h2>
          <span>Track batch size, cost, and flock notes</span>
        </div>
        <TextField label="Name" name="name" value={form.name} onChange={change} required />
        <SelectField label="Species" name="species" value={form.species} onChange={change}>
          {batchSpecies.map((species) => (
            <option key={species} value={species}>
              {speciesLabel(species)}
            </option>
          ))}
        </SelectField>
        <TextField label="Breed / strain" name="breed" value={form.breed} onChange={change} />
        <TextField label="Start date" name="start_date" value={form.start_date} onChange={change} type="date" />
        <TextField label="Initial count" name="initial_count" value={form.initial_count} onChange={change} type="number" min="0" />
        <TextField label="Current count" name="current_count" value={form.current_count} onChange={change} type="number" min="0" />
        <TextField label={`Purchase cost (${currency})`} name="purchase_cost" value={form.purchase_cost} onChange={change} type="number" min="0" />
        <TextAreaField label="Notes" name="notes" value={form.notes} onChange={change} />
        <button className="btn btn-primary field-wide" type="submit">
          <Plus size={16} />
          Add Flock
        </button>
      </form>
      <div className="card">
        <div className="card-heading">
          <h2>Flock Register</h2>
          <span>{visibleFlocks.length} records</span>
        </div>
        {visibleFlocks.length === 0 ? (
          <EmptyState title="No flocks recorded" body="Add the first flock above." />
        ) : (
          <DataTable columns={['Name', 'Species', 'Breed', 'Started', 'Initial', 'Current', 'Cost', 'Actions']}>
            {visibleFlocks.map((flock) => (
              <tr key={flock.id}>
                <td>{flock.name}</td>
                <td>{speciesLabel(flock.species)}</td>
                <td>{flock.breed || '-'}</td>
                <td>{formatDate(flock.start_date)}</td>
                <td>{flock.initial_count}</td>
                <td>
                  <input
                    className="inline-input"
                    value={flock.current_count}
                    onChange={(event) => void updateCount(flock.id, event.target.value)}
                    type="number"
                    min={0}
                  />
                </td>
                <td>{money(flock.purchase_cost, currency)}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void remove(flock.id)} type="button" title="Delete flock">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function EventsScreen({
  enabledSpecies,
  events,
  subjectOptions,
  vets,
  currency,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  events: FarmEvent[];
  subjectOptions: SubjectOption[];
  vets: Vet[];
  currency: string;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    subject_id: emptySubject,
    species: enabledSpecies[0] ?? 'dairy_cattle',
    event_type: 'health',
    date: todayInput(),
    title: '',
    vet: '',
    cost: '',
    notes: '',
  });
  const change = fieldChange(setForm);
  const visibleEvents = events.filter((event) => !event.species || enabledSpecies.includes(event.species));
  const eventOptions = eventTypes.filter((type) =>
    enabledSpecies.some((species) => speciesByKey[species]?.events.includes(type)),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const subject = subjectOptions.find((option) => option.id === form.subject_id);
    await db.addEvent({
      subject_id: subject?.id ?? null,
      subject_type: subject?.type ?? null,
      species: subject?.species ?? (form.species as SpeciesKey),
      event_type: form.event_type as EventType,
      date: form.date,
      title: form.title,
      vet: form.vet,
      cost: number(form.cost),
      notes: form.notes,
    });
    setForm((previous) => ({ ...previous, subject_id: emptySubject, title: '', vet: '', cost: '', notes: '', date: todayInput() }));
    await reload();
  }

  async function remove(id: string) {
    await db.deleteEvent(id);
    await reload();
  }

  return (
    <section>
      <PageTitle title="Health & Events" subtitle="Treatments, vaccinations, AI, birth, death, sale, and management notes." />
      <form className="card form-grid" onSubmit={submit}>
        <div className="card-heading field-wide">
          <h2>Add Event</h2>
          <span>Events can be attached to a subject or logged by species only</span>
        </div>
        <SelectField label="Subject" name="subject_id" value={form.subject_id} onChange={change}>
          <option value={emptySubject}>No specific subject</option>
          {subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label} - {speciesLabel(subject.species)}
            </option>
          ))}
        </SelectField>
        <SpeciesSelect enabledSpecies={enabledSpecies} value={form.species} onChange={change} />
        <SelectField label="Event type" name="event_type" value={form.event_type} onChange={change}>
          {eventOptions.map((type) => (
            <option key={type} value={type}>
              {eventLabel(type)}
            </option>
          ))}
        </SelectField>
        <TextField label="Date" name="date" value={form.date} onChange={change} type="date" required />
        <TextField label="Title" name="title" value={form.title} onChange={change} required />
        <label className="field">
          <span>Vet</span>
          <input name="vet" value={form.vet} onChange={change} list="vet-list" />
          <datalist id="vet-list">
            {vets.map((vet) => (
              <option key={vet.id} value={vet.name} />
            ))}
          </datalist>
        </label>
        <TextField label={`Cost (${currency})`} name="cost" value={form.cost} onChange={change} type="number" min="0" />
        <TextAreaField label="Notes" name="notes" value={form.notes} onChange={change} />
        <button className="btn btn-primary field-wide" type="submit">
          <Plus size={16} />
          Add Event
        </button>
      </form>
      <div className="card">
        <div className="card-heading">
          <h2>Event Register</h2>
          <span>{visibleEvents.length} records</span>
        </div>
        {visibleEvents.length === 0 ? (
          <EmptyState title="No events recorded" body="Add health, vaccination, AI, birth, death, sale, or note records." />
        ) : (
          <DataTable columns={['Date', 'Title', 'Type', 'Species', 'Vet', 'Cost', 'Notes', '']}>
            {visibleEvents.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.date)}</td>
                <td>{event.title}</td>
                <td>{eventLabel(event.event_type)}</td>
                <td>{speciesLabel(event.species)}</td>
                <td>{event.vet || '-'}</td>
                <td>{money(event.cost, currency)}</td>
                <td>{event.notes || '-'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void remove(event.id)} type="button" title="Delete event">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function ProductionScreen({
  enabledSpecies,
  products,
  production,
  subjectOptions,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  products: ProductType[];
  production: ProductionLog[];
  subjectOptions: SubjectOption[];
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    subject_id: emptySubject,
    species: enabledSpecies[0] ?? 'dairy_cattle',
    product: products[0] ?? 'milk',
    date: todayInput(),
    quantity: '',
    unit: 'litres',
  });
  const change = fieldChange(setForm);
  const visibleLogs = production.filter((log) => !log.species || enabledSpecies.includes(log.species));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const subject = subjectOptions.find((option) => option.id === form.subject_id);
    await db.addProduction({
      subject_id: subject?.id ?? null,
      subject_type: subject?.type ?? null,
      species: subject?.species ?? (form.species as SpeciesKey),
      product: form.product as ProductType,
      date: form.date,
      quantity: number(form.quantity),
      unit: form.unit,
    });
    setForm((previous) => ({ ...previous, subject_id: emptySubject, date: todayInput(), quantity: '' }));
    await reload();
  }

  async function remove(id: string) {
    await db.deleteProduction(id);
    await reload();
  }

  return (
    <section>
      <PageTitle title="Production" subtitle="Milk, eggs, wool, manure, animal sales units, and weight tracking where applicable." />
      <form className="card form-grid" onSubmit={submit}>
        <div className="card-heading field-wide">
          <h2>Add Production Log</h2>
          <span>Product choices follow enabled species modules</span>
        </div>
        <SelectField label="Subject" name="subject_id" value={form.subject_id} onChange={change}>
          <option value={emptySubject}>No specific subject</option>
          {subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label} - {speciesLabel(subject.species)}
            </option>
          ))}
        </SelectField>
        <SpeciesSelect enabledSpecies={enabledSpecies} value={form.species} onChange={change} />
        <ProductSelect products={products} value={form.product} onChange={change} />
        <TextField label="Date" name="date" value={form.date} onChange={change} type="date" required />
        <TextField label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" min="0" required />
        <TextField label="Unit" name="unit" value={form.unit} onChange={change} />
        <button className="btn btn-primary field-wide" type="submit">
          <Plus size={16} />
          Add Production
        </button>
      </form>
      <div className="card">
        <div className="card-heading">
          <h2>Production Logs</h2>
          <span>{visibleLogs.length} records</span>
        </div>
        {visibleLogs.length === 0 ? (
          <EmptyState title="No production logs" body="Add the first production record above." />
        ) : (
          <DataTable columns={['Date', 'Product', 'Species', 'Quantity', 'Unit', '']}>
            {visibleLogs.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.date)}</td>
                <td>{productLabel(log.product)}</td>
                <td>{speciesLabel(log.species)}</td>
                <td>{log.quantity.toLocaleString()}</td>
                <td>{log.unit || '-'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void remove(log.id)} type="button" title="Delete production log">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function InventoryScreen({
  enabledSpecies,
  inventory,
  currency,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  inventory: InventoryItem[];
  currency: string;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initialInventoryForm);
  const change = fieldChange(setForm);
  const visibleInventory = inventory.filter((item) => !item.species || enabledSpecies.includes(item.species));

  async function submit(event: FormEvent) {
    event.preventDefault();
    await db.addInventory({
      name: form.name,
      category: form.category as InventoryItem['category'],
      species: isEnabledSpecies(form.species) ? form.species : null,
      quantity: number(form.quantity),
      unit: form.unit,
      reorder_level: number(form.reorder_level),
      total_cost: number(form.total_cost),
      supplier: form.supplier,
    });
    setForm(initialInventoryForm);
    await reload();
  }

  async function updateQty(id: string, quantity: string) {
    await db.updateInventoryQty(id, number(quantity));
    await reload();
  }

  async function remove(id: string) {
    await db.deleteInventory(id);
    await reload();
  }

  return (
    <section>
      <PageTitle title="Inventory" subtitle="Feeds, medicines, equipment, suppliers, reorder points, and stock alerts." />
      <form className="card form-grid" onSubmit={submit}>
        <div className="card-heading field-wide">
          <h2>Add Inventory Item</h2>
          <span>Rows at or below reorder level are highlighted automatically</span>
        </div>
        <TextField label="Item name" name="name" value={form.name} onChange={change} required />
        <SelectField label="Category" name="category" value={form.category} onChange={change}>
          {inventoryCategories.map((category) => (
            <option key={category} value={category}>
              {eventLabel(category)}
            </option>
          ))}
        </SelectField>
        <SpeciesSelect enabledSpecies={enabledSpecies} value={form.species} onChange={change} allowEmpty />
        <TextField label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" min="0" />
        <TextField label="Unit" name="unit" value={form.unit} onChange={change} />
        <TextField label="Reorder level" name="reorder_level" value={form.reorder_level} onChange={change} type="number" min="0" />
        <TextField label={`Total cost (${currency})`} name="total_cost" value={form.total_cost} onChange={change} type="number" min="0" />
        <TextField label="Supplier" name="supplier" value={form.supplier} onChange={change} />
        <button className="btn btn-primary field-wide" type="submit">
          <PackagePlus size={16} />
          Add Item
        </button>
      </form>
      <div className="card">
        <div className="card-heading">
          <h2>Stock Register</h2>
          <span>{visibleInventory.length} records</span>
        </div>
        {visibleInventory.length === 0 ? (
          <EmptyState title="No inventory items" body="Add feeds, medicines, or supplies above." />
        ) : (
          <DataTable columns={['Item', 'Category', 'Species', 'Qty', 'Reorder', 'Cost', 'Supplier', 'Status', '']}>
            {visibleInventory.map((item) => (
              <tr key={item.id} className={item.quantity <= item.reorder_level ? 'low-stock-row' : ''}>
                <td>{item.name}</td>
                <td>{eventLabel(item.category)}</td>
                <td>{speciesLabel(item.species)}</td>
                <td>
                  <input
                    className="inline-input"
                    value={item.quantity}
                    onChange={(event) => void updateQty(item.id, event.target.value)}
                    type="number"
                    min={0}
                  />{' '}
                  {item.unit}
                </td>
                <td>{item.reorder_level} {item.unit}</td>
                <td>{money(item.total_cost, currency)}</td>
                <td>{item.supplier || '-'}</td>
                <td>{item.quantity <= item.reorder_level ? <span className="warning-pill">LOW STOCK</span> : <span className="ok-pill">OK</span>}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void remove(item.id)} type="button" title="Delete item">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function SalesScreen({
  enabledSpecies,
  products,
  sales,
  buyers,
  subjectOptions,
  settings,
  currency,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  products: ProductType[];
  sales: Sale[];
  buyers: Buyer[];
  subjectOptions: SubjectOption[];
  settings: Record<string, string>;
  currency: string;
  reload: () => Promise<void>;
}) {
  const defaultProduct = farmProduces(enabledSpecies, 'milk') ? 'milk' : products[0] ?? 'animal';
  const [form, setForm] = useState<FormState>({
    product: defaultProduct,
    date: todayInput(),
    species: enabledSpecies[0] ?? 'dairy_cattle',
    subject_id: emptySubject,
    quantity: '',
    unit: defaultProduct === 'milk' ? 'litres' : 'animal',
    unit_price: defaultProduct === 'milk' ? settings.milk_price ?? '0' : defaultProduct === 'eggs' ? settings.egg_tray_price ?? '0' : '',
    buyer: '',
    notes: '',
  });
  const change = fieldChange(setForm);
  const visibleSales = sales.filter((sale) => !sale.species || enabledSpecies.includes(sale.species));

  function changeProduct(event: ChangeEvent<HTMLSelectElement>) {
    const product = event.target.value as ProductType;
    setForm((previous) => ({
      ...previous,
      product,
      unit: product === 'milk' ? 'litres' : product === 'eggs' ? 'trays' : product === 'wool' ? 'kg' : 'animal',
      unit_price:
        product === 'milk'
          ? settings.milk_price ?? previous.unit_price
          : product === 'eggs'
            ? settings.egg_tray_price ?? previous.unit_price
            : product === 'animal'
              ? settings.animal_sale_price ?? previous.unit_price
              : product === 'other'
                ? settings.other_product_price ?? previous.unit_price
            : previous.unit_price,
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const subject = subjectOptions.find((option) => option.id === form.subject_id);
    await db.addSale({
      product: form.product as ProductType,
      date: form.date,
      species: subject?.species ?? (form.species as SpeciesKey),
      subject_id: subject?.id ?? null,
      quantity: number(form.quantity),
      unit: form.unit,
      unit_price: number(form.unit_price),
      buyer: form.buyer,
      notes: form.notes,
    });
    setForm((previous) => ({ ...previous, date: todayInput(), subject_id: emptySubject, quantity: '', notes: '' }));
    await reload();
  }

  async function remove(id: string) {
    await db.deleteSale(id);
    await reload();
  }

  return (
    <section>
      <PageTitle title="Sales" subtitle="Product sales, buyer names, quantities, and unit prices." />
      <form className="card form-grid" onSubmit={submit}>
        <div className="card-heading field-wide">
          <h2>Add Sale</h2>
          <span>Milk and egg sales use the pricing defaults from Settings</span>
        </div>
        <ProductSelect products={products} value={form.product} onChange={changeProduct} />
        <TextField label="Date" name="date" value={form.date} onChange={change} type="date" required />
        <SpeciesSelect enabledSpecies={enabledSpecies} value={form.species} onChange={change} />
        <SelectField label="Subject" name="subject_id" value={form.subject_id} onChange={change}>
          <option value={emptySubject}>No specific subject</option>
          {subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label} - {speciesLabel(subject.species)}
            </option>
          ))}
        </SelectField>
        <TextField label="Quantity" name="quantity" value={form.quantity} onChange={change} type="number" min="0" required />
        <TextField label="Unit" name="unit" value={form.unit} onChange={change} />
        <TextField label={`Unit price (${currency})`} name="unit_price" value={form.unit_price} onChange={change} type="number" min="0" />
        <label className="field">
          <span>Buyer</span>
          <input name="buyer" value={form.buyer} onChange={change} list="buyer-list" />
          <datalist id="buyer-list">
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.name} />
            ))}
          </datalist>
        </label>
        <TextAreaField label="Notes" name="notes" value={form.notes} onChange={change} />
        <button className="btn btn-primary field-wide" type="submit">
          <Plus size={16} />
          Add Sale
        </button>
      </form>
      <div className="card">
        <div className="card-heading">
          <h2>Sales Register</h2>
          <span>{visibleSales.length} records</span>
        </div>
        {visibleSales.length === 0 ? (
          <EmptyState title="No sales recorded" body="Add product or animal sales above." />
        ) : (
          <DataTable columns={['Date', 'Product', 'Species', 'Qty', 'Unit price', 'Total', 'Buyer', '']}>
            {visibleSales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDate(sale.date)}</td>
                <td>{productLabel(sale.product)}</td>
                <td>{speciesLabel(sale.species)}</td>
                <td>{sale.quantity} {sale.unit}</td>
                <td>{money(sale.unit_price, currency)}</td>
                <td>{money(sale.quantity * sale.unit_price, currency)}</td>
                <td>{sale.buyer || '-'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void remove(sale.id)} type="button" title="Delete sale">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function ExpensesScreen({
  enabledSpecies,
  expenses,
  subjectOptions,
  currency,
  reload,
}: {
  enabledSpecies: SpeciesKey[];
  expenses: Expense[];
  subjectOptions: SubjectOption[];
  currency: string;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    date: todayInput(),
    category: 'feed',
    species: enabledSpecies[0] ?? 'dairy_cattle',
    subject_id: emptySubject,
    amount: '',
    description: '',
  });
  const change = fieldChange(setForm);
  const visibleExpenses = expenses.filter((expense) => !expense.species || enabledSpecies.includes(expense.species));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const subject = subjectOptions.find((option) => option.id === form.subject_id);
    await db.addExpense({
      date: form.date,
      category: form.category,
      species: subject?.species ?? (form.species as SpeciesKey),
      subject_id: subject?.id ?? null,
      amount: number(form.amount),
      description: form.description,
    });
    setForm((previous) => ({ ...previous, date: todayInput(), subject_id: emptySubject, amount: '', description: '' }));
    await reload();
  }

  async function remove(id: string) {
    await db.deleteExpense(id);
    await reload();
  }

  return (
    <section>
      <PageTitle title="Expenses" subtitle="Feed, vet, labour, medicine, supplies, and species-specific costs." />
      <form className="card form-grid" onSubmit={submit}>
        <div className="card-heading field-wide">
          <h2>Add Expense</h2>
          <span>Costs can be linked to a species or a specific subject</span>
        </div>
        <TextField label="Date" name="date" value={form.date} onChange={change} type="date" required />
        <TextField label="Category" name="category" value={form.category} onChange={change} required />
        <SpeciesSelect enabledSpecies={enabledSpecies} value={form.species} onChange={change} />
        <SelectField label="Subject" name="subject_id" value={form.subject_id} onChange={change}>
          <option value={emptySubject}>No specific subject</option>
          {subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label} - {speciesLabel(subject.species)}
            </option>
          ))}
        </SelectField>
        <TextField label={`Amount (${currency})`} name="amount" value={form.amount} onChange={change} type="number" min="0" required />
        <TextAreaField label="Description" name="description" value={form.description} onChange={change} />
        <button className="btn btn-primary field-wide" type="submit">
          <Plus size={16} />
          Add Expense
        </button>
      </form>
      <div className="card">
        <div className="card-heading">
          <h2>Expense Register</h2>
          <span>{visibleExpenses.length} records</span>
        </div>
        {visibleExpenses.length === 0 ? (
          <EmptyState title="No expenses recorded" body="Add feed, vet, medicine, or other costs above." />
        ) : (
          <DataTable columns={['Date', 'Category', 'Species', 'Amount', 'Description', '']}>
            {visibleExpenses.map((expense) => (
              <tr key={expense.id}>
                <td>{formatDate(expense.date)}</td>
                <td>{eventLabel(expense.category)}</td>
                <td>{speciesLabel(expense.species)}</td>
                <td>{money(expense.amount, currency)}</td>
                <td>{expense.description || '-'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void remove(expense.id)} type="button" title="Delete expense">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

function ReportsScreen({
  farmName,
  ownerName,
  location,
  currency,
  enabledSpecies,
  animals,
  flocks,
  events,
  production,
  inventory,
  sales,
  expenses,
  staffFormsEnabled,
}: {
  farmName: string;
  ownerName: string;
  location: string;
  currency: string;
  enabledSpecies: SpeciesKey[];
  animals: Animal[];
  flocks: Flock[];
  events: FarmEvent[];
  production: ProductionLog[];
  inventory: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
  staffFormsEnabled: boolean;
}) {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayInput());
  const [reportTab, setReportTab] = useState<'farm' | 'animal' | 'staff'>('farm');
  const [selectedReportAnimalId, setSelectedReportAnimalId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('milk-recording');
  const [selectedHealthSubjectId, setSelectedHealthSubjectId] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');
  const periodProduction = production.filter((log) => inRange(log.date, from, to) && (!log.species || enabledSpecies.includes(log.species)));
  const periodSales = sales.filter((sale) => inRange(sale.date, from, to) && (!sale.species || enabledSpecies.includes(sale.species)));
  const periodExpenses = expenses.filter((expense) => inRange(expense.date, from, to) && (!expense.species || enabledSpecies.includes(expense.species)));
  const periodEvents = events.filter((event) => inRange(event.date, from, to) && (!event.species || enabledSpecies.includes(event.species)));
  const revenue = sum(periodSales, (sale) => sale.quantity * sale.unit_price);
  const costs = sum(periodExpenses, (expense) => expense.amount) + sum(periodEvents, (event) => event.cost);
  const forms = activeFormsList(enabledSpecies);
  const chartData = buildProductionChart(periodProduction);
  const activeSpeciesLabels = enabledSpeciesModules(enabledSpecies).map((species) => species.label).join(', ');
  const reportAnimals = animals.filter((animal) => animal.status === 'active' && enabledSpecies.includes(animal.species));
  const selectedReportAnimal = reportAnimals.find((animal) => animal.id === selectedReportAnimalId) ?? reportAnimals[0];
  const selectedForm = forms.find((form) => form.id === selectedFormId) ?? forms[0];
  const staffSubjects = [
    ...animals
      .filter((animal) => animal.status === 'active' && enabledSpecies.includes(animal.species))
      .map((animal) => ({ id: animal.id, label: `${animal.name}${animal.tag ? ` (${animal.tag})` : ''}`, species: animal.species })),
    ...flocks
      .filter((flock) => flock.status === 'active' && enabledSpecies.includes(flock.species))
      .map((flock) => ({ id: flock.id, label: flock.name, species: flock.species })),
  ];
  const speciesWithData = enabledSpecies.filter((species) =>
    [
      ...periodProduction.filter((log) => log.species === species),
      ...periodSales.filter((sale) => sale.species === species),
      ...periodExpenses.filter((expense) => expense.species === species),
      ...periodEvents.filter((event) => event.species === species),
    ].length > 0,
  );
  const reportId = 'adaptive-report-print';
  const animalReportId = 'animal-report-print';
  const staffFormId = `staff-form-${selectedForm.id}`;

  useEffect(() => {
    if (selectedReportAnimal && selectedReportAnimal.id !== selectedReportAnimalId) {
      setSelectedReportAnimalId(selectedReportAnimal.id);
    }
  }, [selectedReportAnimal, selectedReportAnimalId]);

  useEffect(() => {
    if (!staffFormsEnabled && reportTab === 'staff') setReportTab('farm');
  }, [reportTab, staffFormsEnabled]);

  async function exportReport(id: string, request: PdfExportRequest) {
    setPdfMessage('');
    const exported = await exportPdfOnly(id, request);
    setPdfMessage(exported ? 'PDF exported.' : 'PDF export was cancelled.');
  }

  return (
    <section>
      <PageTitle
        title="Reports"
        subtitle="Generate whole farm reports, individual animal reports, and printable staff forms."
      />

      <div className="report-tabs no-print" role="tablist" aria-label="Report sections">
        <button className={reportTab === 'farm' ? 'active' : ''} onClick={() => setReportTab('farm')} type="button">
          Farm Reports
        </button>
        <button className={reportTab === 'animal' ? 'active' : ''} onClick={() => setReportTab('animal')} type="button">
          Animal Reports
        </button>
        {staffFormsEnabled ? (
          <button className={reportTab === 'staff' ? 'active' : ''} onClick={() => setReportTab('staff')} type="button">
            Printable Staff Forms
          </button>
        ) : null}
      </div>

      {pdfMessage ? <div className="notice no-print">{pdfMessage}</div> : null}

      {reportTab === 'farm' ? (
        <>
          <div className="card report-controls no-print">
            <TextField label="From" name="from" value={from} onChange={(event) => setFrom(event.target.value)} type="date" />
            <TextField label="To" name="to" value={to} onChange={(event) => setTo(event.target.value)} type="date" />
            <div className="report-summary">
              <strong>{money(revenue - costs, currency)}</strong>
              <span>Net for {dateRangeLabel(from, to)}</span>
            </div>
            <div className="report-action-bar">
              <button className="btn btn-primary" onClick={() => printOnly(reportId)} type="button">
                <Printer size={16} />
                Print Report
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  void exportReport(reportId, {
                    title: `${farmName} Farm Report ${from} to ${to}`,
                    reportType: 'farm_report',
                    dateRangeStart: from,
                    dateRangeEnd: to,
                    filters: { species: activeSpeciesLabels },
                  })
                }
                type="button"
              >
                <Download size={16} />
                Export PDF
              </button>
            </div>
          </div>

          <div className="screen-charts two-column">
            <div className="card">
              <div className="card-heading">
                <h2>Production by Date</h2>
                <span>{periodProduction.length} logs in period</span>
              </div>
              {chartData.length === 0 ? (
                <EmptyState title="No production in period" body="Change the date range or add production logs to see the trend." />
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {hasMilkProduction(enabledSpecies) ? <Line type="monotone" dataKey="milk" stroke="#2E7D52" strokeWidth={2} /> : null}
                      {hasEggProduction(enabledSpecies) ? <Line type="monotone" dataKey="eggs" stroke="#D97706" strokeWidth={2} /> : null}
                      {hasWoolProduction(enabledSpecies) ? <Line type="monotone" dataKey="wool" stroke="#1D6FA4" strokeWidth={2} /> : null}
                      {hasWeightTracking(enabledSpecies) ? <Line type="monotone" dataKey="weight" stroke="#C0392B" strokeWidth={2} /> : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-heading">
                <h2>Adaptive Columns</h2>
                <span>Per-animal profitability table layout</span>
              </div>
              <div className="column-preview">
                {adaptiveAnimalColumns(enabledSpecies).map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="report-preview-shell">
            <div id={reportId} className="report-print-layout report-document">
              <section className="report-section">
                <PrintHeader farmName={farmName} title="Farm Report Summary" location={location} />
                <h1>{farmName}</h1>
                <p>Owner: {ownerName}</p>
                <p>Location: {location}</p>
                <p>Report period: {dateRangeLabel(from, to)}</p>
                <p>Printed on: {formatDate(todayInput())}</p>
                <DataTable columns={['Metric', 'Value']}>
                  <tr>
                    <td>Total revenue</td>
                    <td>{money(revenue, currency)}</td>
                  </tr>
                  <tr>
                    <td>Total expenses</td>
                    <td>{money(costs, currency)}</td>
                  </tr>
                  <tr>
                    <td>Net profit / loss</td>
                    <td>{money(revenue - costs, currency)}</td>
                  </tr>
                  <tr>
                    <td>Active animals</td>
                    <td>{animals.filter((animal) => animal.status === 'active' && enabledSpecies.includes(animal.species)).length}</td>
                  </tr>
                  <tr>
                    <td>Active flocks</td>
                    <td>{flocks.filter((flock) => flock.status === 'active' && enabledSpecies.includes(flock.species)).length}</td>
                  </tr>
                  <tr>
                    <td>Species on this farm</td>
                    <td>{activeSpeciesLabels}</td>
                  </tr>
                </DataTable>
              </section>

              {speciesWithData.map((species) => (
                <SpeciesReportPage
                  key={species}
                  species={species}
                  farmName={farmName}
                  location={location}
                  period={`${from} to ${to}`}
                  currency={currency}
                  animals={animals.filter((animal) => animal.species === species)}
                  flocks={flocks.filter((flock) => flock.species === species)}
                  events={periodEvents.filter((event) => event.species === species)}
                  production={periodProduction.filter((log) => log.species === species)}
                  sales={periodSales.filter((sale) => sale.species === species)}
                  expenses={periodExpenses.filter((expense) => expense.species === species)}
                  enabledSpecies={enabledSpecies}
                />
              ))}

              <section className="report-section page-break">
                <PrintHeader farmName={farmName} title="Inventory Status" location={location} />
                <h2>Current Stock</h2>
                <DataTable columns={['Item', 'Category', 'Species', 'Quantity', 'Reorder', 'Status']}>
                  {inventory
                    .filter((item) => !item.species || enabledSpecies.includes(item.species))
                    .map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{eventLabel(item.category)}</td>
                        <td>{speciesLabel(item.species)}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{item.reorder_level} {item.unit}</td>
                        <td>{item.quantity <= item.reorder_level ? 'LOW STOCK' : 'OK'}</td>
                      </tr>
                    ))}
                </DataTable>
                <footer className="report-footer">
                  {farmName} - {location} - Generated by Herdly - {formatDate(todayInput())}
                  <br />
                  Report covers: {dateRangeLabel(from, to)}
                </footer>
              </section>
            </div>
          </div>
        </>
      ) : null}

      {reportTab === 'animal' ? (
        <>
          <div className="card report-controls no-print">
            <SelectField
              label="Animal"
              name="animal"
              value={selectedReportAnimal?.id || ''}
              onChange={(event) => setSelectedReportAnimalId(event.target.value)}
            >
              {reportAnimals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name} {animal.tag ? `(${animal.tag})` : ''} - {speciesLabel(animal.species)}
                </option>
              ))}
            </SelectField>
            <TextField label="From" name="animalFrom" value={from} onChange={(event) => setFrom(event.target.value)} type="date" />
            <TextField label="To" name="animalTo" value={to} onChange={(event) => setTo(event.target.value)} type="date" />
            <div className="report-action-bar">
              <button className="btn btn-primary" disabled={!selectedReportAnimal} onClick={() => printOnly(animalReportId)} type="button">
                <Printer size={16} />
                Print Report
              </button>
              <button
                className="btn btn-secondary"
                disabled={!selectedReportAnimal}
                onClick={() =>
                  selectedReportAnimal
                    ? void exportReport(animalReportId, {
                        title: `${selectedReportAnimal.name} Animal Report`,
                        reportType: 'animal_report',
                        dateRangeStart: from,
                        dateRangeEnd: to,
                        filters: { animal: selectedReportAnimal.name, species: speciesLabel(selectedReportAnimal.species) },
                      })
                    : undefined
                }
                type="button"
              >
                <Download size={16} />
                Export PDF
              </button>
            </div>
          </div>
          {selectedReportAnimal ? (
            <div className="report-preview-shell">
              <AnimalReportDocument
                id={animalReportId}
                farmName={farmName}
                ownerName={ownerName}
                location={location}
                currency={currency}
                animal={selectedReportAnimal}
                period={dateRangeLabel(from, to)}
                events={periodEvents.filter((event) => event.subject_id === selectedReportAnimal.id)}
                production={periodProduction.filter((log) => log.subject_id === selectedReportAnimal.id)}
                sales={periodSales.filter((sale) => sale.subject_id === selectedReportAnimal.id)}
                expenses={periodExpenses.filter((expense) => expense.subject_id === selectedReportAnimal.id)}
              />
            </div>
          ) : (
            <EmptyState title="No animal reports available" body="Add an active individual animal first." />
          )}
        </>
      ) : null}

      {reportTab === 'staff' ? (
        <>
          <div className="card report-controls staff-form-controls no-print">
            <SelectField label="Form type" name="staffForm" value={selectedForm.id} onChange={(event) => setSelectedFormId(event.target.value)}>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </SelectField>
            {selectedForm.id === 'health-event' ? (
              <SelectField
                label="Optional animal/flock"
                name="healthSubject"
                value={selectedHealthSubjectId}
                onChange={(event) => setSelectedHealthSubjectId(event.target.value)}
              >
                <option value="">Leave blank</option>
                {staffSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.label} - {speciesLabel(subject.species)}
                  </option>
                ))}
              </SelectField>
            ) : (
              <div className="report-summary">
                <strong>{forms.length}</strong>
                <span>Manual staff form types</span>
              </div>
            )}
            <div className="report-action-bar">
              <button className="btn btn-primary" onClick={() => printOnly(staffFormId)} type="button">
                <Printer size={16} />
                Print Form
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  void exportReport(staffFormId, {
                    title: `${farmName} ${selectedForm.title}`,
                    reportType: 'staff_form',
                    filters: {
                      form: selectedForm.title,
                      healthSubject: selectedHealthSubjectId || 'blank',
                    },
                  })
                }
                type="button"
              >
                <Download size={16} />
                Export PDF
              </button>
            </div>
          </div>
          <div className="report-preview-shell">
            <PrintableForm
              id={staffFormId}
              form={selectedForm}
              farmName={farmName}
              location={location}
              enabledSpecies={enabledSpecies}
              animals={animals}
              flocks={flocks}
              selectedHealthSubjectId={selectedHealthSubjectId}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function SpeciesReportPage({
  species,
  farmName,
  location,
  period,
  currency,
  animals,
  flocks,
  events,
  production,
  sales,
  expenses,
  enabledSpecies,
}: {
  species: SpeciesKey;
  farmName: string;
  location: string;
  period: string;
  currency: string;
  animals: Animal[];
  flocks: Flock[];
  events: FarmEvent[];
  production: ProductionLog[];
  sales: Sale[];
  expenses: Expense[];
  enabledSpecies: SpeciesKey[];
}) {
  const revenue = sum(sales, (sale) => sale.quantity * sale.unit_price);
  const costs = sum(expenses, (expense) => expense.amount) + sum(events, (event) => event.cost);
  const milk = sum(production.filter((log) => log.product === 'milk'), (log) => log.quantity);
  const eggs = sum(production.filter((log) => log.product === 'eggs'), (log) => log.quantity);
  const wool = sum(production.filter((log) => log.product === 'wool'), (log) => log.quantity);
  const weight = sum(production.filter((log) => log.product === 'weight'), (log) => log.quantity);
  const reproductiveEvents = events.filter((event) => ['ai', 'birth'].includes(event.event_type));

  return (
    <section className="report-section page-break">
      <PrintHeader farmName={farmName} title={`${speciesLabel(species)} Report - ${period}`} location={location} />
      <h2>{speciesLabel(species)} Report</h2>
      <DataTable columns={['Metric', 'Value']}>
        <tr>
          <td>Revenue</td>
          <td>{money(revenue, currency)}</td>
        </tr>
        <tr>
          <td>Costs</td>
          <td>{money(costs, currency)}</td>
        </tr>
        <tr>
          <td>Net</td>
          <td>{money(revenue - costs, currency)}</td>
        </tr>
        {farmProduces(enabledSpecies, 'milk') && speciesProducing([species], 'milk').length > 0 ? (
          <tr>
            <td>Milk produced</td>
            <td>{milk} litres</td>
          </tr>
        ) : null}
        {farmProduces(enabledSpecies, 'eggs') && species === 'layers' ? (
          <tr>
            <td>Eggs produced</td>
            <td>{eggs} eggs</td>
          </tr>
        ) : null}
        {farmProduces(enabledSpecies, 'wool') && species === 'sheep' ? (
          <tr>
            <td>Wool produced</td>
            <td>{wool} kg</td>
          </tr>
        ) : null}
        {hasWeightTracking([species]) ? (
          <tr>
            <td>Weight tracked</td>
            <td>{weight} kg</td>
          </tr>
        ) : null}
      </DataTable>

      {speciesByKey[species].mode === 'individual' ? (
        <DataTable columns={adaptiveAnimalColumns(enabledSpecies)}>
          {animals.map((animal) => {
            const subjectProduction = production.filter((log) => log.subject_id === animal.id);
            const subjectSales = sales.filter((sale) => sale.subject_id === animal.id);
            const subjectExpenses = expenses.filter((expense) => expense.subject_id === animal.id);
            const subjectRevenue = sum(subjectSales, (sale) => sale.quantity * sale.unit_price);
            const subjectCosts = sum(subjectExpenses, (expense) => expense.amount);
            return (
              <tr key={animal.id}>
                <td>{animal.name}</td>
                <td>{speciesLabel(animal.species)}</td>
                {hasMilkProduction(enabledSpecies) ? <td>{sum(subjectProduction.filter((log) => log.product === 'milk'), (log) => log.quantity)}</td> : null}
                {hasEggProduction(enabledSpecies) ? <td>{sum(subjectProduction.filter((log) => log.product === 'eggs'), (log) => log.quantity)}</td> : null}
                {hasWoolProduction(enabledSpecies) ? <td>{sum(subjectProduction.filter((log) => log.product === 'wool'), (log) => log.quantity)}</td> : null}
                {hasWeightTracking(enabledSpecies) ? <td>{sum(subjectProduction.filter((log) => log.product === 'weight'), (log) => log.quantity)}</td> : null}
                <td>{money(subjectRevenue, currency)}</td>
                <td>{money(subjectCosts, currency)}</td>
                <td>{money(subjectRevenue - subjectCosts, currency)}</td>
              </tr>
            );
          })}
        </DataTable>
      ) : (
        <DataTable columns={['Flock', 'Start date', 'Initial', 'Current', 'Revenue', 'Costs', 'Net']}>
          {flocks.map((flock) => (
            <tr key={flock.id}>
              <td>{flock.name}</td>
              <td>{formatDate(flock.start_date)}</td>
              <td>{flock.initial_count}</td>
              <td>{flock.current_count}</td>
              <td>{money(revenue, currency)}</td>
              <td>{money(costs, currency)}</td>
              <td>{money(revenue - costs, currency)}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <h3>Health Events</h3>
      <DataTable columns={['Date', 'Type', 'Title', 'Vet', 'Cost']}>
        {events
          .filter((event) => ['health', 'vaccination', 'death'].includes(event.event_type))
          .map((event) => (
            <tr key={event.id}>
              <td>{formatDate(event.date)}</td>
              <td>{eventLabel(event.event_type)}</td>
              <td>{event.title}</td>
              <td>{event.vet || '-'}</td>
              <td>{money(event.cost, currency)}</td>
            </tr>
          ))}
      </DataTable>

      {hasReproduction([species]) && reproductiveEvents.length > 0 ? (
        <>
          <h3>Reproduction</h3>
          <DataTable columns={['Date', 'Type', 'Title', 'Expected delivery', 'Notes']}>
            {reproductiveEvents.map((event) => {
              const expected = event.event_type === 'ai' ? expectedDelivery(species, event.date) : null;
              return (
                <tr key={event.id}>
                  <td>{formatDate(event.date)}</td>
                  <td>{eventLabel(event.event_type)}</td>
                  <td>{event.title}</td>
                  <td>{expected ? formatDate(expected) : '-'}</td>
                  <td>{event.notes || '-'}</td>
                </tr>
              );
            })}
          </DataTable>
        </>
      ) : null}
      <footer className="report-footer">
        {farmName} - {location} - Generated by Herdly - {formatDate(todayInput())}
        <br />
        Report covers: {period}
      </footer>
    </section>
  );
}

function AnimalReportDocument({
  id,
  farmName,
  ownerName,
  location,
  currency,
  animal,
  period,
  events,
  production,
  sales,
  expenses,
}: {
  id: string;
  farmName: string;
  ownerName: string;
  location: string;
  currency: string;
  animal: Animal;
  period: string;
  events: FarmEvent[];
  production: ProductionLog[];
  sales: Sale[];
  expenses: Expense[];
}) {
  const revenue = sum(sales, (sale) => sale.quantity * sale.unit_price);
  const productionTotal = sum(production, (log) => log.quantity);
  const healthCost = sum(events.filter((event) => ['health', 'vaccination'].includes(event.event_type)), (event) => event.cost);
  const totalCosts = animal.purchase_cost + healthCost + sum(expenses, (expense) => expense.amount);
  const timeline = [
    ...events.map((event) => ({
      date: event.date,
      type: eventLabel(event.event_type),
      detail: event.title,
      value: event.cost ? money(event.cost, currency) : '-',
    })),
    ...production.map((log) => ({
      date: log.date,
      type: productLabel(log.product),
      detail: `${log.quantity} ${log.unit || ''}`,
      value: '-',
    })),
    ...sales.map((sale) => ({
      date: sale.date,
      type: 'Sale',
      detail: `${productLabel(sale.product)} to ${sale.buyer || 'buyer'}`,
      value: money(sale.quantity * sale.unit_price, currency),
    })),
    ...expenses.map((expense) => ({
      date: expense.date,
      type: eventLabel(expense.category),
      detail: expense.description || 'Expense',
      value: money(expense.amount, currency),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section id={id} className="report-print-layout report-document animal-report-document">
      <PrintHeader farmName={farmName} title={`${animal.name} Animal Report`} location={location} />
      <h1>Individual Animal Report</h1>
      <p>Prepared for: {farmName}</p>
      <p>Manager: {ownerName}</p>
      <p>Report period: {period}</p>

      <h2>Animal Details</h2>
      <DataTable columns={['Field', 'Value', 'Field ', 'Value ']}>
        <tr>
          <td>Name</td>
          <td>{animal.name}</td>
          <td>Tag</td>
          <td>{animal.tag || '-'}</td>
        </tr>
        <tr>
          <td>Species</td>
          <td>{speciesLabel(animal.species)}</td>
          <td>Breed</td>
          <td>{animal.breed || '-'}</td>
        </tr>
        <tr>
          <td>Sex</td>
          <td>{animal.sex || '-'}</td>
          <td>Date of birth</td>
          <td>{formatDate(animal.dob)}</td>
        </tr>
        <tr>
          <td>Status</td>
          <td>{animal.status}</td>
          <td>Purchase cost</td>
          <td>{money(animal.purchase_cost, currency)}</td>
        </tr>
      </DataTable>

      <h2>Production Summary</h2>
      <DataTable columns={['Date', 'Product', 'Quantity', 'Unit', 'Notes']}>
        {production.length === 0 ? (
          <tr>
            <td colSpan={5}>No production records in this period.</td>
          </tr>
        ) : (
          production.map((log) => (
            <tr key={log.id}>
              <td>{formatDate(log.date)}</td>
              <td>{productLabel(log.product)}</td>
              <td>{log.quantity}</td>
              <td>{log.unit || '-'}</td>
              <td>-</td>
            </tr>
          ))
        )}
      </DataTable>

      <h2>Health & Events</h2>
      <DataTable columns={['Date', 'Type', 'Event', 'Vet', 'Cost', 'Notes']}>
        {events.length === 0 ? (
          <tr>
            <td colSpan={6}>No health or event records in this period.</td>
          </tr>
        ) : (
          events.map((event) => (
            <tr key={event.id}>
              <td>{formatDate(event.date)}</td>
              <td>{eventLabel(event.event_type)}</td>
              <td>{event.title}</td>
              <td>{event.vet || '-'}</td>
              <td>{money(event.cost, currency)}</td>
              <td>{event.notes || '-'}</td>
            </tr>
          ))
        )}
      </DataTable>

      <h2>Financial Summary</h2>
      <DataTable columns={['Metric', 'Value']}>
        <tr>
          <td>Total production quantity</td>
          <td>{productionTotal}</td>
        </tr>
        <tr>
          <td>Total revenue linked to animal</td>
          <td>{money(revenue, currency)}</td>
        </tr>
        <tr>
          <td>Total costs including purchase</td>
          <td>{money(totalCosts, currency)}</td>
        </tr>
        <tr>
          <td>Net profit / loss</td>
          <td>{money(revenue - totalCosts, currency)}</td>
        </tr>
      </DataTable>

      <h2>Timeline</h2>
      <DataTable columns={['Date', 'Type', 'Detail', 'Value']}>
        {timeline.length === 0 ? (
          <tr>
            <td colSpan={4}>No timeline entries in this period.</td>
          </tr>
        ) : (
          timeline.slice(0, 20).map((entry) => (
            <tr key={`${entry.date}-${entry.type}-${entry.detail}`}>
              <td>{formatDate(entry.date)}</td>
              <td>{entry.type}</td>
              <td>{entry.detail}</td>
              <td>{entry.value}</td>
            </tr>
          ))
        )}
      </DataTable>

      <div className="signature-grid">
        <div>Prepared by</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
      <footer className="report-footer">
        {farmName} - {location} - Generated by Herdly - {formatDate(todayInput())}
      </footer>
    </section>
  );
}

function ManualTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="manual-table-wrap">
      <table className="manual-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function padManualRows<T>(items: T[], minimumRows = 14): Array<T | null> {
  const blankCount = Math.max(minimumRows - items.length, 4);
  return [...items, ...Array.from({ length: blankCount }, () => null)];
}

function blankCells(count: number): ReactNode[] {
  return Array.from({ length: count }, (_, index) => <td className="write-cell" key={index} />);
}

function PrintableForm({
  id,
  form,
  farmName,
  location,
  enabledSpecies,
  animals,
  flocks,
  selectedHealthSubjectId,
}: {
  id: string;
  form: FormDefinition;
  farmName: string;
  location: string;
  enabledSpecies: SpeciesKey[];
  animals: Animal[];
  flocks: Flock[];
  selectedHealthSubjectId: string;
}) {
  const activeIndividual = animals.filter((animal) => animal.status === 'active' && enabledSpecies.includes(animal.species));
  const activeFlockRows = flocks.filter((flock) => flock.status === 'active' && enabledSpecies.includes(flock.species));
  const milkAnimals = activeIndividual.filter((animal) => animal.species === 'dairy_cattle');
  const eggFlocks = activeFlockRows.filter((flock) => flock.species === 'layers');
  const selectedHealthSubject = [...activeIndividual, ...activeFlockRows].find((subject) => subject.id === selectedHealthSubjectId);
  const healthRows = padManualRows(selectedHealthSubject ? [selectedHealthSubject] : []);
  const generalRows = padManualRows<string>([]);

  return (
    <section id={id} className="print-form report-document manual-form">
      <PrintHeader farmName={farmName} title={form.title} location={location} />
      <h1>{form.title}</h1>
      <div className="manual-form-fields">
        <span>Date</span>
        <span className="blank-line" />
        <span>Staff name</span>
        <span className="blank-line" />
        <span>Supervisor/Admin signature</span>
        <span className="blank-line" />
      </div>

      {form.id === 'milk-recording' ? (
        <ManualTable columns={['No.', 'Cow name / tag', 'Morning milk', 'Evening milk', 'Total', 'Notes']}>
          {padManualRows(milkAnimals).map((animal, index) => (
            <tr key={animal?.id ?? `blank-${index}`}>
              <td>{index + 1}</td>
              <td>{animal ? `${animal.name}${animal.tag ? ` / ${animal.tag}` : ''}` : ''}</td>
              {blankCells(4)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      {form.id === 'egg-collection' ? (
        <ManualTable columns={['No.', 'Flock name', 'Eggs collected', 'Damaged eggs', 'Eggs sold', 'Eggs remaining', 'Notes']}>
          {padManualRows(eggFlocks).map((flock, index) => (
            <tr key={flock?.id ?? `blank-${index}`}>
              <td>{index + 1}</td>
              <td>{flock?.name ?? ''}</td>
              {blankCells(5)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      {form.id === 'health-event' ? (
        <ManualTable columns={['No.', 'Animal / flock', 'Sickness / condition', 'Medicine / treatment / vaccine', 'Vet', 'Cost', 'Follow-up date', 'Notes']}>
          {healthRows.map((subject, index) => (
            <tr key={subject?.id ?? `blank-${index}`}>
              <td>{index + 1}</td>
              <td>{subject ? subject.name : ''}</td>
              {blankCells(6)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      {form.id === 'feed-usage' ? (
        <ManualTable columns={['No.', 'Feed / item', 'Quantity used', 'Used for animal / flock / species', 'Notes']}>
          {generalRows.map((_row, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              {blankCells(4)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      {form.id === 'sales-collection' ? (
        <ManualTable columns={['No.', 'Product', 'Quantity', 'Unit price', 'Buyer', 'Amount paid', 'Balance', 'Notes']}>
          {generalRows.map((_row, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              {blankCells(7)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      {form.id === 'mortality-record' ? (
        <ManualTable columns={['No.', 'Animal / flock', 'Deaths', 'Cause', 'Action taken', 'Disposal', 'Notes']}>
          {generalRows.map((_row, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              {blankCells(6)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      {form.id === 'general-activity' ? (
        <ManualTable columns={['No.', 'Activity / task', 'Area / house', 'Start time', 'End time', 'Staff initials', 'Notes']}>
          {generalRows.map((_row, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              {blankCells(6)}
            </tr>
          ))}
        </ManualTable>
      ) : null}

      <div className="manual-notes">
        <span>Supervisor notes</span>
        <span className="blank-line" />
        <span className="blank-line" />
      </div>
      <div className="signature-grid">
        <div>Staff signature</div>
        <div>Supervisor/Admin signature</div>
        <div>Date received</div>
      </div>
    </section>
  );
}

function SettingsScreen({
  settings,
  enabledSpecies,
  buyers,
  vets,
  suppliers,
  updateSettingInState,
  saveSetting,
  reload,
  setSetupComplete,
}: {
  settings: Record<string, string>;
  enabledSpecies: SpeciesKey[];
  buyers: Buyer[];
  vets: Vet[];
  suppliers: Supplier[];
  updateSettingInState: (key: string, value: string) => void;
  saveSetting: (key: string, value: string) => Promise<void>;
  reload: () => Promise<void>;
  setSetupComplete: (value: boolean) => void;
}) {
  const [farmForm, setFarmForm] = useState<FormState>({
    farm_name: settings.farm_name || '',
    owner_name: settings.owner_name || '',
    phone: settings.phone || '',
    location: settings.location || '',
    currency: settings.currency || 'KSh',
    milk_price: settings.milk_price || '0',
    goat_milk_price: settings.goat_milk_price || '0',
    egg_price: settings.egg_price || '0',
    egg_tray_price: settings.egg_tray_price || '0',
    animal_sale_price: settings.animal_sale_price || '',
    other_product_price: settings.other_product_price || '',
    low_stock_threshold: settings.low_stock_threshold || '10',
    gestation_cattle: settings.gestation_cattle || '283',
    gestation_goats: settings.gestation_goats || '150',
    gestation_sheep: settings.gestation_sheep || '147',
    gestation_pigs: settings.gestation_pigs || '114',
    gestation_rabbits: settings.gestation_rabbits || '31',
    staff_forms_enabled: settings.staff_forms_enabled || 'true',
    inventory_tracking: settings.inventory_tracking || 'true',
    finance_tracking: settings.finance_tracking || 'true',
  });
  const [buyerForm, setBuyerForm] = useState<FormState>({ name: '', contact: '', product_type: '', notes: '' });
  const [vetForm, setVetForm] = useState<FormState>({ name: '', contact: '', clinic: '', notes: '' });
  const [supplierForm, setSupplierForm] = useState<FormState>({ name: '', contact: '', category: '', notes: '' });
  const [pinForm, setPinForm] = useState<FormState>({ current: '', next: '', confirm: '' });
  const [settingsMessage, setSettingsMessage] = useState('');
  const farmChange = fieldChange(setFarmForm);
  const buyerChange = fieldChange(setBuyerForm);
  const vetChange = fieldChange(setVetForm);
  const supplierChange = fieldChange(setSupplierForm);
  const pinChange = fieldChange(setPinForm);
  const pinEnabled = settings.pin_enabled === 'true';

  function optimisticFarmChange(event: ChangeEvent<HTMLInputElement>) {
    farmChange(event);
    updateSettingInState(event.target.name, event.target.value);
  }

  function preferenceChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.checked ? 'true' : 'false';
    setFarmForm((previous) => ({ ...previous, [event.target.name]: value }));
    updateSettingInState(event.target.name, value);
  }

  async function saveFarmInfo(event: FormEvent) {
    event.preventDefault();
    await Promise.all(Object.entries(farmForm).map(([key, value]) => saveSetting(key, value)));
    setSettingsMessage('Farm settings saved.');
  }

  async function toggleSpecies(species: SpeciesKey) {
    const next = enabledSpecies.includes(species)
      ? enabledSpecies.filter((item) => item !== species)
      : [...enabledSpecies, species];
    if (next.length === 0) {
      setSettingsMessage('At least one species must remain active.');
      return;
    }
    updateSettingInState('enabled_species', JSON.stringify(next));
    await db.setSpecies(next);
    setSettingsMessage('Species modules updated.');
  }

  async function addBuyer(event: FormEvent) {
    event.preventDefault();
    if (buyers.some((buyer) => buyer.name.toLowerCase() === buyerForm.name.trim().toLowerCase())) {
      setSettingsMessage('A buyer with that name already exists.');
      return;
    }
    await db.addBuyer(buyerForm.name, buyerForm.contact, buyerForm.product_type, buyerForm.notes);
    setBuyerForm({ name: '', contact: '', product_type: '', notes: '' });
    await reload();
  }

  async function addVet(event: FormEvent) {
    event.preventDefault();
    if (vets.some((vet) => vet.name.toLowerCase() === vetForm.name.trim().toLowerCase())) {
      setSettingsMessage('A vet with that name already exists.');
      return;
    }
    await db.addVet(vetForm.name, vetForm.contact, vetForm.clinic, vetForm.notes);
    setVetForm({ name: '', contact: '', clinic: '', notes: '' });
    await reload();
  }

  async function addSupplier(event: FormEvent) {
    event.preventDefault();
    if (suppliers.some((supplier) => supplier.name.toLowerCase() === supplierForm.name.trim().toLowerCase())) {
      setSettingsMessage('A supplier with that name already exists.');
      return;
    }
    await db.addSupplier(supplierForm.name, supplierForm.contact, supplierForm.category, supplierForm.notes);
    setSupplierForm({ name: '', contact: '', category: '', notes: '' });
    await reload();
  }

  async function removeBuyer(id: string) {
    await db.deleteBuyer(id);
    await reload();
  }

  async function removeVet(id: string) {
    await db.deleteVet(id);
    await reload();
  }

  async function removeSupplier(id: string) {
    await db.deleteSupplier(id);
    await reload();
  }

  async function enablePin() {
    if (!/^\d{4}$/.test(pinForm.next) || pinForm.next !== pinForm.confirm) {
      setSettingsMessage('Enter the same 4-digit PIN twice.');
      return;
    }
    await saveSetting('pin_hash', hashPin(pinForm.next));
    await saveSetting('pin_enabled', 'true');
    setPinForm({ current: '', next: '', confirm: '' });
    setSettingsMessage('Admin PIN enabled.');
  }

  async function disablePin() {
    if (settings.pin_hash && hashPin(pinForm.current) !== settings.pin_hash) {
      setSettingsMessage('Current PIN does not match.');
      return;
    }
    await saveSetting('pin_enabled', 'false');
    await saveSetting('pin_hash', '');
    setPinForm({ current: '', next: '', confirm: '' });
    setSettingsMessage('Admin PIN disabled.');
  }

  async function changePin() {
    if (hashPin(pinForm.current) !== settings.pin_hash) {
      setSettingsMessage('Current PIN does not match.');
      return;
    }
    if (!/^\d{4}$/.test(pinForm.next) || pinForm.next !== pinForm.confirm) {
      setSettingsMessage('Enter the same new 4-digit PIN twice.');
      return;
    }
    await saveSetting('pin_hash', hashPin(pinForm.next));
    setPinForm({ current: '', next: '', confirm: '' });
    setSettingsMessage('Admin PIN changed.');
  }

  async function exportBackup() {
    await db.exportBackup();
    setSettingsMessage('Backup exported.');
  }

  async function importBackup() {
    const imported = await db.importBackup();
    if (imported) {
      await reload();
      setSettingsMessage('Backup imported.');
    }
  }

  async function loadDemo() {
    if (!window.confirm('Load demo animals, flocks, sales, expenses, and production records? This replaces current operational records but keeps your farm setup.')) return;
    await db.loadDemoData();
    await reload();
    setSettingsMessage('Demo data loaded.');
  }

  async function clearDemo() {
    if (!window.confirm('Clear all demo/operational records? Your farm setup and settings will stay.')) return;
    await db.clearDemoData();
    await reload();
    setSettingsMessage('Demo data cleared.');
  }

  async function resetApp() {
    if (!window.confirm('Strong warning: this deletes farm setup and all records. Herdly will return to first-run setup. Continue?')) return;
    await db.resetAppData();
    setSetupComplete(false);
    await reload();
  }

  return (
    <section>
      <PageTitle title="Settings" subtitle="Farm profile, modules, prices, contacts, preferences, demo data, and backups." />
      {settingsMessage ? <div className="notice">{settingsMessage}</div> : null}

      <form className="card form-grid" onSubmit={saveFarmInfo}>
        <div className="card-heading field-wide">
          <h2>Farm Info & Pricing</h2>
          <span>Farm name updates the app shell immediately</span>
        </div>
        <TextField label="Farm name" name="farm_name" value={farmForm.farm_name} onChange={optimisticFarmChange} />
        <TextField label="Owner name" name="owner_name" value={farmForm.owner_name} onChange={optimisticFarmChange} />
        <TextField label="Phone number" name="phone" value={farmForm.phone} onChange={optimisticFarmChange} />
        <TextField label="Location" name="location" value={farmForm.location} onChange={optimisticFarmChange} />
        <TextField label="Currency" name="currency" value={farmForm.currency} onChange={optimisticFarmChange} />
        <TextField label="Milk price per litre" name="milk_price" value={farmForm.milk_price} onChange={farmChange} type="number" min="0" />
        <TextField label="Goat milk price per litre" name="goat_milk_price" value={farmForm.goat_milk_price} onChange={farmChange} type="number" min="0" />
        <TextField label="Egg price per egg" name="egg_price" value={farmForm.egg_price} onChange={farmChange} type="number" min="0" />
        <TextField label="Egg tray/crate price" name="egg_tray_price" value={farmForm.egg_tray_price} onChange={farmChange} type="number" min="0" />
        <TextField label="Default animal sale price" name="animal_sale_price" value={farmForm.animal_sale_price} onChange={farmChange} type="number" min="0" />
        <TextField label="Other product default price" name="other_product_price" value={farmForm.other_product_price} onChange={farmChange} type="number" min="0" />
        <TextField label="Default low stock threshold" name="low_stock_threshold" value={farmForm.low_stock_threshold} onChange={farmChange} type="number" min="0" />
        <TextField label="Cattle gestation days" name="gestation_cattle" value={farmForm.gestation_cattle} onChange={farmChange} type="number" min="0" />
        <TextField label="Goat gestation days" name="gestation_goats" value={farmForm.gestation_goats} onChange={farmChange} type="number" min="0" />
        <TextField label="Sheep gestation days" name="gestation_sheep" value={farmForm.gestation_sheep} onChange={farmChange} type="number" min="0" />
        <TextField label="Pig gestation days" name="gestation_pigs" value={farmForm.gestation_pigs} onChange={farmChange} type="number" min="0" />
        <TextField label="Rabbit gestation days" name="gestation_rabbits" value={farmForm.gestation_rabbits} onChange={farmChange} type="number" min="0" />
        <label className="setup-check">
          <input name="staff_forms_enabled" checked={farmForm.staff_forms_enabled === 'true'} onChange={preferenceChange} type="checkbox" />
          Enable printable staff forms
        </label>
        <label className="setup-check">
          <input name="inventory_tracking" checked={farmForm.inventory_tracking === 'true'} onChange={preferenceChange} type="checkbox" />
          Enable inventory tracking
        </label>
        <label className="setup-check">
          <input name="finance_tracking" checked={farmForm.finance_tracking === 'true'} onChange={preferenceChange} type="checkbox" />
          Enable finance tracking
        </label>
        <button className="btn btn-primary field-wide" type="submit">
          <ShieldCheck size={16} />
          Save Settings
        </button>
      </form>

      <div className="card">
        <div className="card-heading">
          <h2>Species Modules</h2>
          <span>Everything adapts instantly when modules change</span>
        </div>
        <div className="species-grid">
          {speciesModules.map((species) => (
            <label className={`species-card ${enabledSpecies.includes(species.key) ? 'enabled' : ''}`} key={species.key}>
              <input checked={enabledSpecies.includes(species.key)} onChange={() => void toggleSpecies(species.key)} type="checkbox" />
              <span className="species-icon">{species.icon}</span>
              <strong>{species.label}</strong>
              <small>{species.mode === 'individual' ? 'Individual' : 'Batch'} tracking</small>
              <em>{species.production.map(productLabel).join(', ')}</em>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-heading">
          <h2>Suppliers</h2>
          <span>{suppliers.length} saved contacts</span>
        </div>
        <form className="inline-form three" onSubmit={addSupplier}>
          <input name="name" value={supplierForm.name} onChange={supplierChange} placeholder="Name" required />
          <input name="contact" value={supplierForm.contact} onChange={supplierChange} placeholder="Phone" />
          <input name="category" value={supplierForm.category} onChange={supplierChange} placeholder="Item/category supplied" />
          <input name="notes" value={supplierForm.notes} onChange={supplierChange} placeholder="Notes" />
          <button className="btn btn-secondary" type="submit">
            <Plus size={16} />
            Add
          </button>
        </form>
        <DataTable columns={['Name', 'Phone', 'Category', 'Notes', '']}>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.contact || '-'}</td>
              <td>{supplier.category || '-'}</td>
              <td>{supplier.notes || '-'}</td>
              <td>
                <button className="icon-btn danger" onClick={() => void removeSupplier(supplier.id)} type="button" title="Delete supplier">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="two-column top-align">
        <div className="card">
          <div className="card-heading">
            <h2>Buyers</h2>
            <span>{buyers.length} saved contacts</span>
          </div>
          <form className="inline-form three" onSubmit={addBuyer}>
            <input name="name" value={buyerForm.name} onChange={buyerChange} placeholder="Name" required />
            <input name="contact" value={buyerForm.contact} onChange={buyerChange} placeholder="Phone" />
            <input name="product_type" value={buyerForm.product_type} onChange={buyerChange} placeholder="Product type" />
            <input name="notes" value={buyerForm.notes} onChange={buyerChange} placeholder="Notes" />
            <button className="btn btn-secondary" type="submit">
              <Plus size={16} />
              Add
            </button>
          </form>
          <DataTable columns={['Name', 'Phone', 'Product', 'Notes', '']}>
            {buyers.map((buyer) => (
              <tr key={buyer.id}>
                <td>{buyer.name}</td>
                <td>{buyer.contact || '-'}</td>
                <td>{buyer.product_type || '-'}</td>
                <td>{buyer.notes || '-'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void removeBuyer(buyer.id)} type="button" title="Delete buyer">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div className="card">
          <div className="card-heading">
            <h2>Vets</h2>
            <span>{vets.length} saved contacts</span>
          </div>
          <form className="inline-form three" onSubmit={addVet}>
            <input name="name" value={vetForm.name} onChange={vetChange} placeholder="Name" required />
            <input name="contact" value={vetForm.contact} onChange={vetChange} placeholder="Phone" />
            <input name="clinic" value={vetForm.clinic} onChange={vetChange} placeholder="Clinic/business" />
            <input name="notes" value={vetForm.notes} onChange={vetChange} placeholder="Notes" />
            <button className="btn btn-secondary" type="submit">
              <Plus size={16} />
              Add
            </button>
          </form>
          <DataTable columns={['Name', 'Phone', 'Clinic', 'Notes', '']}>
            {vets.map((vet) => (
              <tr key={vet.id}>
                <td>{vet.name}</td>
                <td>{vet.contact || '-'}</td>
                <td>{vet.clinic || '-'}</td>
                <td>{vet.notes || '-'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => void removeVet(vet.id)} type="button" title="Delete vet">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      </div>

      <div className="two-column top-align">
        <div className="card form-grid">
          <div className="card-heading field-wide">
            <h2>Admin PIN</h2>
            <span>{pinEnabled ? 'PIN is enabled' : 'PIN is disabled'}</span>
          </div>
          {pinEnabled ? <TextField label="Current PIN" name="current" value={pinForm.current} onChange={pinChange} type="password" /> : null}
          <TextField label="New PIN" name="next" value={pinForm.next} onChange={pinChange} type="password" />
          <TextField label="Confirm PIN" name="confirm" value={pinForm.confirm} onChange={pinChange} type="password" />
          <div className="button-row field-wide">
            {pinEnabled ? (
              <>
                <button className="btn btn-secondary" onClick={() => void changePin()} type="button">
                  <ShieldCheck size={16} />
                  Change PIN
                </button>
                <button className="btn btn-danger" onClick={() => void disablePin()} type="button">
                  <Lock size={16} />
                  Disable PIN
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => void enablePin()} type="button">
                <Lock size={16} />
                Enable PIN
              </button>
            )}
          </div>
        </div>
        <div className="card backup-card">
          <div className="card-heading">
            <h2>Backup & Demo Data</h2>
            <span>Back up the database, restore records, or load sample data by choice</span>
          </div>
          <button className="btn btn-secondary" onClick={() => void exportBackup()} type="button">
            <Download size={16} />
            Backup Database
          </button>
          <button className="btn btn-secondary" onClick={() => void importBackup()} type="button">
            <Upload size={16} />
            Restore Database
          </button>
          <button className="btn btn-secondary" onClick={() => void loadDemo()} type="button">
            <PackagePlus size={16} />
            Load Demo Data
          </button>
          <button className="btn btn-secondary" onClick={() => void clearDemo()} type="button">
            <Trash2 size={16} />
            Clear Demo Data
          </button>
          <button className="btn btn-danger" onClick={() => void resetApp()} type="button">
            <RefreshCw size={16} />
            Reset App Data
          </button>
        </div>
      </div>
    </section>
  );
}

function buildProductionChart(logs: ProductionLog[]) {
  const map = new Map<string, Record<string, string | number>>();
  logs.forEach((log) => {
    const row = map.get(log.date) ?? { date: log.date, milk: 0, eggs: 0, wool: 0, weight: 0 };
    row[log.product] = number(row[log.product]) + log.quantity;
    map.set(log.date, row);
  });
  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildRevenueChart(sales: Sale[], expenses: Expense[], enabledSpecies: SpeciesKey[]) {
  return enabledSpeciesModules(enabledSpecies).map((species) => ({
    label: species.label.replace(' Poultry', ''),
    revenue: sum(
      sales.filter((sale) => sale.species === species.key),
      (sale) => sale.quantity * sale.unit_price,
    ),
    expenses: sum(
      expenses.filter((expense) => expense.species === species.key),
      (expense) => expense.amount,
    ),
  }));
}

type HerdlyRootElement = HTMLElement & { herdlyRoot?: ReturnType<typeof createRoot> };

const rootElement = document.getElementById('root') as HerdlyRootElement | null;
if (!rootElement) throw new Error('Herdly root element was not found.');
const root = rootElement.herdlyRoot ?? createRoot(rootElement);
rootElement.herdlyRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
