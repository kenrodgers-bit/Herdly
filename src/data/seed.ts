import type { Animal, Expense, FarmEvent, Flock, InventoryItem, Sale, SpeciesKey } from '../types';

export const seedAnimals: Animal[] = [
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
];

export const seedFlocks: Flock[] = [
  {
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
  },
];

export function buildDatedSeed(today: string): {
  events: FarmEvent[];
  production: ProductionLogSeed[];
  inventory: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
} {
  return {
    events: [
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
    ],
    production: [
      {
        id: 'prod-bessie-milk',
        subject_id: 'animal-bessie',
        subject_type: 'individual',
        species: 'dairy_cattle',
        product: 'milk',
        date: today,
        quantity: 30,
        unit: 'litres',
      },
      {
        id: 'prod-nyota-milk',
        subject_id: 'animal-nyota',
        subject_type: 'individual',
        species: 'dairy_cattle',
        product: 'milk',
        date: today,
        quantity: 18,
        unit: 'litres',
      },
      {
        id: 'prod-layer-eggs',
        subject_id: 'flock-layer-house-a',
        subject_type: 'batch',
        species: 'layers',
        product: 'eggs',
        date: today,
        quantity: 168,
        unit: 'eggs',
      },
    ],
    inventory: [
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
        last_updated: today,
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
        last_updated: today,
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
        last_updated: today,
      },
    ],
    sales: [
      {
        id: 'sale-milk-local',
        product: 'milk',
        date: today,
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
        date: today,
        species: 'layers',
        subject_id: 'flock-layer-house-a',
        quantity: 3,
        unit: 'trays',
        unit_price: 450,
        buyer: 'Neighbour shop',
        notes: '',
      },
    ],
    expenses: [
      {
        id: 'expense-dairy-feed',
        date: today,
        category: 'feed',
        species: 'dairy_cattle',
        subject_id: null,
        amount: 7800,
        description: 'Dairy meal purchase',
      },
      {
        id: 'expense-layers-feed',
        date: today,
        category: 'feed',
        species: 'layers',
        subject_id: null,
        amount: 5200,
        description: 'Layers mash purchase',
      },
      {
        id: 'expense-layers-vet',
        date: today,
        category: 'vet',
        species: 'layers',
        subject_id: 'flock-layer-house-a',
        amount: 2400,
        description: 'Respiratory treatment',
      },
    ],
  };
}

type ProductionLogSeed = {
  id: string;
  subject_id: string;
  subject_type: 'individual' | 'batch';
  species: SpeciesKey;
  product: 'milk' | 'eggs';
  date: string;
  quantity: number;
  unit: string;
};
