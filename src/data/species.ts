import type { SpeciesKey, SpeciesModule } from '../types';

export const speciesModules: SpeciesModule[] = [
  {
    key: 'dairy_cattle',
    label: 'Dairy Cattle',
    icon: '🐄',
    mode: 'individual',
    production: ['milk', 'animal', 'manure'],
    events: ['health', 'vaccination', 'ai', 'birth', 'death', 'sale', 'note'],
  },
  {
    key: 'beef_cattle',
    label: 'Beef Cattle',
    icon: '🐂',
    mode: 'individual',
    production: ['animal', 'manure'],
    events: ['health', 'vaccination', 'birth', 'death', 'sale', 'note'],
  },
  {
    key: 'goats',
    label: 'Goats',
    icon: '🐐',
    mode: 'individual',
    production: ['milk', 'animal', 'manure'],
    events: ['health', 'vaccination', 'birth', 'death', 'sale', 'note'],
  },
  {
    key: 'sheep',
    label: 'Sheep',
    icon: '🐑',
    mode: 'individual',
    production: ['wool', 'animal', 'manure'],
    events: ['health', 'vaccination', 'birth', 'death', 'sale', 'note'],
  },
  {
    key: 'layers',
    label: 'Layer Poultry',
    icon: '🐔',
    mode: 'batch',
    production: ['eggs', 'animal', 'manure'],
    events: ['health', 'vaccination', 'death', 'sale', 'note'],
  },
  {
    key: 'broilers',
    label: 'Broiler Poultry',
    icon: '🐥',
    mode: 'batch',
    production: ['animal', 'manure'],
    events: ['health', 'vaccination', 'death', 'sale', 'note'],
  },
  {
    key: 'pigs',
    label: 'Pigs',
    icon: '🐖',
    mode: 'individual',
    production: ['animal', 'meat', 'manure'],
    events: ['health', 'vaccination', 'birth', 'death', 'sale', 'note'],
  },
  {
    key: 'rabbits',
    label: 'Rabbits',
    icon: 'R',
    mode: 'batch',
    production: ['animal', 'meat', 'manure'],
    events: ['health', 'vaccination', 'birth', 'death', 'sale', 'note'],
  },
  {
    key: 'other',
    label: 'Other',
    icon: 'O',
    mode: 'individual',
    production: ['animal', 'other'],
    events: ['health', 'vaccination', 'birth', 'death', 'sale', 'note'],
  },
];

export const speciesByKey = speciesModules.reduce<Record<SpeciesKey, SpeciesModule>>(
  (acc, item) => {
    acc[item.key] = item;
    return acc;
  },
  {} as Record<SpeciesKey, SpeciesModule>,
);

export const allSpeciesKeys = speciesModules.map((species) => species.key);

export function speciesLabel(key?: SpeciesKey | null): string {
  return key ? speciesByKey[key]?.label ?? key : 'All species';
}
