export type SpeciesKey =
  | 'dairy_cattle'
  | 'beef_cattle'
  | 'goats'
  | 'sheep'
  | 'layers'
  | 'broilers'
  | 'pigs'
  | 'rabbits'
  | 'other';

export type ProductType = 'milk' | 'eggs' | 'wool' | 'animal' | 'manure' | 'weight' | 'meat' | 'other';
export type TrackingMode = 'individual' | 'batch';
export type SubjectType = 'individual' | 'batch';
export type AnimalStatus = 'active' | 'sold' | 'dead';
export type FlockStatus = AnimalStatus;
export type InventoryCategory = 'feed' | 'medicine' | 'equipment' | 'supplies' | 'other';
export type EventType = 'health' | 'vaccination' | 'ai' | 'birth' | 'death' | 'sale' | 'note';

export interface SpeciesModule {
  key: SpeciesKey;
  label: string;
  icon: string;
  mode: TrackingMode;
  production: ProductType[];
  events: EventType[];
}

export interface FormDefinition {
  id: string;
  title: string;
  description: string;
}

export interface PdfExportRequest {
  title?: string;
  reportType?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  filters?: Record<string, string>;
  notes?: string;
}

export interface ReportLog {
  id: string;
  report_type: string;
  title: string;
  date_range_start?: string | null;
  date_range_end?: string | null;
  filters_json?: string | null;
  generated_at: string;
  exported_file_path?: string | null;
  notes?: string | null;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface FarmProfile {
  id: string;
  farm_name: string;
  owner_name: string;
  phone?: string | null;
  location: string;
  currency: string;
  created_at?: string;
  updated_at?: string;
}

export interface Animal {
  id: string;
  name: string;
  tag?: string | null;
  species: SpeciesKey;
  breed?: string | null;
  dob?: string | null;
  sex?: string | null;
  status: AnimalStatus;
  purchase_cost: number;
  notes?: string | null;
  created_at?: string;
}

export interface Flock {
  id: string;
  name: string;
  species: SpeciesKey;
  breed?: string | null;
  start_date?: string | null;
  initial_count: number;
  current_count: number;
  status: FlockStatus;
  purchase_cost: number;
  notes?: string | null;
}

export interface FarmEvent {
  id: string;
  subject_id?: string | null;
  subject_type?: SubjectType | null;
  species?: SpeciesKey | null;
  event_type: EventType;
  date: string;
  title: string;
  vet?: string | null;
  cost: number;
  notes?: string | null;
}

export interface ProductionLog {
  id: string;
  subject_id?: string | null;
  subject_type?: SubjectType | null;
  species?: SpeciesKey | null;
  product: ProductType;
  date: string;
  quantity: number;
  unit?: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  species?: SpeciesKey | null;
  quantity: number;
  unit?: string | null;
  reorder_level: number;
  total_cost: number;
  supplier?: string | null;
  last_updated?: string | null;
}

export interface Sale {
  id: string;
  product: ProductType;
  date: string;
  species?: SpeciesKey | null;
  subject_id?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  buyer?: string | null;
  notes?: string | null;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  species?: SpeciesKey | null;
  subject_id?: string | null;
  amount: number;
  description?: string | null;
}

export interface Buyer {
  id: string;
  name: string;
  contact?: string | null;
  product_type?: string | null;
  notes?: string | null;
}

export interface Vet {
  id: string;
  name: string;
  contact?: string | null;
  clinic?: string | null;
  notes?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string | null;
  category?: string | null;
  notes?: string | null;
}

export interface SetupPayload {
  farm_name: string;
  owner_name: string;
  phone: string;
  location: string;
  currency: string;
  enabled_species: SpeciesKey[];
  milk_price: string;
  goat_milk_price: string;
  egg_price: string;
  egg_tray_price: string;
  animal_sale_price: string;
  other_product_price: string;
  low_stock_threshold: string;
  gestation_cattle: string;
  gestation_goats: string;
  gestation_sheep: string;
  gestation_pigs: string;
  gestation_rabbits: string;
  staff_forms_enabled: string;
  inventory_tracking: string;
  finance_tracking: string;
}

export interface HerdlyBackup {
  exported_at: string;
  settings: SettingRow[];
  animals: Animal[];
  flocks: Flock[];
  farm_events: FarmEvent[];
  production_logs: ProductionLog[];
  inventory: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
  buyers: Buyer[];
  vets: Vet[];
  suppliers?: Supplier[];
  reports_log?: ReportLog[];
}

export interface HerdlyApi {
  isSetupComplete(): Promise<boolean>;
  completeSetup(payload: SetupPayload): Promise<boolean>;
  getSettings(): Promise<SettingRow[]>;
  setSetting(key: string, value: string): Promise<SettingRow>;
  setSpecies(species: SpeciesKey[]): Promise<SettingRow>;
  getAnimals(): Promise<Animal[]>;
  addAnimal(animal: Partial<Animal>): Promise<Animal>;
  updateAnimalStatus(id: string, status: AnimalStatus): Promise<boolean>;
  deleteAnimal(id: string): Promise<boolean>;
  getFlocks(): Promise<Flock[]>;
  addFlock(flock: Partial<Flock>): Promise<Flock>;
  updateFlockCount(id: string, count: number): Promise<boolean>;
  deleteFlock(id: string): Promise<boolean>;
  getEvents(): Promise<FarmEvent[]>;
  addEvent(event: Partial<FarmEvent>): Promise<FarmEvent>;
  deleteEvent(id: string): Promise<boolean>;
  getProduction(): Promise<ProductionLog[]>;
  addProduction(log: Partial<ProductionLog>): Promise<ProductionLog>;
  deleteProduction(id: string): Promise<boolean>;
  getInventory(): Promise<InventoryItem[]>;
  addInventory(item: Partial<InventoryItem>): Promise<InventoryItem>;
  updateInventoryQty(id: string, quantity: number): Promise<boolean>;
  deleteInventory(id: string): Promise<boolean>;
  getSales(): Promise<Sale[]>;
  addSale(sale: Partial<Sale>): Promise<Sale>;
  deleteSale(id: string): Promise<boolean>;
  getExpenses(): Promise<Expense[]>;
  addExpense(expense: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: string): Promise<boolean>;
  getBuyers(): Promise<Buyer[]>;
  addBuyer(name: string, contact?: string, productType?: string, notes?: string): Promise<Buyer>;
  deleteBuyer(id: string): Promise<boolean>;
  getVets(): Promise<Vet[]>;
  addVet(name: string, contact?: string, clinic?: string, notes?: string): Promise<Vet>;
  deleteVet(id: string): Promise<boolean>;
  getSuppliers(): Promise<Supplier[]>;
  addSupplier(name: string, contact?: string, category?: string, notes?: string): Promise<Supplier>;
  deleteSupplier(id: string): Promise<boolean>;
  exportPdf(request?: PdfExportRequest): Promise<boolean>;
  exportBackup(): Promise<boolean>;
  importBackup(): Promise<boolean>;
  loadDemoData(): Promise<boolean>;
  clearDemoData(): Promise<boolean>;
  resetAppData(): Promise<boolean>;
}

declare global {
  interface Window {
    herdly?: HerdlyApi;
  }
}
