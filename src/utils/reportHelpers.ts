import { speciesByKey, speciesModules } from '../data/species';
import type { FormDefinition, ProductType, SpeciesKey } from '../types';

export function farmProduces(enabledSpecies: SpeciesKey[], product: ProductType): boolean {
  return enabledSpecies.some((species) => speciesByKey[species]?.production.includes(product));
}

export function speciesProducing(enabledSpecies: SpeciesKey[], product: ProductType): SpeciesKey[] {
  return enabledSpecies.filter((species) => speciesByKey[species]?.production.includes(product));
}

export function hasIndividualAnimals(enabledSpecies: SpeciesKey[]): boolean {
  return enabledSpecies.some((species) => speciesByKey[species]?.mode === 'individual');
}

export function hasFlocks(enabledSpecies: SpeciesKey[]): boolean {
  return enabledSpecies.some((species) => speciesByKey[species]?.mode === 'batch');
}

export function hasReproduction(enabledSpecies: SpeciesKey[]): boolean {
  return enabledSpecies.some((species) => ['dairy_cattle', 'beef_cattle', 'goats', 'sheep', 'pigs', 'rabbits'].includes(species));
}

export function hasMilkProduction(enabledSpecies: SpeciesKey[]): boolean {
  return speciesProducing(enabledSpecies, 'milk').length > 0;
}

export function hasEggProduction(enabledSpecies: SpeciesKey[]): boolean {
  return enabledSpecies.includes('layers');
}

export function hasWoolProduction(enabledSpecies: SpeciesKey[]): boolean {
  return enabledSpecies.includes('sheep');
}

export function hasWeightTracking(enabledSpecies: SpeciesKey[]): boolean {
  return enabledSpecies.some((species) => ['beef_cattle', 'pigs', 'broilers', 'rabbits'].includes(species));
}

export function primarySaleUnit(species: SpeciesKey): string {
  const units: Record<SpeciesKey, string> = {
    dairy_cattle: 'litres',
    layers: 'eggs / trays',
    sheep: 'kg wool / animal',
    beef_cattle: 'animal',
    goats: 'animal / litres',
    pigs: 'animal',
    broilers: 'bird',
    rabbits: 'rabbit',
    other: 'unit',
  };
  return units[species];
}

export function productionSummaryLabels(enabledSpecies: SpeciesKey[]): string[] {
  const labels: string[] = [];
  if (hasMilkProduction(enabledSpecies)) labels.push('Total milk this month');
  if (hasEggProduction(enabledSpecies)) labels.push('Total eggs this month');
  if (hasWoolProduction(enabledSpecies)) labels.push('Total wool this month');
  if (hasWeightTracking(enabledSpecies)) labels.push('Total weight tracked this month');
  return labels;
}

export function adaptiveAnimalColumns(enabledSpecies: SpeciesKey[]): string[] {
  const columns = ['Name', 'Species'];
  if (hasMilkProduction(enabledSpecies)) columns.push('Milk (L)');
  if (hasEggProduction(enabledSpecies)) columns.push('Eggs');
  if (hasWoolProduction(enabledSpecies)) columns.push('Wool (kg)');
  if (hasWeightTracking(enabledSpecies)) columns.push('Weight (kg)');
  columns.push('Revenue (KSh)', 'Costs (KSh)', 'Net (KSh)');
  return columns;
}

export function activeFormsList(enabledSpecies: SpeciesKey[]): FormDefinition[] {
  void enabledSpecies;
  return [
    {
      id: 'milk-recording',
      title: 'Daily Milk Recording Sheet',
      description: 'Cow names are filled from Herdly; milk quantity fields stay blank for handwriting.',
    },
    {
      id: 'egg-collection',
      title: 'Egg Collection Sheet',
      description: 'Flock names are filled where available; egg count fields stay blank.',
    },
    {
      id: 'health-event',
      title: 'Health Event Sheet',
      description: 'Blank treatment sheet, with optional animal or flock pre-fill chosen by the admin.',
    },
    {
      id: 'feed-usage',
      title: 'Feed Usage Sheet',
      description: 'Blank feed and inventory issue sheet for daily store records.',
    },
    {
      id: 'sales-collection',
      title: 'Sales Collection Sheet',
      description: 'Manual sales receipt collection sheet for buyers, payments, and balances.',
    },
    {
      id: 'mortality-record',
      title: 'Mortality Record Sheet',
      description: 'Daily death, cause, and disposal record for animals or flocks.',
    },
    {
      id: 'general-activity',
      title: 'General Farm Activity Sheet',
      description: 'Open daily task sheet for cleaning, feeding, repairs, and observations.',
    },
  ];
}

export function enabledSpeciesModules(enabledSpecies: SpeciesKey[]) {
  return speciesModules.filter((species) => enabledSpecies.includes(species.key));
}
