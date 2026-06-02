import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions, SaveDialogOptions } from 'electron';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

type Row = Record<string, unknown>;
type PdfExportRequest = {
  title?: string;
  reportType?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  filters?: Record<string, string>;
  notes?: string;
};
type SetupPayload = {
  farm_name: string;
  owner_name: string;
  phone: string;
  location: string;
  currency: string;
  enabled_species: string[];
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
};

let mainWindow: BrowserWindow | null = null;
let db: Database.Database;

const tables = [
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
] as const;

function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDatabase(): Database.Database {
  if (!db) {
    const dataDir = process.env.HERDLY_USER_DATA_DIR || app.getPath('userData');
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'herdly.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function addColumnIfMissing(database: Database.Database, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS farms (
      id         TEXT PRIMARY KEY,
      farm_name  TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone      TEXT,
      location   TEXT,
      currency   TEXT NOT NULL DEFAULT 'KSh',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id         TEXT PRIMARY KEY,
      key        TEXT NOT NULL UNIQUE,
      value      TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enabled_species (
      id            TEXT PRIMARY KEY,
      species_key   TEXT NOT NULL UNIQUE,
      species_name  TEXT NOT NULL,
      tracking_type TEXT NOT NULL,
      enabled       INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_prices (
      id            TEXT PRIMARY KEY,
      product_key   TEXT NOT NULL UNIQUE,
      product_name  TEXT NOT NULL,
      unit          TEXT NOT NULL,
      default_price REAL DEFAULT 0,
      enabled       INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gestation_settings (
      id             TEXT PRIMARY KEY,
      species_key    TEXT NOT NULL UNIQUE,
      species_name   TEXT NOT NULL,
      gestation_days INTEGER NOT NULL,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS animals (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      tag           TEXT,
      species       TEXT NOT NULL,
      breed         TEXT,
      dob           TEXT,
      sex           TEXT,
      status        TEXT NOT NULL DEFAULT 'active',
      purchase_cost REAL DEFAULT 0,
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flocks (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      species       TEXT NOT NULL,
      breed         TEXT,
      start_date    TEXT,
      initial_count INTEGER DEFAULT 0,
      current_count INTEGER DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'active',
      purchase_cost REAL DEFAULT 0,
      notes         TEXT
    );

    CREATE TABLE IF NOT EXISTS farm_events (
      id           TEXT PRIMARY KEY,
      subject_id   TEXT,
      subject_type TEXT,
      species      TEXT,
      event_type   TEXT NOT NULL,
      date         TEXT NOT NULL,
      title        TEXT NOT NULL,
      vet          TEXT,
      cost         REAL DEFAULT 0,
      notes        TEXT
    );

    CREATE TABLE IF NOT EXISTS production_logs (
      id           TEXT PRIMARY KEY,
      subject_id   TEXT,
      subject_type TEXT,
      species      TEXT,
      product      TEXT NOT NULL,
      date         TEXT NOT NULL,
      quantity     REAL DEFAULT 0,
      unit         TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL,
      species       TEXT,
      quantity      REAL DEFAULT 0,
      unit          TEXT,
      reorder_level REAL DEFAULT 0,
      total_cost    REAL DEFAULT 0,
      supplier      TEXT,
      last_updated  TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      id         TEXT PRIMARY KEY,
      product    TEXT NOT NULL,
      date       TEXT NOT NULL,
      species    TEXT,
      subject_id TEXT,
      quantity   REAL DEFAULT 0,
      unit       TEXT,
      unit_price REAL DEFAULT 0,
      buyer      TEXT,
      notes      TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      category    TEXT NOT NULL,
      species     TEXT,
      subject_id  TEXT,
      amount      REAL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS buyers (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      contact      TEXT,
      product_type TEXT,
      notes        TEXT
    );

    CREATE TABLE IF NOT EXISTS vets (
      id      TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      contact TEXT,
      clinic  TEXT,
      notes   TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      contact  TEXT,
      category TEXT,
      notes    TEXT
    );

    CREATE TABLE IF NOT EXISTS reports_log (
      id                 TEXT PRIMARY KEY,
      report_type        TEXT NOT NULL,
      title              TEXT NOT NULL,
      date_range_start   TEXT,
      date_range_end     TEXT,
      filters_json       TEXT,
      generated_at       TEXT NOT NULL,
      exported_file_path TEXT,
      notes              TEXT
    );
  `);

  addColumnIfMissing(database, 'buyers', 'product_type', 'TEXT');
  addColumnIfMissing(database, 'buyers', 'notes', 'TEXT');
  addColumnIfMissing(database, 'vets', 'notes', 'TEXT');
}

function settingsFromSetup(payload: SetupPayload): Array<{ key: string; value: string }> {
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

function writeSetting(database: Database.Database, key: string, value: string): void {
  const now = new Date().toISOString();
  database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  database
    .prepare(
      `INSERT INTO app_settings (id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, key, value, now, now);

  if (['farm_name', 'owner_name', 'phone', 'location', 'currency'].includes(key)) {
    const column = key === 'farm_name' ? 'farm_name' : key === 'owner_name' ? 'owner_name' : key;
    database.prepare(`UPDATE farms SET ${column} = ?, updated_at = ? WHERE id = (SELECT id FROM farms ORDER BY created_at ASC LIMIT 1)`).run(value, now);
  }

  const priceMap: Record<string, string> = {
    milk_price: 'milk',
    goat_milk_price: 'goat_milk',
    egg_price: 'eggs',
    egg_tray_price: 'egg_tray',
    animal_sale_price: 'animal',
    other_product_price: 'other',
  };
  if (priceMap[key]) {
    database.prepare('UPDATE product_prices SET default_price = ?, updated_at = ? WHERE product_key = ?').run(Number(value || 0), now, priceMap[key]);
  }

  const gestationMap: Record<string, string> = {
    gestation_cattle: 'cattle',
    gestation_goats: 'goats',
    gestation_sheep: 'sheep',
    gestation_pigs: 'pigs',
    gestation_rabbits: 'rabbits',
  };
  if (gestationMap[key]) {
    database.prepare('UPDATE gestation_settings SET gestation_days = ?, updated_at = ? WHERE species_key = ?').run(Number(value || 0), now, gestationMap[key]);
  }
}

function completeSetup(database: Database.Database, payload: SetupPayload): boolean {
  const now = new Date().toISOString();
  const existingFarm = database.prepare('SELECT id FROM farms ORDER BY created_at ASC LIMIT 1').get() as { id?: string } | undefined;
  const hadFarm = Boolean(existingFarm?.id);
  const farmId = String(existingFarm?.id || 'farm-primary');
  database.transaction(() => {
    if (!hadFarm) {
      (['animals', 'flocks', 'farm_events', 'production_logs', 'inventory', 'sales', 'expenses', 'buyers', 'vets', 'suppliers'] as const).forEach((table) =>
        database.prepare(`DELETE FROM ${table}`).run(),
      );
    }

    database
      .prepare(
        `INSERT INTO farms (id, farm_name, owner_name, phone, location, currency, created_at, updated_at)
         VALUES (@id, @farm_name, @owner_name, @phone, @location, @currency, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           farm_name = excluded.farm_name,
           owner_name = excluded.owner_name,
           phone = excluded.phone,
           location = excluded.location,
           currency = excluded.currency,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: farmId,
        farm_name: payload.farm_name,
        owner_name: payload.owner_name,
        phone: payload.phone,
        location: payload.location,
        currency: payload.currency || 'KSh',
        created_at: now,
        updated_at: now,
      });

    settingsFromSetup(payload).forEach((row) => writeSetting(database, row.key, row.value));

    database.prepare('DELETE FROM enabled_species').run();
    payload.enabled_species.forEach((species) => {
      database
        .prepare(
          `INSERT INTO enabled_species (id, species_key, species_name, tracking_type, enabled, created_at, updated_at)
           VALUES (@id, @species_key, @species_name, @tracking_type, 1, @created_at, @updated_at)`,
        )
        .run({
          id: species,
          species_key: species,
          species_name: species,
          tracking_type: ['layers', 'broilers', 'rabbits'].includes(species) ? 'batch' : 'individual',
          created_at: now,
          updated_at: now,
        });
    });

    const prices = [
      ['milk', 'Milk', 'litre', payload.milk_price],
      ['goat_milk', 'Goat milk', 'litre', payload.goat_milk_price],
      ['eggs', 'Eggs', 'egg', payload.egg_price],
      ['egg_tray', 'Egg tray/crate', 'tray', payload.egg_tray_price],
      ['animal', 'Animal sale', 'animal', payload.animal_sale_price],
      ['other', 'Other product', 'unit', payload.other_product_price],
    ];
    prices.forEach(([key, name, unit, price]) => {
      database
        .prepare(
          `INSERT INTO product_prices (id, product_key, product_name, unit, default_price, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(product_key) DO UPDATE SET default_price = excluded.default_price, updated_at = excluded.updated_at`,
        )
        .run(key, key, name, unit, Number(price || 0), now, now);
    });

    const gestation = [
      ['cattle', 'Cattle', payload.gestation_cattle || '283'],
      ['goats', 'Goats', payload.gestation_goats || '150'],
      ['sheep', 'Sheep', payload.gestation_sheep || '147'],
      ['pigs', 'Pigs', payload.gestation_pigs || '114'],
      ['rabbits', 'Rabbits', payload.gestation_rabbits || '31'],
    ];
    gestation.forEach(([key, name, days]) => {
      database
        .prepare(
          `INSERT INTO gestation_settings (id, species_key, species_name, gestation_days, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(species_key) DO UPDATE SET gestation_days = excluded.gestation_days, updated_at = excluded.updated_at`,
        )
        .run(key, key, name, Number(days), now, now);
    });
  })();
  return true;
}

function rowById(table: string, id: string): Row | undefined {
  return getDatabase().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined;
}

function createWindow(): void {
  const iconPath = app.isPackaged
    ? path.join(__dirname, '../dist/icons/icon.png')
    : path.join(__dirname, '../public/icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    title: 'Herdly',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function clearAllData(database: Database.Database): void {
  database.transaction(() => {
    tables.forEach((table) => database.prepare(`DELETE FROM ${table}`).run());
  })();
}

function runSeed(force = false): boolean {
  const database = getDatabase();
  const animalCount = database.prepare('SELECT COUNT(*) as count FROM animals').get() as { count: number };
  if (!force && animalCount.count > 0) return false;

  (['animals', 'flocks', 'farm_events', 'production_logs', 'inventory', 'sales', 'expenses', 'buyers', 'vets', 'suppliers'] as const).forEach((table) =>
    database.prepare(`DELETE FROM ${table}`).run(),
  );
  writeSetting(database, 'demo_data_loaded', 'true');

  const date = today();
  const insertAnimal = database.prepare(`
    INSERT OR REPLACE INTO animals
      (id, name, tag, species, breed, dob, sex, status, purchase_cost, notes)
    VALUES
      (@id, @name, @tag, @species, @breed, @dob, @sex, @status, @purchase_cost, @notes)
  `);
  const insertFlock = database.prepare(`
    INSERT OR REPLACE INTO flocks
      (id, name, species, breed, start_date, initial_count, current_count, status, purchase_cost, notes)
    VALUES
      (@id, @name, @species, @breed, @start_date, @initial_count, @current_count, @status, @purchase_cost, @notes)
  `);
  const insertEvent = database.prepare(`
    INSERT OR REPLACE INTO farm_events
      (id, subject_id, subject_type, species, event_type, date, title, vet, cost, notes)
    VALUES
      (@id, @subject_id, @subject_type, @species, @event_type, @date, @title, @vet, @cost, @notes)
  `);
  const insertProduction = database.prepare(`
    INSERT OR REPLACE INTO production_logs
      (id, subject_id, subject_type, species, product, date, quantity, unit)
    VALUES
      (@id, @subject_id, @subject_type, @species, @product, @date, @quantity, @unit)
  `);
  const insertInventory = database.prepare(`
    INSERT OR REPLACE INTO inventory
      (id, name, category, species, quantity, unit, reorder_level, total_cost, supplier, last_updated)
    VALUES
      (@id, @name, @category, @species, @quantity, @unit, @reorder_level, @total_cost, @supplier, @last_updated)
  `);
  const insertSale = database.prepare(`
    INSERT OR REPLACE INTO sales
      (id, product, date, species, subject_id, quantity, unit, unit_price, buyer, notes)
    VALUES
      (@id, @product, @date, @species, @subject_id, @quantity, @unit, @unit_price, @buyer, @notes)
  `);
  const insertExpense = database.prepare(`
    INSERT OR REPLACE INTO expenses
      (id, date, category, species, subject_id, amount, description)
    VALUES
      (@id, @date, @category, @species, @subject_id, @amount, @description)
  `);
  const insertBuyer = database.prepare('INSERT OR REPLACE INTO buyers (id, name, contact, product_type, notes) VALUES (@id, @name, @contact, @product_type, @notes)');
  const insertVet = database.prepare('INSERT OR REPLACE INTO vets (id, name, contact, clinic, notes) VALUES (@id, @name, @contact, @clinic, @notes)');
  const insertSupplier = database.prepare('INSERT OR REPLACE INTO suppliers (id, name, contact, category, notes) VALUES (@id, @name, @contact, @category, @notes)');

  database.transaction(() => {
    [
      {
        id: 'animal-bessie',
        name: 'Bessie',
        tag: 'COW-001',
        species: 'dairy_cattle',
        breed: 'Friesian',
        dob: '2021-03-10',
        sex: 'female',
        status: 'active',
        purchase_cost: 85000,
        notes: 'High producer, calm during milking',
      },
      {
        id: 'animal-nyota',
        name: 'Nyota',
        tag: 'COW-002',
        species: 'dairy_cattle',
        breed: 'Ayrshire',
        dob: '2022-06-02',
        sex: 'female',
        status: 'active',
        purchase_cost: 65000,
        notes: 'Expected calving soon',
      },
      {
        id: 'animal-malaika',
        name: 'Malaika',
        tag: 'GOAT-001',
        species: 'goats',
        breed: 'Galla',
        dob: '2023-01-15',
        sex: 'female',
        status: 'active',
        purchase_cost: 12000,
        notes: 'Healthy doe',
      },
    ].forEach((row) => insertAnimal.run(row));

    insertFlock.run({
      id: 'flock-layer-house-a',
      name: 'Layer House A',
      species: 'layers',
      breed: 'Kenbro Layers',
      start_date: '2026-01-10',
      initial_count: 200,
      current_count: 194,
      status: 'active',
      purchase_cost: 30000,
      notes: 'Main egg flock',
    });

    [
      {
        id: 'event-bessie-fmd',
        subject_id: 'animal-bessie',
        subject_type: 'individual',
        species: 'dairy_cattle',
        event_type: 'vaccination',
        date: '2026-05-02',
        title: 'FMD vaccination',
        vet: 'Dr. Mwenda',
        cost: 800,
        notes: 'Routine',
      },
      {
        id: 'event-nyota-ai',
        subject_id: 'animal-nyota',
        subject_type: 'individual',
        species: 'dairy_cattle',
        event_type: 'ai',
        date: '2026-03-12',
        title: 'AI service performed',
        vet: 'County Vet Officer',
        cost: 1500,
        notes: 'Expected calving Nov 2026',
      },
      {
        id: 'event-layer-respiratory',
        subject_id: 'flock-layer-house-a',
        subject_type: 'batch',
        species: 'layers',
        event_type: 'health',
        date: '2026-05-18',
        title: 'Respiratory symptoms',
        vet: 'Dr. Mwenda',
        cost: 2400,
        notes: '2 birds lost, rest treated',
      },
    ].forEach((row) => insertEvent.run(row));

    [
      {
        id: 'prod-bessie-milk',
        subject_id: 'animal-bessie',
        subject_type: 'individual',
        species: 'dairy_cattle',
        product: 'milk',
        date,
        quantity: 30,
        unit: 'litres',
      },
      {
        id: 'prod-nyota-milk',
        subject_id: 'animal-nyota',
        subject_type: 'individual',
        species: 'dairy_cattle',
        product: 'milk',
        date,
        quantity: 18,
        unit: 'litres',
      },
      {
        id: 'prod-layer-eggs',
        subject_id: 'flock-layer-house-a',
        subject_type: 'batch',
        species: 'layers',
        product: 'eggs',
        date,
        quantity: 168,
        unit: 'eggs',
      },
    ].forEach((row) => insertProduction.run(row));

    [
      {
        id: 'inv-dairy-meal',
        name: 'Dairy Meal',
        category: 'feed',
        species: 'dairy_cattle',
        quantity: 120,
        unit: 'kg',
        reorder_level: 50,
        total_cost: 7800,
        supplier: 'Meru Agrovet',
        last_updated: date,
      },
      {
        id: 'inv-layers-mash',
        name: 'Layers Mash',
        category: 'feed',
        species: 'layers',
        quantity: 80,
        unit: 'kg',
        reorder_level: 100,
        total_cost: 5200,
        supplier: 'Meru Agrovet',
        last_updated: date,
      },
      {
        id: 'inv-dewormer',
        name: 'Dewormer',
        category: 'medicine',
        species: null,
        quantity: 4,
        unit: 'bottles',
        reorder_level: 2,
        total_cost: 1800,
        supplier: 'Agrovet',
        last_updated: date,
      },
    ].forEach((row) => insertInventory.run(row));

    [
      {
        id: 'sale-milk-local',
        product: 'milk',
        date,
        species: 'dairy_cattle',
        subject_id: null,
        quantity: 40,
        unit: 'litres',
        unit_price: 50,
        buyer: 'Local milk buyer',
        notes: '',
      },
      {
        id: 'sale-eggs-shop',
        product: 'eggs',
        date,
        species: 'layers',
        subject_id: 'flock-layer-house-a',
        quantity: 3,
        unit: 'trays',
        unit_price: 450,
        buyer: 'Neighbour shop',
        notes: '',
      },
    ].forEach((row) => insertSale.run(row));

    [
      {
        id: 'expense-dairy-feed',
        date,
        category: 'feed',
        species: 'dairy_cattle',
        subject_id: null,
        amount: 7800,
        description: 'Dairy meal purchase',
      },
      {
        id: 'expense-layers-feed',
        date,
        category: 'feed',
        species: 'layers',
        subject_id: null,
        amount: 5200,
        description: 'Layers mash purchase',
      },
      {
        id: 'expense-layers-vet',
        date,
        category: 'vet',
        species: 'layers',
        subject_id: 'flock-layer-house-a',
        amount: 2400,
        description: 'Respiratory treatment',
      },
    ].forEach((row) => insertExpense.run(row));

    insertBuyer.run({ id: 'buyer-local-milk', name: 'Local milk buyer', contact: '0722 000 100', product_type: 'milk', notes: 'Demo buyer' });
    insertBuyer.run({ id: 'buyer-neighbour-shop', name: 'Neighbour shop', contact: '0711 000 200', product_type: 'eggs', notes: 'Demo buyer' });
    insertVet.run({ id: 'vet-mwenda', name: 'Dr. Mwenda', contact: '0720 440 440', clinic: 'Meru Agrovet Clinic', notes: 'Demo vet' });
    insertSupplier.run({ id: 'supplier-meru-agrovet', name: 'Meru Agrovet', contact: '', category: 'feed and medicine', notes: 'Demo supplier' });
  })();

  return true;
}

function registerIpc(): void {
  ipcMain.handle('setup:is-complete', () => {
    const row = getDatabase().prepare('SELECT COUNT(*) as count FROM farms').get() as { count: number };
    return row.count > 0;
  });
  ipcMain.handle('setup:complete', (_event, payload: SetupPayload) => completeSetup(getDatabase(), payload));

  ipcMain.handle('settings:get-all', () => getDatabase().prepare('SELECT key, value FROM settings ORDER BY key ASC').all());
  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    writeSetting(getDatabase(), key, value);
    return { key, value };
  });
  ipcMain.handle('settings:set-species', (_event, speciesArray: string[]) => {
    const value = JSON.stringify(speciesArray);
    writeSetting(getDatabase(), 'enabled_species', value);
    const now = new Date().toISOString();
    getDatabase().prepare('DELETE FROM enabled_species').run();
    speciesArray.forEach((species) => {
      getDatabase()
        .prepare(
          `INSERT INTO enabled_species (id, species_key, species_name, tracking_type, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(species, species, species, ['layers', 'broilers', 'rabbits'].includes(species) ? 'batch' : 'individual', now, now);
    });
    return { key: 'enabled_species', value };
  });

  ipcMain.handle('animals:get-all', () => getDatabase().prepare('SELECT * FROM animals ORDER BY created_at DESC').all());
  ipcMain.handle('animals:add', (_event, animal: Row) => {
    const id = String(animal.id || createId());
    const row = {
      id,
      name: String(animal.name || ''),
      tag: animal.tag || null,
      species: String(animal.species || 'dairy_cattle'),
      breed: animal.breed || null,
      dob: animal.dob || null,
      sex: animal.sex || null,
      status: animal.status || 'active',
      purchase_cost: Number(animal.purchase_cost || 0),
      notes: animal.notes || null,
    };
    getDatabase()
      .prepare(
        `INSERT INTO animals (id, name, tag, species, breed, dob, sex, status, purchase_cost, notes)
         VALUES (@id, @name, @tag, @species, @breed, @dob, @sex, @status, @purchase_cost, @notes)`,
      )
      .run(row);
    return rowById('animals', id);
  });
  ipcMain.handle('animals:update-status', (_event, id: string, status: string) => {
    getDatabase().prepare('UPDATE animals SET status = ? WHERE id = ?').run(status, id);
    return true;
  });
  ipcMain.handle('animals:delete', (_event, id: string) => {
    getDatabase().transaction(() => {
      getDatabase().prepare('DELETE FROM farm_events WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM production_logs WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM sales WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM expenses WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM animals WHERE id = ?').run(id);
    })();
    return true;
  });

  ipcMain.handle('flocks:get-all', () => getDatabase().prepare('SELECT * FROM flocks ORDER BY name ASC').all());
  ipcMain.handle('flocks:add', (_event, flock: Row) => {
    const id = String(flock.id || createId());
    const row = {
      id,
      name: String(flock.name || ''),
      species: String(flock.species || 'layers'),
      breed: flock.breed || null,
      start_date: flock.start_date || null,
      initial_count: Number(flock.initial_count || 0),
      current_count: Number(flock.current_count || flock.initial_count || 0),
      status: flock.status || 'active',
      purchase_cost: Number(flock.purchase_cost || 0),
      notes: flock.notes || null,
    };
    getDatabase()
      .prepare(
        `INSERT INTO flocks (id, name, species, breed, start_date, initial_count, current_count, status, purchase_cost, notes)
         VALUES (@id, @name, @species, @breed, @start_date, @initial_count, @current_count, @status, @purchase_cost, @notes)`,
      )
      .run(row);
    return rowById('flocks', id);
  });
  ipcMain.handle('flocks:update-count', (_event, id: string, count: number) => {
    getDatabase().prepare('UPDATE flocks SET current_count = ? WHERE id = ?').run(count, id);
    return true;
  });
  ipcMain.handle('flocks:delete', (_event, id: string) => {
    getDatabase().transaction(() => {
      getDatabase().prepare('DELETE FROM farm_events WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM production_logs WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM sales WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM expenses WHERE subject_id = ?').run(id);
      getDatabase().prepare('DELETE FROM flocks WHERE id = ?').run(id);
    })();
    return true;
  });

  ipcMain.handle('events:get-all', () => getDatabase().prepare('SELECT * FROM farm_events ORDER BY date DESC').all());
  ipcMain.handle('events:add', (_event, event: Row) => {
    const id = String(event.id || createId());
    const row = {
      id,
      subject_id: event.subject_id || null,
      subject_type: event.subject_type || null,
      species: event.species || null,
      event_type: String(event.event_type || 'note'),
      date: String(event.date || today()),
      title: String(event.title || ''),
      vet: event.vet || null,
      cost: Number(event.cost || 0),
      notes: event.notes || null,
    };
    getDatabase()
      .prepare(
        `INSERT INTO farm_events (id, subject_id, subject_type, species, event_type, date, title, vet, cost, notes)
         VALUES (@id, @subject_id, @subject_type, @species, @event_type, @date, @title, @vet, @cost, @notes)`,
      )
      .run(row);
    return rowById('farm_events', id);
  });
  ipcMain.handle('events:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM farm_events WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('production:get-all', () => getDatabase().prepare('SELECT * FROM production_logs ORDER BY date DESC').all());
  ipcMain.handle('production:add', (_event, log: Row) => {
    const id = String(log.id || createId());
    const row = {
      id,
      subject_id: log.subject_id || null,
      subject_type: log.subject_type || null,
      species: log.species || null,
      product: String(log.product || 'milk'),
      date: String(log.date || today()),
      quantity: Number(log.quantity || 0),
      unit: log.unit || null,
    };
    getDatabase()
      .prepare(
        `INSERT INTO production_logs (id, subject_id, subject_type, species, product, date, quantity, unit)
         VALUES (@id, @subject_id, @subject_type, @species, @product, @date, @quantity, @unit)`,
      )
      .run(row);
    return rowById('production_logs', id);
  });
  ipcMain.handle('production:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM production_logs WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('inventory:get-all', () => getDatabase().prepare('SELECT * FROM inventory ORDER BY name ASC').all());
  ipcMain.handle('inventory:add', (_event, item: Row) => {
    const id = String(item.id || createId());
    const row = {
      id,
      name: String(item.name || ''),
      category: String(item.category || 'other'),
      species: item.species || null,
      quantity: Number(item.quantity || 0),
      unit: item.unit || null,
      reorder_level: Number(item.reorder_level || 0),
      total_cost: Number(item.total_cost || 0),
      supplier: item.supplier || null,
      last_updated: String(item.last_updated || today()),
    };
    getDatabase()
      .prepare(
        `INSERT INTO inventory (id, name, category, species, quantity, unit, reorder_level, total_cost, supplier, last_updated)
         VALUES (@id, @name, @category, @species, @quantity, @unit, @reorder_level, @total_cost, @supplier, @last_updated)`,
      )
      .run(row);
    return rowById('inventory', id);
  });
  ipcMain.handle('inventory:update-qty', (_event, id: string, quantity: number) => {
    getDatabase().prepare('UPDATE inventory SET quantity = ?, last_updated = ? WHERE id = ?').run(quantity, today(), id);
    return true;
  });
  ipcMain.handle('inventory:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM inventory WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('sales:get-all', () => getDatabase().prepare('SELECT * FROM sales ORDER BY date DESC').all());
  ipcMain.handle('sales:add', (_event, sale: Row) => {
    const id = String(sale.id || createId());
    const row = {
      id,
      product: String(sale.product || 'animal'),
      date: String(sale.date || today()),
      species: sale.species || null,
      subject_id: sale.subject_id || null,
      quantity: Number(sale.quantity || 0),
      unit: sale.unit || null,
      unit_price: Number(sale.unit_price || 0),
      buyer: sale.buyer || null,
      notes: sale.notes || null,
    };
    getDatabase()
      .prepare(
        `INSERT INTO sales (id, product, date, species, subject_id, quantity, unit, unit_price, buyer, notes)
         VALUES (@id, @product, @date, @species, @subject_id, @quantity, @unit, @unit_price, @buyer, @notes)`,
      )
      .run(row);
    return rowById('sales', id);
  });
  ipcMain.handle('sales:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM sales WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('expenses:get-all', () => getDatabase().prepare('SELECT * FROM expenses ORDER BY date DESC').all());
  ipcMain.handle('expenses:add', (_event, expense: Row) => {
    const id = String(expense.id || createId());
    const row = {
      id,
      date: String(expense.date || today()),
      category: String(expense.category || 'other'),
      species: expense.species || null,
      subject_id: expense.subject_id || null,
      amount: Number(expense.amount || 0),
      description: expense.description || null,
    };
    getDatabase()
      .prepare(
        `INSERT INTO expenses (id, date, category, species, subject_id, amount, description)
         VALUES (@id, @date, @category, @species, @subject_id, @amount, @description)`,
      )
      .run(row);
    return rowById('expenses', id);
  });
  ipcMain.handle('expenses:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('buyers:get-all', () => getDatabase().prepare('SELECT * FROM buyers ORDER BY name ASC').all());
  ipcMain.handle('buyers:add', (_event, name: string, contact = '', productType = '', notes = '') => {
    const id = createId();
    getDatabase().prepare('INSERT INTO buyers (id, name, contact, product_type, notes) VALUES (?, ?, ?, ?, ?)').run(id, name, contact, productType, notes);
    return rowById('buyers', id);
  });
  ipcMain.handle('buyers:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM buyers WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('vets:get-all', () => getDatabase().prepare('SELECT * FROM vets ORDER BY name ASC').all());
  ipcMain.handle('vets:add', (_event, name: string, contact = '', clinic = '', notes = '') => {
    const id = createId();
    getDatabase().prepare('INSERT INTO vets (id, name, contact, clinic, notes) VALUES (?, ?, ?, ?, ?)').run(id, name, contact, clinic, notes);
    return rowById('vets', id);
  });
  ipcMain.handle('vets:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM vets WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('suppliers:get-all', () => getDatabase().prepare('SELECT * FROM suppliers ORDER BY name ASC').all());
  ipcMain.handle('suppliers:add', (_event, name: string, contact = '', category = '', notes = '') => {
    const id = createId();
    getDatabase().prepare('INSERT INTO suppliers (id, name, contact, category, notes) VALUES (?, ?, ?, ?, ?)').run(id, name, contact, category, notes);
    return rowById('suppliers', id);
  });
  ipcMain.handle('suppliers:delete', (_event, id: string) => {
    getDatabase().prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('reports:export-pdf', async (_event, request?: PdfExportRequest) => {
    if (!mainWindow) return false;
    const safeTitle = String(request?.title || 'Herdly Report')
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    const saveOptions: SaveDialogOptions = {
      title: 'Export report as PDF',
      defaultPath: `${safeTitle || 'Herdly Report'}.pdf`,
      filters: [{ name: 'PDF document', extensions: ['pdf'] }],
    };
    const result = await dialog.showSaveDialog(mainWindow, saveOptions);
    if (result.canceled || !result.filePath) return false;

    const pdf = await mainWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margins: {
        marginType: 'custom',
        top: 0.4,
        bottom: 0.4,
        left: 0.35,
        right: 0.35,
      },
    });
    fs.writeFileSync(result.filePath, pdf);
    getDatabase()
      .prepare(
        `INSERT INTO reports_log
          (id, report_type, title, date_range_start, date_range_end, filters_json, generated_at, exported_file_path, notes)
         VALUES
          (@id, @report_type, @title, @date_range_start, @date_range_end, @filters_json, @generated_at, @exported_file_path, @notes)`,
      )
      .run({
        id: createId(),
        report_type: request?.reportType || 'report',
        title: request?.title || 'Herdly report',
        date_range_start: request?.dateRangeStart || null,
        date_range_end: request?.dateRangeEnd || null,
        filters_json: request?.filters ? JSON.stringify(request.filters) : null,
        generated_at: new Date().toISOString(),
        exported_file_path: result.filePath,
        notes: request?.notes || null,
      });
    return true;
  });

  ipcMain.handle('backup:export', async () => {
    const database = getDatabase();
    const backup = Object.fromEntries(tables.map((table) => [table, database.prepare(`SELECT * FROM ${table}`).all()]));
    const payload = JSON.stringify({ exported_at: new Date().toISOString(), ...backup }, null, 2);
    const saveOptions: SaveDialogOptions = {
      title: 'Export Herdly backup',
      defaultPath: `herdly-backup-${today()}.json`,
      filters: [{ name: 'JSON backup', extensions: ['json'] }],
    };
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, saveOptions) : await dialog.showSaveDialog(saveOptions);
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, payload, 'utf8');
    return true;
  });

  ipcMain.handle('backup:import', async () => {
    const openOptions: OpenDialogOptions = {
      title: 'Import Herdly backup',
      properties: ['openFile'],
      filters: [{ name: 'JSON backup', extensions: ['json'] }],
    };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, openOptions) : await dialog.showOpenDialog(openOptions);
    if (result.canceled || result.filePaths.length === 0) return false;
    const payload = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')) as Record<string, Row[]>;
    const database = getDatabase();
    database.transaction(() => {
      tables.forEach((table) => database.prepare(`DELETE FROM ${table}`).run());
      (payload.settings || []).forEach((row) =>
        database.prepare('INSERT INTO settings (key, value) VALUES (@key, @value)').run(row),
      );
      (payload.farms || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO farms (id, farm_name, owner_name, phone, location, currency, created_at, updated_at)
             VALUES (@id, @farm_name, @owner_name, @phone, @location, @currency, @created_at, @updated_at)`,
          )
          .run(row),
      );
      (payload.app_settings || []).forEach((row) =>
        database
          .prepare('INSERT INTO app_settings (id, key, value, created_at, updated_at) VALUES (@id, @key, @value, @created_at, @updated_at)')
          .run(row),
      );
      (payload.enabled_species || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO enabled_species (id, species_key, species_name, tracking_type, enabled, created_at, updated_at)
             VALUES (@id, @species_key, @species_name, @tracking_type, @enabled, @created_at, @updated_at)`,
          )
          .run(row),
      );
      (payload.product_prices || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO product_prices (id, product_key, product_name, unit, default_price, enabled, created_at, updated_at)
             VALUES (@id, @product_key, @product_name, @unit, @default_price, @enabled, @created_at, @updated_at)`,
          )
          .run(row),
      );
      (payload.gestation_settings || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO gestation_settings (id, species_key, species_name, gestation_days, created_at, updated_at)
             VALUES (@id, @species_key, @species_name, @gestation_days, @created_at, @updated_at)`,
          )
          .run(row),
      );
      (payload.animals || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO animals (id, name, tag, species, breed, dob, sex, status, purchase_cost, notes, created_at)
             VALUES (@id, @name, @tag, @species, @breed, @dob, @sex, @status, @purchase_cost, @notes, @created_at)`,
          )
          .run(row),
      );
      (payload.flocks || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO flocks (id, name, species, breed, start_date, initial_count, current_count, status, purchase_cost, notes)
             VALUES (@id, @name, @species, @breed, @start_date, @initial_count, @current_count, @status, @purchase_cost, @notes)`,
          )
          .run(row),
      );
      (payload.farm_events || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO farm_events (id, subject_id, subject_type, species, event_type, date, title, vet, cost, notes)
             VALUES (@id, @subject_id, @subject_type, @species, @event_type, @date, @title, @vet, @cost, @notes)`,
          )
          .run(row),
      );
      (payload.production_logs || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO production_logs (id, subject_id, subject_type, species, product, date, quantity, unit)
             VALUES (@id, @subject_id, @subject_type, @species, @product, @date, @quantity, @unit)`,
          )
          .run(row),
      );
      (payload.inventory || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO inventory (id, name, category, species, quantity, unit, reorder_level, total_cost, supplier, last_updated)
             VALUES (@id, @name, @category, @species, @quantity, @unit, @reorder_level, @total_cost, @supplier, @last_updated)`,
          )
          .run(row),
      );
      (payload.sales || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO sales (id, product, date, species, subject_id, quantity, unit, unit_price, buyer, notes)
             VALUES (@id, @product, @date, @species, @subject_id, @quantity, @unit, @unit_price, @buyer, @notes)`,
          )
          .run(row),
      );
      (payload.expenses || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO expenses (id, date, category, species, subject_id, amount, description)
             VALUES (@id, @date, @category, @species, @subject_id, @amount, @description)`,
          )
          .run(row),
      );
      (payload.buyers || []).forEach((row) => {
        database.prepare('INSERT INTO buyers (id, name, contact, product_type, notes) VALUES (@id, @name, @contact, @product_type, @notes)').run({
          id: row.id,
          name: row.name,
          contact: row.contact ?? '',
          product_type: row.product_type ?? '',
          notes: row.notes ?? '',
        });
      });
      (payload.vets || []).forEach((row) => {
        database.prepare('INSERT INTO vets (id, name, contact, clinic, notes) VALUES (@id, @name, @contact, @clinic, @notes)').run({
          id: row.id,
          name: row.name,
          contact: row.contact ?? '',
          clinic: row.clinic ?? '',
          notes: row.notes ?? '',
        });
      });
      (payload.suppliers || []).forEach((row) => {
        database.prepare('INSERT INTO suppliers (id, name, contact, category, notes) VALUES (@id, @name, @contact, @category, @notes)').run({
          id: row.id,
          name: row.name,
          contact: row.contact ?? '',
          category: row.category ?? '',
          notes: row.notes ?? '',
        });
      });
      (payload.reports_log || []).forEach((row) =>
        database
          .prepare(
            `INSERT INTO reports_log
              (id, report_type, title, date_range_start, date_range_end, filters_json, generated_at, exported_file_path, notes)
             VALUES
              (@id, @report_type, @title, @date_range_start, @date_range_end, @filters_json, @generated_at, @exported_file_path, @notes)`,
          )
          .run(row),
      );
    })();
    return true;
  });

  ipcMain.handle('demo:load', () => runSeed(true));
  ipcMain.handle('demo:clear', () => {
    const database = getDatabase();
    (['animals', 'flocks', 'farm_events', 'production_logs', 'inventory', 'sales', 'expenses', 'buyers', 'vets', 'suppliers'] as const).forEach((table) =>
      database.prepare(`DELETE FROM ${table}`).run(),
    );
    writeSetting(database, 'demo_data_loaded', 'false');
    return true;
  });
  ipcMain.handle('app:reset-data', () => {
    clearAllData(getDatabase());
    return true;
  });
}

app.whenReady().then(() => {
  getDatabase();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
