import { useState, useEffect, useMemo } from 'react';

// --- CONFIGURATION ---
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/h468f58mnljzr'; 
const MOM_CATEGORIES = ['Veg', 'New', 'Full', 'Old'];
const DEFAULT_RUNOFF_PH = '5';
const DEFAULT_RUNOFF_EC = '3.0';

type MomCategory = (typeof MOM_CATEGORIES)[number];

type Entry = {
  strain: string;
  count: number;
  isMom: boolean;
  momCategory: MomCategory;
};

type Zone = {
  id: string;
  level: string;
  slot: number | string;
  metrc: string;
  entries: Entry[];
  notes: string;
  plantedDate: string;
  runoffPh: string;
  runoffEc: string;
  runoffMeasuredAt: string;
  runoffNotes: string;
};

type Zones = Record<string, Zone>;
type SheetRow = Record<string, string>;

type LayoutBlock = {
  id: string;
  rows: string[];
  getCols: (level: string) => Array<number | null>;
};

type HighlightTarget = {
  strain: string;
  kind: 'veg' | 'mom';
};

const emptyEntries = (): Entry[] => [
  { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
  { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
  { strain: '', count: 0, isMom: false, momCategory: 'Veg' }
];

const isSlotEmpty = (zone: Zone) => {
  if (!zone || !zone.entries) return true;
  return zone.entries.every(e => !e.strain && e.count === 0);
};

const formatSheetRow = (zoneData: Zone): SheetRow => ({
  id: zoneData.id,
  level: zoneData.level,
  slot: String(zoneData.slot),
  metrc: zoneData.metrc || '',
  strain1: zoneData.entries[0].strain || '',
  count1: String(zoneData.entries[0].count || 0),
  isMom1: zoneData.entries[0].isMom ? 'TRUE' : 'FALSE',
  momCategory1: zoneData.entries[0].momCategory || 'Veg',
  strain2: zoneData.entries[1].strain || '',
  count2: String(zoneData.entries[1].count || 0),
  isMom2: zoneData.entries[1].isMom ? 'TRUE' : 'FALSE',
  momCategory2: zoneData.entries[1].momCategory || 'Veg',
  strain3: zoneData.entries[2].strain || '',
  count3: String(zoneData.entries[2].count || 0),
  isMom3: zoneData.entries[2].isMom ? 'TRUE' : 'FALSE',
  momCategory3: zoneData.entries[2].momCategory || 'Veg',
  notes: zoneData.notes || '',
  plantedDate: zoneData.plantedDate || '',
  runoffPh: zoneData.runoffPh || '',
  runoffEc: zoneData.runoffEc || '',
  runoffMeasuredAt: zoneData.runoffMeasuredAt || '',
  runoffNotes: zoneData.runoffNotes || ''
});

const toQueryString = (data: SheetRow) => (
  Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&')
);

const toDateInputValue = (value: string) => {
  if (!value) return '';
  return value.split('T')[0];
};

const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const clampRunoffValue = (value: string) => {
  if (value === '') return '';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '';
  return String(Math.min(10, Math.max(0, numericValue)));
};

const zoneMatchesHighlight = (zone: Zone, highlight: HighlightTarget | null) => {
  if (!highlight) return false;
  const normalizedStrain = highlight.strain.trim().toLowerCase();
  return zone.entries.some(entry => {
    const matchesStrain = entry.strain.trim().toLowerCase() === normalizedStrain;
    if (!matchesStrain || entry.count <= 0) return false;
    return highlight.kind === 'mom' ? entry.isMom : !entry.isMom;
  });
};

// Define the exact layout from the provided image
const layoutBlocks: LayoutBlock[] = [
  {
    id: 'top-block',
    rows: ['C', 'B', 'A'],
    getCols: (level) => level === 'C' ? [31, 32, 33, 21, 22, 23] : [null, null, null, 21, 22, 23]
  },
  {
    id: 'middle-block',
    rows: ['C', 'B', 'A'],
    getCols: () => [null, null, null, 11, 12, 13]
  },
  {
    id: 'bottom-block',
    rows: ['C', 'B', 'A'],
    getCols: () => [1, 2, 3, 4, 5, 6]
  }
];

export default function App() {
  const initialZones: Zones = {};
  layoutBlocks.forEach(block => {
    block.rows.forEach(level => {
      block.getCols(level).forEach(slot => {
        if (slot !== null) {
          const id = `${level}-${slot}`;
          initialZones[id] = {
            id, level, slot, metrc: '',
            entries: emptyEntries(),
            notes: '', plantedDate: '',
            runoffPh: '', runoffEc: '', runoffMeasuredAt: '', runoffNotes: ''
          };
        }
      });
    });
  });

  const [zones, setZones] = useState(initialZones);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Zone | null>(null);
  const [showBulkClearConfirm, setShowBulkClearConfirm] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget | null>(null);
  
  const [syncStatus, setSyncStatus] = useState(SHEETDB_API_URL ? 'loading' : 'offline_demo');

  const stats = useMemo(() => {
    let totalVeg = 0;
    const vegCounts: Record<string, number> = {};
    const motherStats: Record<string, Record<string, number>> = {};

    Object.values(zones).forEach(zone => {
      zone.entries.forEach(entry => {
        const count = entry.count || 0;
        if (count > 0) {
          const name = (entry.strain || 'Unnamed').trim() || 'Unnamed';
          if (entry.isMom) {
            const cat = entry.momCategory || 'Veg';
            if (!motherStats[name]) motherStats[name] = {};
            motherStats[name][cat] = (motherStats[name][cat] || 0) + count;
          } else {
            totalVeg += count;
            vegCounts[name] = (vegCounts[name] || 0) + count;
          }
        }
      });
    });

    return { totalVeg, vegCounts, motherStats };
  }, [zones]);

  useEffect(() => {
    if (!SHEETDB_API_URL) return;

    const fetchSheetData = async () => {
      try {
        const baseUrl = SHEETDB_API_URL.replace(/\/$/, '');
        const response = await fetch(baseUrl);
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
          const loadedZones: Zones = {};
          data.forEach((row: Record<string, string | boolean>) => {
            if (row.id) {
              const id = String(row.id);
              loadedZones[id] = {
                id,
                level: String(row.level || ''),
                slot: parseInt(String(row.slot), 10) || String(row.slot || ''),
                metrc: String(row.metrc || ''),
                entries: [
                  { 
                    strain: String(row.strain1 || ''), 
                    count: Math.min(99, Math.max(0, parseInt(String(row.count1), 10) || 0)),
                    isMom: row.isMom1 === 'TRUE' || row.isMom1 === true,
                    momCategory: String(row.momCategory1 || 'Veg')
                  },
                  { 
                    strain: String(row.strain2 || ''), 
                    count: Math.min(99, Math.max(0, parseInt(String(row.count2), 10) || 0)),
                    isMom: row.isMom2 === 'TRUE' || row.isMom2 === true,
                    momCategory: String(row.momCategory2 || 'Veg')
                  },
                  { 
                    strain: String(row.strain3 || ''), 
                    count: Math.min(99, Math.max(0, parseInt(String(row.count3), 10) || 0)),
                    isMom: row.isMom3 === 'TRUE' || row.isMom3 === true,
                    momCategory: String(row.momCategory3 || 'Veg')
                  }
                ],
                notes: String(row.notes || ''),
                plantedDate: String(row.plantedDate || ''),
                runoffPh: String(row.runoffPh || ''),
                runoffEc: String(row.runoffEc || ''),
                runoffMeasuredAt: String(row.runoffMeasuredAt || ''),
                runoffNotes: String(row.runoffNotes || '')
              };
            }
          });
          setZones(prev => ({ ...prev, ...loadedZones }));
          setSyncStatus('success');
        }
      } catch {
        setSyncStatus('error');
      }
    };
    fetchSheetData();
  }, []);

  const saveZoneToSheetDB = async (zoneData: Zone) => {
    if (!SHEETDB_API_URL) return;
    setSyncStatus('saving');
    try {
      const baseUrl = SHEETDB_API_URL.replace(/\/$/, '');
      const formattedData = formatSheetRow(zoneData);
      const response = await fetch(`${baseUrl}/id/${encodeURIComponent(zoneData.id)}?${toQueryString(formattedData)}`, {
        method: 'PATCH',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error(`SheetDB save failed: ${response.status}`);
      setSyncStatus('success');
    } catch {
      setSyncStatus('error');
    }
  };

  const handleBulkClearVeg = async () => {
    setSyncStatus('saving');
    setShowBulkClearConfirm(false);
    const updatedZones = { ...zones };
    const itemsToUpdate: Zone[] = [];
    Object.keys(updatedZones).forEach(id => {
      const zone = updatedZones[id];
      if (zone.level === 'A' || zone.level === 'B') {
        const clearedZone = {
          ...zone, metrc: '',
          entries: emptyEntries(),
          notes: '', plantedDate: '',
          runoffPh: '', runoffEc: '', runoffMeasuredAt: '', runoffNotes: ''
        };
        updatedZones[id] = clearedZone;
        itemsToUpdate.push(clearedZone);
      }
    });
    setZones(updatedZones);
    if (SHEETDB_API_URL) {
      for (const zoneData of itemsToUpdate) {
        await saveZoneToSheetDB(zoneData);
      }
    }
  };

  const handleZoneClick = (zoneId: string) => {
    setSelectedZone(zones[zoneId]);
    setFormData(zones[zoneId]);
    setIsEditing(false);
  };

  const handleHighlightClick = (target: HighlightTarget) => {
    setHighlightTarget(prev => (
      prev && prev.kind === target.kind && prev.strain === target.strain ? null : target
    ));
  };

  const handleSave = () => {
    if (!formData) return;
    setZones(prev => ({ ...prev, [formData.id]: formData }));
    setSelectedZone(formData);
    setIsEditing(false);
    saveZoneToSheetDB(formData);
  };

  const handleEntryChange = (index: number, field: keyof Entry, value: string | boolean) => {
    if (!formData) return;
    const newEntries = [...formData.entries];
    const nextEntry = { ...newEntries[index] };
    if (field === 'count') {
      nextEntry.count = Math.min(99, Math.max(0, parseInt(String(value), 10) || 0));
    } else if (field === 'isMom') {
      nextEntry.isMom = Boolean(value);
    } else if (field === 'momCategory') {
      nextEntry.momCategory = String(value);
    } else {
      nextEntry.strain = String(value);
    }
    newEntries[index] = nextEntry;
    setFormData({ ...formData, entries: newEntries });
  };

  const handleZoneFieldChange = (field: keyof Zone, value: string) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: value });
  };

  const handleRunoffNumberChange = (field: 'runoffPh' | 'runoffEc', value: string) => {
    if (!formData) return;
    const nextValue = clampRunoffValue(value);
    const nextFormData = {
      ...formData,
      [field]: nextValue
    };
    if (field === 'runoffEc' && nextValue && !formData.runoffMeasuredAt) {
      nextFormData.runoffMeasuredAt = getTodayInputValue();
    }
    setFormData(nextFormData);
  };

  const ensureRunoffDefaults = () => {
    if (!formData) return;
    setFormData({
      ...formData,
      runoffPh: formData.runoffPh || DEFAULT_RUNOFF_PH,
      runoffEc: formData.runoffEc || DEFAULT_RUNOFF_EC
    });
  };

  const openDatePicker = (target: HTMLInputElement) => {
    if (typeof target.showPicker === 'function') {
      target.showPicker();
    }
  };

  const isSaving = syncStatus === 'saving';
  const syncLabel = syncStatus === 'loading' || syncStatus === 'saving' ? '...' : syncStatus === 'error' ? '!' : 'OK';
  const syncClass = syncStatus === 'error' ? 'bg-red-950/70 text-red-300 border-red-800' : 'bg-gray-900 border-gray-800';

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans p-1 sm:p-4 flex flex-col gap-2">
      
      {/* Map */}
      <div className="w-full">
        <header className="mb-2 sm:mb-6 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h1 className="text-lg sm:text-2xl font-bold text-green-400 flex items-center gap-2">
              <span className="text-xl">🗄️</span> Nursery Map
            </h1>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setShowBulkClearConfirm(true)}
                className="px-2 py-1 bg-red-900/40 text-red-400 border border-red-800/50 rounded-md text-[10px] font-bold uppercase"
              >
                Clear A/B
              </button>
              <div className={`px-2 py-1 rounded-md border text-[10px] font-bold ${syncClass}`}>
                {syncLabel}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {/* Detailed Total Veg Box */}
            <div className="bg-green-950/20 border border-green-800/30 p-2 rounded-lg flex flex-col min-w-0">
              <div className="flex items-baseline gap-1 mb-1">
                <p className="text-xl font-black text-green-400 leading-none">{stats.totalVeg}</p>
                <p className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">- Total Veg</p>
              </div>
              <div className="flex flex-col gap-0.5 mt-auto">
                {Object.keys(stats.vegCounts).length > 0 ? (
                  Object.entries(stats.vegCounts).sort(([a], [b]) => a.localeCompare(b)).map(([strain, count]) => {
                    const active = highlightTarget?.kind === 'veg' && highlightTarget.strain === strain;

                    return (
                    <button
                      key={strain}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleHighlightClick({ strain, kind: 'veg' })}
                      className={`grid grid-cols-[1fr_auto] items-center gap-1 px-1.5 py-0.5 rounded border max-w-full text-left transition-colors ${active ? 'bg-yellow-300 text-black border-yellow-200' : 'bg-green-900/30 border-green-500/20'}`}
                    >
                      <span className={`text-[9px] font-bold truncate ${active ? 'text-black' : 'text-green-100'}`}>{strain}</span>
                      <span className={`text-[9px] font-black shrink-0 ${active ? 'text-black' : 'text-green-400'}`}>{count}</span>
                    </button>
                    );
                  })
                ) : (
                  <span className="text-[8px] text-gray-600 italic">None logged</span>
                )}
              </div>
            </div>

            {/* Detailed Mothers Box */}
            <div className="bg-purple-950/20 border border-purple-800/30 p-2 rounded-lg flex flex-col min-w-0">
              <p className="text-[8px] font-bold text-purple-400 uppercase tracking-tighter mb-1.5">Mothers Detail (Veg/New/Full/Old)</p>
              <div className="flex flex-col gap-0.5">
                {Object.keys(stats.motherStats).length > 0 ? (
                  Object.entries(stats.motherStats).sort(([a], [b]) => a.localeCompare(b)).map(([strain, categories]) => {
                    const breakdown = MOM_CATEGORIES
                      .filter(cat => categories[cat])
                      .map(cat => `${categories[cat]}-${cat}`)
                      .join('/');
                    
                    return (
                      <button
                        key={strain}
                        type="button"
                        aria-pressed={highlightTarget?.kind === 'mom' && highlightTarget.strain === strain}
                        onClick={() => handleHighlightClick({ strain, kind: 'mom' })}
                        className={`grid grid-cols-[1fr_auto] items-center gap-1.5 px-1.5 py-0.5 rounded border max-w-full text-left transition-colors ${highlightTarget?.kind === 'mom' && highlightTarget.strain === strain ? 'bg-yellow-300 text-black border-yellow-200' : 'bg-purple-900/30 border-purple-500/20'}`}
                      >
                        <span className={`text-[9px] font-bold truncate ${highlightTarget?.kind === 'mom' && highlightTarget.strain === strain ? 'text-black' : 'text-purple-100'}`}>{strain}</span>
                        <span className={`text-[9px] font-black shrink-0 ${highlightTarget?.kind === 'mom' && highlightTarget.strain === strain ? 'text-black' : 'text-purple-400'}`}>{breakdown}</span>
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[8px] text-gray-600 italic">No Mothers logged</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* MAP CONTAINER - ULTRA COMPACT */}
        <div className="bg-gray-950 rounded-lg p-0.5 sm:p-4 border border-gray-900 overflow-x-auto relative">
          <div className={`min-w-[300px] sm:min-w-[700px] flex flex-col gap-0.5 sm:gap-6 transition-opacity ${syncStatus === 'loading' ? 'opacity-30' : 'opacity-100'}`}>
            {layoutBlocks.map((block) => (
              <div key={block.id} className="flex flex-col gap-[1px] sm:gap-2">
                {block.rows.map((level) => (
                  <div key={`${block.id}-${level}`} className="grid grid-cols-7 gap-[1px] sm:gap-2">
                    {block.getCols(level).map((slot, index) => {
                      if (slot === null) return <div key={`empty-${level}-${index}`} className="opacity-0" />;
                      const zoneId = `${level}-${slot}`;
                      const zone = zones[zoneId];
                      const isSelected = selectedZone?.id === zoneId;
                      const empty = isSlotEmpty(zone);
                      const hasMoms = zone.entries.some(e => e.isMom && e.count > 0);
                      const isMixed = hasMoms && zone.entries.some(e => !e.isMom && e.count > 0);
                      const hasRunoff = Boolean(zone.runoffPh || zone.runoffEc);
                      const isHighlighted = zoneMatchesHighlight(zone, highlightTarget);
                      
                      let bg = empty ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-green-950 border-green-700 text-green-100';
                      if (!empty && hasMoms) bg = isMixed ? 'bg-gradient-to-br from-green-950 to-purple-950 border-purple-800' : 'bg-purple-950 border-purple-800 text-purple-100';

                      return (
                        <button
                          key={zoneId}
                          onClick={() => handleZoneClick(zoneId)}
                          className={`relative flex flex-col items-start p-0.5 min-h-[38px] sm:min-h-[90px] rounded-[2px] border transition-all text-left
                            ${bg} ${isSelected ? 'ring-1 ring-white z-10 scale-[1.03]' : ''} ${isHighlighted ? 'ring-2 ring-yellow-300 border-yellow-300 shadow-[0_0_0_1px_rgba(253,224,71,0.85)] z-20' : ''}
                          `}
                        >
                          <div className="flex justify-between items-start w-full leading-none">
                            <span className="font-bold text-[9px] sm:text-xl">{slot}</span>
                            <div className="flex items-center gap-0.5">
                              {hasRunoff && <div className="w-1 h-1 rounded-full bg-yellow-300"></div>}
                              {!empty && hasMoms && <div className="w-1 h-1 rounded-full bg-purple-500"></div>}
                            </div>
                          </div>
                          
                          <div className="mt-auto w-full space-y-[1px]">
                            {hasRunoff && (
                              <div className="flex justify-between items-center text-[6px] sm:text-[9px] w-full bg-yellow-300 px-0.5 rounded-[1px] overflow-hidden leading-tight text-black">
                                <span className="truncate pr-0.5">RO</span>
                                <span className="font-black">
                                  {zone.runoffEc && `${zone.runoffEc}ec`}
                                  {zone.runoffEc && zone.runoffPh && ' '}
                                  {zone.runoffPh && `pH ${zone.runoffPh}`}
                                </span>
                              </div>
                            )}
                            {!empty ? zone.entries.map((entry, i) => (
                              (entry.strain || entry.count > 0) && (
                                <div key={i} className={`flex justify-between items-center text-[6px] sm:text-[10px] w-full bg-black/40 px-0.5 rounded-[1px] overflow-hidden leading-tight ${entry.isMom ? 'text-purple-300' : ''}`}>
                                  <span className="truncate pr-0.5">
                                    {entry.strain || 'Unk'}
                                    {entry.isMom && (
                                      <span className="opacity-80 ml-0.5 font-bold uppercase">
                                        -{entry.momCategory ? entry.momCategory.charAt(0).toLowerCase() : 'v'}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-black">{entry.count}</span>
                                </div>
                              )
                            )) : <div className="text-[5px] opacity-20 uppercase font-bold">MT</div>}
                          </div>
                        </button>
                      );
                    })}
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 sm:w-10 sm:h-10 bg-gray-900 rounded-sm flex items-center justify-center font-black text-[9px] sm:text-xl text-gray-600 border border-gray-800">
                        {level}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div className="w-full flex-shrink-0">
        <div className="bg-gray-900 rounded-lg border border-gray-800 shadow-xl overflow-hidden flex flex-col min-h-[260px]">
          {selectedZone ? (
            <>
              <div className="bg-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-green-400">{selectedZone.id}</h3>
                <button onClick={() => setIsEditing(!isEditing)} className="px-3 py-1 bg-gray-700 rounded-md text-xs">{isEditing ? 'Cancel' : 'Edit'}</button>
              </div>
              <div className="p-3 overflow-y-auto flex-1 space-y-4">
                {isEditing && formData ? (
                  <div className="space-y-4 pb-20">
                    {formData.entries.map((entry, index) => (
                      <div key={index} className="p-2 bg-black border border-gray-800 rounded-md space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-500">Entry {index+1}</span>
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <input type="checkbox" checked={entry.isMom} onChange={(e) => handleEntryChange(index, 'isMom', e.target.checked)} className="w-3 h-3" />
                            Mother
                          </label>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <input type="text" value={entry.strain} onChange={(e) => handleEntryChange(index, 'strain', e.target.value)} placeholder="Strain" className="col-span-3 bg-gray-900 p-1.5 rounded border border-gray-700 text-xs" />
                          <input type="number" value={entry.count} onChange={(e) => handleEntryChange(index, 'count', e.target.value)} className="bg-gray-900 p-1.5 rounded border border-gray-700 text-xs text-center" />
                        </div>
                        {entry.isMom && (
                          <div className="pt-1">
                            <label className="block text-[8px] font-bold text-purple-400 uppercase mb-0.5">Age / Category</label>
                            <select
                              value={entry.momCategory || 'Veg'}
                              onChange={(e) => handleEntryChange(index, 'momCategory', e.target.value)}
                              className="w-full bg-purple-900/40 border border-purple-700/50 rounded-md p-1.5 text-purple-100 text-[10px] outline-none"
                            >
                              {MOM_CATEGORIES.map(cat => (
                                <option key={cat} value={cat} className="bg-gray-900">{cat}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="p-2 bg-cyan-950/20 border border-cyan-800/50 rounded-md space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-cyan-300 uppercase">Runoff</span>
                        <span className="text-[9px] text-gray-500">Latest reading</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[8px] font-bold text-cyan-300 uppercase mb-0.5">EC</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10"
                            step="0.1"
                            value={formData.runoffEc || DEFAULT_RUNOFF_EC}
                            onFocus={ensureRunoffDefaults}
                            onChange={(e) => handleRunoffNumberChange('runoffEc', e.target.value)}
                            placeholder="EC"
                            className="w-full bg-gray-900 p-1.5 rounded border border-cyan-800/60 text-xs text-cyan-100"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[8px] font-bold text-cyan-300 uppercase mb-0.5">pH</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10"
                            step="0.1"
                            value={formData.runoffPh || DEFAULT_RUNOFF_PH}
                            onFocus={ensureRunoffDefaults}
                            onChange={(e) => handleRunoffNumberChange('runoffPh', e.target.value)}
                            placeholder="pH"
                            className="w-full bg-gray-900 p-1.5 rounded border border-cyan-800/60 text-xs text-cyan-100"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="block text-[8px] font-bold text-cyan-300 uppercase mb-0.5">Date</span>
                        <input
                          type="date"
                          value={toDateInputValue(formData.runoffMeasuredAt)}
                          onClick={(e) => {
                            ensureRunoffDefaults();
                            openDatePicker(e.currentTarget);
                          }}
                          onFocus={(e) => {
                            ensureRunoffDefaults();
                            openDatePicker(e.currentTarget);
                          }}
                          onChange={(e) => handleZoneFieldChange('runoffMeasuredAt', e.target.value)}
                          className="w-full bg-gray-900 p-1.5 rounded border border-cyan-800/60 text-xs text-cyan-100"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[8px] font-bold text-cyan-300 uppercase mb-0.5">Notes/Strain Sampled</span>
                        <input
                          type="text"
                          value={formData.runoffNotes}
                          onFocus={ensureRunoffDefaults}
                          onChange={(e) => handleZoneFieldChange('runoffNotes', e.target.value)}
                          placeholder="Runoff notes"
                          className="w-full bg-gray-900 p-1.5 rounded border border-cyan-800/60 text-xs text-cyan-100"
                        />
                      </label>
                    </div>
                    <button onClick={handleSave} disabled={isSaving} className="w-full py-2 bg-green-600 rounded-md font-bold text-sm shadow-lg active:scale-95 transition-transform">Save Details</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {selectedZone.entries.map((e, i) => (
                        <div key={i} className={`p-2 rounded border ${e.isMom ? 'bg-purple-950/40 border-purple-800' : e.strain || e.count > 0 ? 'bg-gray-950 border-gray-800' : 'bg-black/40 border-gray-800/70'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Entry {i + 1}</p>
                            <span className={`text-[9px] font-bold uppercase ${e.isMom ? 'text-purple-300' : 'text-green-400'}`}>
                              {e.isMom ? 'Mother' : 'Veg'}
                            </span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate ${e.isMom ? 'text-purple-100' : e.strain ? 'text-white' : 'text-gray-600'}`}>
                                {e.strain || 'Empty'}
                              </p>
                              <p className="text-[9px] font-bold text-gray-500 uppercase">
                                {e.isMom ? e.momCategory || 'Veg' : 'Plant count'}
                              </p>
                            </div>
                            <span className={`text-lg font-black ${e.isMom ? 'text-purple-300' : e.count > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                              {e.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 rounded border bg-cyan-950/20 border-cyan-800/50">
                      <div className="flex justify-between items-baseline mb-1">
                        <p className="text-[10px] text-cyan-300 uppercase font-bold">Runoff</p>
                        <p className="text-[9px] text-gray-500">{selectedZone.runoffMeasuredAt || 'No date'}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase font-bold">EC</p>
                          <p className="text-base font-black text-cyan-100">{selectedZone.runoffEc || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase font-bold">pH</p>
                          <p className="text-base font-black text-cyan-100">{selectedZone.runoffPh || '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[9px] text-gray-500 uppercase font-bold">Notes/Strain Sampled</p>
                          <p className="text-xs text-cyan-100/80 break-words">{selectedZone.runoffNotes || 'None'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">METRC Tag</p>
                        <p className="text-xs font-mono break-all text-blue-300">{selectedZone.metrc || 'None'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Planted Date</p>
                        <p className="text-xs text-gray-300">{selectedZone.plantedDate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Box Notes</p>
                        <p className="text-xs text-gray-300 break-words">{selectedZone.notes || 'None'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600 italic text-xs">Tap a slot</div>
          )}
        </div>
      </div>

      {showBulkClearConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 text-center">
          <div className="bg-gray-900 p-6 rounded-xl max-w-xs border border-red-900/50">
            <h4 className="text-lg font-bold text-white mb-2">Clear A & B?</h4>
            <p className="text-xs text-gray-400 mb-6">Wipe all non-mother slots (Veg rows)?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkClearConfirm(false)} className="flex-1 py-2 text-xs border border-gray-700 rounded">No</button>
              <button onClick={handleBulkClearVeg} className="flex-1 py-2 text-xs bg-red-600 rounded">Yes, Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
