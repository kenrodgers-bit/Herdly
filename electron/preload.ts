import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('herdly', {
  isSetupComplete: () => ipcRenderer.invoke('setup:is-complete'),
  completeSetup: (payload: unknown) => ipcRenderer.invoke('setup:complete', payload),

  getSettings: () => ipcRenderer.invoke('settings:get-all'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  setSpecies: (speciesArray: string[]) => ipcRenderer.invoke('settings:set-species', speciesArray),

  getAnimals: () => ipcRenderer.invoke('animals:get-all'),
  addAnimal: (animal: unknown) => ipcRenderer.invoke('animals:add', animal),
  updateAnimalStatus: (id: string, status: string) => ipcRenderer.invoke('animals:update-status', id, status),
  deleteAnimal: (id: string) => ipcRenderer.invoke('animals:delete', id),

  getFlocks: () => ipcRenderer.invoke('flocks:get-all'),
  addFlock: (flock: unknown) => ipcRenderer.invoke('flocks:add', flock),
  updateFlockCount: (id: string, count: number) => ipcRenderer.invoke('flocks:update-count', id, count),
  deleteFlock: (id: string) => ipcRenderer.invoke('flocks:delete', id),

  getEvents: () => ipcRenderer.invoke('events:get-all'),
  addEvent: (event: unknown) => ipcRenderer.invoke('events:add', event),
  deleteEvent: (id: string) => ipcRenderer.invoke('events:delete', id),

  getProduction: () => ipcRenderer.invoke('production:get-all'),
  addProduction: (log: unknown) => ipcRenderer.invoke('production:add', log),
  deleteProduction: (id: string) => ipcRenderer.invoke('production:delete', id),

  getInventory: () => ipcRenderer.invoke('inventory:get-all'),
  addInventory: (item: unknown) => ipcRenderer.invoke('inventory:add', item),
  updateInventoryQty: (id: string, quantity: number) => ipcRenderer.invoke('inventory:update-qty', id, quantity),
  deleteInventory: (id: string) => ipcRenderer.invoke('inventory:delete', id),

  getSales: () => ipcRenderer.invoke('sales:get-all'),
  addSale: (sale: unknown) => ipcRenderer.invoke('sales:add', sale),
  deleteSale: (id: string) => ipcRenderer.invoke('sales:delete', id),

  getExpenses: () => ipcRenderer.invoke('expenses:get-all'),
  addExpense: (expense: unknown) => ipcRenderer.invoke('expenses:add', expense),
  deleteExpense: (id: string) => ipcRenderer.invoke('expenses:delete', id),

  getBuyers: () => ipcRenderer.invoke('buyers:get-all'),
  addBuyer: (name: string, contact?: string, productType?: string, notes?: string) => ipcRenderer.invoke('buyers:add', name, contact, productType, notes),
  deleteBuyer: (id: string) => ipcRenderer.invoke('buyers:delete', id),

  getVets: () => ipcRenderer.invoke('vets:get-all'),
  addVet: (name: string, contact?: string, clinic?: string, notes?: string) => ipcRenderer.invoke('vets:add', name, contact, clinic, notes),
  deleteVet: (id: string) => ipcRenderer.invoke('vets:delete', id),

  getSuppliers: () => ipcRenderer.invoke('suppliers:get-all'),
  addSupplier: (name: string, contact?: string, category?: string, notes?: string) => ipcRenderer.invoke('suppliers:add', name, contact, category, notes),
  deleteSupplier: (id: string) => ipcRenderer.invoke('suppliers:delete', id),

  exportPdf: (request?: unknown) => ipcRenderer.invoke('reports:export-pdf', request),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  loadDemoData: () => ipcRenderer.invoke('demo:load'),
  clearDemoData: () => ipcRenderer.invoke('demo:clear'),
  resetAppData: () => ipcRenderer.invoke('app:reset-data'),
});
