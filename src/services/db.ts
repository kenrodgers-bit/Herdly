import { buildDatedSeed, seedAnimals, seedFlocks } from '../data/seed';
import type {
  Animal,
  AnimalStatus,
  Buyer,
  Expense,
  FarmEvent,
  Flock,
  HerdlyApi,
  InventoryItem,
  PdfExportRequest,
  ProductionLog,
  ReportLog,
  Sale,
  SettingRow,
  SetupPayload,
  SpeciesKey,
  Supplier,
  Vet,
} from '../types';

type TableName =
  | 'farms'
  | 'app_settings'
  | 'enabled_species'
  | 'product_prices'
  | 'gestation_settings'
  | 'settings'
  | 'animals'
  | 'flocks'
  | 'farm_events'
  | 'production_logs'
  | 'inventory'
  | 'sales'
  | 'expenses'
  | 'buyers'
  | 'vets'
  | 'suppliers'
  | 'reports_log';

type AnyRow = Record<string, unknown>;

const tables: TableName[] = [
  'farms',
  'app_settings',
  'enabled_species',
  'product_prices',
  'gestation_settings',
  'settings',
  'animals',
  'flocks',
  'farm_events',
  'production_logs',
  'inventory',
  'sales',
  'expenses',
  'buyers',
  'vets',
  'suppliers',
  'reports_log',
];

function id(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(table: TableName): string {
  return `herdly:${table}`;
}

function readTable<T>(table: TableName): T[] {
  const raw = localStorage.getItem(storageKey(table));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(table: TableName, rows: T[]): void {
  localStorage.setItem(storageKey(table), JSON.stringify(rows));
}

function upsertSetting(key: string, value: string): SettingRow {
  const settings = readTable<SettingRow>('settings').filter((setting) => setting.key !== key);
  const row = { key, value };
  writeTable('settings', [...settings, row].sort((a, b) => a.key.localeCompare(b.key)));
  const now = new Date().toISOString();
  writeTable('app_settings', [
    ...readTable<AnyRow>('app_settings').filter((setting) => setting.key !== key),
    { id: key, key, value, created_at: now, updated_at: now },
  ]);
  if (['farm_name', 'owner_name', 'phone', 'location', 'currency'].includes(key)) {
    const farms = readTable<AnyRow>('farms');
    if (farms[0]) writeTable('farms', [{ ...farms[0], [key]: value, updated_at: now }, ...farms.slice(1)]);
  }
  return row;
}

function settingsFromSetup(payload: SetupPayload): SettingRow[] {
  return [
    { key: 'farm_name', value: payload.farm_name },
    { key: 'owner_name', value: payload.owner_name },
    { key: 'phone', value: payload.phone },
    { key: 'location', value: payload.location },
    { key: 'currency', value: payload.currency || 'KSh' },
    { key: 'milk_price', value: payload.milk_price || '0' },
    { key: 'goat_milk_price', value: payload.goat_milk_price || '0' },
    { key: 'egg_price', value: payload.egg_price || '0' },
    { key: 'egg_tray_price', value: payload.egg_tray_price || '0' },
    { key: 'animal_sale_price', value: payload.animal_sale_price || '0' },
    { key: 'other_product_price', value: payload.other_product_price || '0' },
    { key: 'low_stock_threshold', value: payload.low_stock_threshold || '10' },
    { key: 'gestation_cattle', value: payload.gestation_cattle || '283' },
    { key: 'gestation_goats', value: payload.gestation_goats || '150' },
    { key: 'gestation_sheep', value: payload.gestation_sheep || '147' },
    { key: 'gestation_pigs', value: payload.gestation_pigs || '114' },
    { key: 'gestation_rabbits', value: payload.gestation_rabbits || '31' },
    { key: 'staff_forms_enabled', value: payload.staff_forms_enabled || 'true' },
    { key: 'inventory_tracking', value: payload.inventory_tracking || 'true' },
    { key: 'finance_tracking', value: payload.finance_tracking || 'true' },
    { key: 'enabled_species', value: JSON.stringify(payload.enabled_species.length ? payload.enabled_species : ['dairy_cattle']) },
    { key: 'pin_enabled', value: 'false' },
    { key: 'pin_hash', value: '' },
  ];
}

function completeSetupRows(payload: SetupPayload): void {
  const now = new Date().toISOString();
  const hadFarm = readTable<AnyRow>('farms').length > 0;
  const farmId = readTable<AnyRow>('farms')[0]?.id ?? 'farm-primary';
  if (!hadFarm) {
    (['animals', 'flocks', 'farm_events', 'production_logs', 'inventory', 'sales', 'expenses', 'buyers', 'vets', 'suppliers'] as TableName[]).forEach((table) => {
      writeTable(table, []);
    });
  }
  writeTable('farms', [
    {
      id: farmId,
      farm_name: payload.farm_name,
      owner_name: payload.owner_name,
      phone: payload.phone,
      location: payload.location,
      currency: payload.currency || 'KSh',
      created_at: now,
      updated_at: now,
    },
  ]);
  const settingRows = settingsFromSetup(payload);
  writeTable('settings', settingRows);
  writeTable(
    'app_settings',
    settingRows.map((row) => ({ id: row.key, key: row.key, value: row.value, created_at: now, updated_at: now })),
  );
  writeTable(
    'enabled_species',
    payload.enabled_species.map((species) => ({
      id: species,
      species_key: species,
      species_name: species,
      tracking_type: ['layers', 'broilers', 'rabbits'].includes(species) ? 'batch' : 'individual',
      enabled: 1,
      created_at: now,
      updated_at: now,
    })),
  );
  writeTable('product_prices', [
    { id: 'milk', product_key: 'milk', product_name: 'Milk', unit: 'litre', default_price: Number(payload.milk_price || 0), enabled: 1, created_at: now, updated_at: now },
    { id: 'goat_milk', product_key: 'goat_milk', product_name: 'Goat milk', unit: 'litre', default_price: Number(payload.goat_milk_price || 0), enabled: 1, created_at: now, updated_at: now },
    { id: 'eggs', product_key: 'eggs', product_name: 'Eggs', unit: 'egg', default_price: Number(payload.egg_price || 0), enabled: 1, created_at: now, updated_at: now },
    { id: 'egg_tray', product_key: 'egg_tray', product_name: 'Egg tray/crate', unit: 'tray', default_price: Number(payload.egg_tray_price || 0), enabled: 1, created_at: now, updated_at: now },
    { id: 'animal', product_key: 'animal', product_name: 'Animal sale', unit: 'animal', default_price: Number(payload.animal_sale_price || 0), enabled: 1, created_at: now, updated_at: now },
    { id: 'other', product_key: 'other', product_name: 'Other product', unit: 'unit', default_price: Number(payload.other_product_price || 0), enabled: 1, created_at: now, updated_at: now },
  ]);
  writeTable('gestation_settings', [
    { id: 'cattle', species_key: 'cattle', species_name: 'Cattle', gestation_days: Number(payload.gestation_cattle || 283), created_at: now, updated_at: now },
    { id: 'goats', species_key: 'goats', species_name: 'Goats', gestation_days: Number(payload.gestation_goats || 150), created_at: now, updated_at: now },
    { id: 'sheep', species_key: 'sheep', species_name: 'Sheep', gestation_days: Number(payload.gestation_sheep || 147), created_at: now, updated_at: now },
    { id: 'pigs', species_key: 'pigs', species_name: 'Pigs', gestation_days: Number(payload.gestation_pigs || 114), created_at: now, updated_at: now },
    { id: 'rabbits', species_key: 'rabbits', species_name: 'Rabbits', gestation_days: Number(payload.gestation_rabbits || 31), created_at: now, updated_at: now },
  ]);
}

function loadDemoRows(): void {
  const dated = buildDatedSeed(today());
  writeTable('animals', seedAnimals);
  writeTable('flocks', seedFlocks);
  writeTable('farm_events', dated.events);
  writeTable('production_logs', dated.production);
  writeTable('inventory', dated.inventory);
  writeTable('sales', dated.sales);
  writeTable('expenses', dated.expenses);
  writeTable('buyers', [
    { id: 'buyer-local-milk', name: 'Local milk buyer', contact: '0722 000 100', product_type: 'milk', notes: 'Demo buyer' },
    { id: 'buyer-neighbour-shop', name: 'Neighbour shop', contact: '0711 000 200', product_type: 'eggs', notes: 'Demo buyer' },
  ]);
  writeTable('vets', [{ id: 'vet-mwenda', name: 'Dr. Mwenda', contact: '0720 440 440', clinic: 'Meru Agrovet Clinic', notes: 'Demo vet' }]);
  writeTable('suppliers', [{ id: 'supplier-meru-agrovet', name: 'Meru Agrovet', contact: '', category: 'feed and medicine', notes: 'Demo supplier' }]);
  upsertSetting('demo_data_loaded', 'true');
}

function clearDemoRows(): void {
  (['animals', 'flocks', 'farm_events', 'production_logs', 'inventory', 'sales', 'expenses', 'buyers', 'vets', 'suppliers'] as TableName[]).forEach((table) => {
    writeTable(table, []);
  });
  upsertSetting('demo_data_loaded', 'false');
}

function addRow<T extends AnyRow>(table: TableName, row: T): T {
  const next = { id: id(), ...row } as T;
  writeTable(table, [next, ...readTable<T>(table)]);
  return next;
}

function deleteRow(table: TableName, rowId: string): boolean {
  writeTable(
    table,
    readTable<AnyRow>(table).filter((row) => row.id !== rowId),
  );
  return true;
}

function downloadBackup(payload: string): void {
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `herdly-backup-${today()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function logPdfExport(request?: PdfExportRequest, exportedFilePath?: string | null): void {
  const row: ReportLog = {
    id: id(),
    report_type: request?.reportType || 'report',
    title: request?.title || 'Herdly report',
    date_range_start: request?.dateRangeStart || null,
    date_range_end: request?.dateRangeEnd || null,
    filters_json: request?.filters ? JSON.stringify(request.filters) : null,
    generated_at: new Date().toISOString(),
    exported_file_path: exportedFilePath || null,
    notes: request?.notes || null,
  };
  writeTable('reports_log', [row, ...readTable<ReportLog>('reports_log')]);
}

async function pickJsonBackup(): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)));
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });
}

const localApi: HerdlyApi = {
  async isSetupComplete() {
    return readTable<AnyRow>('farms').length > 0;
  },
  async completeSetup(payload) {
    completeSetupRows(payload);
    return true;
  },
  async getSettings() {
    return readTable<SettingRow>('settings');
  },
  async setSetting(key, value) {
    return upsertSetting(key, value);
  },
  async setSpecies(speciesArray) {
    const now = new Date().toISOString();
    writeTable(
      'enabled_species',
      speciesArray.map((species) => ({
        id: species,
        species_key: species,
        species_name: species,
        tracking_type: ['layers', 'broilers', 'rabbits'].includes(species) ? 'batch' : 'individual',
        enabled: 1,
        created_at: now,
        updated_at: now,
      })),
    );
    return upsertSetting('enabled_species', JSON.stringify(speciesArray));
  },
  async getAnimals() {
    return readTable<Animal>('animals');
  },
  async addAnimal(animal) {
    return addRow('animals', {
      name: animal.name || '',
      tag: animal.tag || '',
      species: animal.species || 'dairy_cattle',
      breed: animal.breed || '',
      dob: animal.dob || '',
      sex: animal.sex || '',
      status: animal.status || 'active',
      purchase_cost: Number(animal.purchase_cost || 0),
      notes: animal.notes || '',
      created_at: new Date().toISOString(),
    }) as Animal;
  },
  async updateAnimalStatus(rowId, status) {
    writeTable(
      'animals',
      readTable<Animal>('animals').map((animal) => (animal.id === rowId ? { ...animal, status } : animal)),
    );
    return true;
  },
  async deleteAnimal(rowId) {
    deleteRow('animals', rowId);
    (['farm_events', 'production_logs', 'sales', 'expenses'] as TableName[]).forEach((table) => {
      writeTable(
        table,
        readTable<AnyRow>(table).filter((row) => row.subject_id !== rowId),
      );
    });
    return true;
  },
  async getFlocks() {
    return readTable<Flock>('flocks');
  },
  async addFlock(flock) {
    return addRow('flocks', {
      name: flock.name || '',
      species: flock.species || 'layers',
      breed: flock.breed || '',
      start_date: flock.start_date || '',
      initial_count: Number(flock.initial_count || 0),
      current_count: Number(flock.current_count || flock.initial_count || 0),
      status: flock.status || 'active',
      purchase_cost: Number(flock.purchase_cost || 0),
      notes: flock.notes || '',
    }) as Flock;
  },
  async updateFlockCount(rowId, count) {
    writeTable(
      'flocks',
      readTable<Flock>('flocks').map((flock) => (flock.id === rowId ? { ...flock, current_count: count } : flock)),
    );
    return true;
  },
  async deleteFlock(rowId) {
    deleteRow('flocks', rowId);
    (['farm_events', 'production_logs', 'sales', 'expenses'] as TableName[]).forEach((table) => {
      writeTable(
        table,
        readTable<AnyRow>(table).filter((row) => row.subject_id !== rowId),
      );
    });
    return true;
  },
  async getEvents() {
    return readTable<FarmEvent>('farm_events');
  },
  async addEvent(event) {
    return addRow('farm_events', {
      subject_id: event.subject_id || '',
      subject_type: event.subject_type || 'individual',
      species: event.species || null,
      event_type: event.event_type || 'note',
      date: event.date || today(),
      title: event.title || '',
      vet: event.vet || '',
      cost: Number(event.cost || 0),
      notes: event.notes || '',
    }) as FarmEvent;
  },
  async deleteEvent(rowId) {
    return deleteRow('farm_events', rowId);
  },
  async getProduction() {
    return readTable<ProductionLog>('production_logs');
  },
  async addProduction(log) {
    return addRow('production_logs', {
      subject_id: log.subject_id || '',
      subject_type: log.subject_type || 'individual',
      species: log.species || null,
      product: log.product || 'milk',
      date: log.date || today(),
      quantity: Number(log.quantity || 0),
      unit: log.unit || '',
    }) as ProductionLog;
  },
  async deleteProduction(rowId) {
    return deleteRow('production_logs', rowId);
  },
  async getInventory() {
    return readTable<InventoryItem>('inventory');
  },
  async addInventory(item) {
    return addRow('inventory', {
      name: item.name || '',
      category: item.category || 'other',
      species: item.species || null,
      quantity: Number(item.quantity || 0),
      unit: item.unit || '',
      reorder_level: Number(item.reorder_level || 0),
      total_cost: Number(item.total_cost || 0),
      supplier: item.supplier || '',
      last_updated: today(),
    }) as InventoryItem;
  },
  async updateInventoryQty(rowId, quantity) {
    writeTable(
      'inventory',
      readTable<InventoryItem>('inventory').map((item) => (item.id === rowId ? { ...item, quantity, last_updated: today() } : item)),
    );
    return true;
  },
  async deleteInventory(rowId) {
    return deleteRow('inventory', rowId);
  },
  async getSales() {
    return readTable<Sale>('sales');
  },
  async addSale(sale) {
    return addRow('sales', {
      product: sale.product || 'animal',
      date: sale.date || today(),
      species: sale.species || null,
      subject_id: sale.subject_id || null,
      quantity: Number(sale.quantity || 0),
      unit: sale.unit || '',
      unit_price: Number(sale.unit_price || 0),
      buyer: sale.buyer || '',
      notes: sale.notes || '',
    }) as Sale;
  },
  async deleteSale(rowId) {
    return deleteRow('sales', rowId);
  },
  async getExpenses() {
    return readTable<Expense>('expenses');
  },
  async addExpense(expense) {
    return addRow('expenses', {
      date: expense.date || today(),
      category: expense.category || 'other',
      species: expense.species || null,
      subject_id: expense.subject_id || null,
      amount: Number(expense.amount || 0),
      description: expense.description || '',
    }) as Expense;
  },
  async deleteExpense(rowId) {
    return deleteRow('expenses', rowId);
  },
  async getBuyers() {
    return readTable<Buyer>('buyers');
  },
  async addBuyer(name, contact = '', productType = '', notes = '') {
    return addRow('buyers', { name, contact, product_type: productType, notes }) as Buyer;
  },
  async deleteBuyer(rowId) {
    return deleteRow('buyers', rowId);
  },
  async getVets() {
    return readTable<Vet>('vets');
  },
  async addVet(name, contact = '', clinic = '', notes = '') {
    return addRow('vets', { name, contact, clinic, notes }) as Vet;
  },
  async deleteVet(rowId) {
    return deleteRow('vets', rowId);
  },
  async getSuppliers() {
    return readTable<Supplier>('suppliers');
  },
  async addSupplier(name, contact = '', category = '', notes = '') {
    return addRow('suppliers', { name, contact, category, notes }) as Supplier;
  },
  async deleteSupplier(rowId) {
    return deleteRow('suppliers', rowId);
  },
  async exportPdf(request) {
    logPdfExport(request, null);
    window.print();
    return true;
  },
  async exportBackup() {
    const backup = Object.fromEntries(tables.map((table) => [table, readTable(table)]));
    downloadBackup(JSON.stringify({ exported_at: new Date().toISOString(), ...backup }, null, 2));
    return true;
  },
  async importBackup() {
    const backup = await pickJsonBackup();
    if (!backup) return false;
    tables.forEach((table) => {
      const rows = backup[table];
      if (Array.isArray(rows)) writeTable(table, rows);
    });
    return true;
  },
  async loadDemoData() {
    loadDemoRows();
    return true;
  },
  async clearDemoData() {
    clearDemoRows();
    return true;
  },
  async resetAppData() {
    tables.forEach((table) => localStorage.removeItem(storageKey(table)));
    return true;
  },
};

export const db: HerdlyApi = window.herdly ?? localApi;

export function parseEnabledSpecies(settings: SettingRow[]): SpeciesKey[] {
  const row = settings.find((setting) => setting.key === 'enabled_species');
  if (!row) return ['dairy_cattle', 'layers', 'goats'];
  try {
    const parsed = JSON.parse(row.value) as SpeciesKey[];
    return parsed.length > 0 ? parsed : ['dairy_cattle'];
  } catch {
    return ['dairy_cattle', 'layers', 'goats'];
  }
}

export function settingsObject(settings: SettingRow[]): Record<string, string> {
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
}

export function hashPin(pin: string): string {
  let hash = 2166136261;
  for (let index = 0; index < pin.length; index += 1) {
    hash ^= pin.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isAnimalStatus(value: string): value is AnimalStatus {
  return ['active', 'sold', 'dead'].includes(value);
}
