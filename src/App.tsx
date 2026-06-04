import { useState, useEffect, useMemo } from 'react';

// --- CONFIGURATION ---
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/h468f58mnljzr'; 
const MOM_CATEGORIES = ['Veg', 'New', 'Full', 'Old'];

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
};

type Zones = Record<string, Zone>;
type SheetRow = Record<string, string>;

type LayoutBlock = {
  id: string;
  rows: string[];
  getCols: (level: string) => Array<number | null>;
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
  plantedDate: zoneData.plantedDate || ''
});

const toQueryString = (data: SheetRow) => (
  Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&')
);

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
            notes: '', plantedDate: ''
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
                plantedDate: String(row.plantedDate || '')
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
          notes: '', plantedDate: ''
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

  const isSaving = syncStatus === 'saving';

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans p-1 sm:p-4 flex flex-col md:flex-row gap-2">
      
      {/* Left Column: The Map */}
      <div className="flex-1 max-w-5xl">
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
              <div className="px-2 py-1 bg-gray-900 rounded-md border border-gray-800 text-[10px]">
                {syncStatus === 'loading' || syncStatus === 'saving' ? '🔄' : '☁️'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {/* Detailed Total Veg Box */}
            <div className="bg-green-950/20 border border-green-800/30 p-2 rounded-lg flex flex-col">
              <div className="flex justify-between items-baseline mb-1">
                <p className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">Total Veg</p>
                <p className="text-xl font-black text-green-400 leading-none">{stats.totalVeg}</p>
              </div>
              <div className="flex flex-wrap gap-1 mt-auto">
                {Object.keys(stats.vegCounts).length > 0 ? (
                  Object.entries(stats.vegCounts).map(([strain, count]) => (
                    <div key={strain} className="flex items-center gap-1 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-500/20 max-w-full">
                      <span className="text-[9px] font-bold text-green-100 truncate">{strain}</span>
                      <span className="text-[9px] font-black text-green-400 shrink-0">{count}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[8px] text-gray-600 italic">None logged</span>
                )}
              </div>
            </div>

            {/* Detailed Mothers Box */}
            <div className="col-span-1 md:col-span-2 bg-purple-950/20 border border-purple-800/30 p-2 rounded-lg flex flex-col">
              <p className="text-[8px] font-bold text-purple-400 uppercase tracking-tighter mb-1.5">Mothers Detail (Veg/New/Full/Old)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(stats.motherStats).length > 0 ? (
                  Object.entries(stats.motherStats).map(([strain, categories]) => {
                    const breakdown = Object.entries(categories)
                      .map(([cat, count]) => `${count}${cat.charAt(0).toLowerCase()}`)
                      .join(' ');
                    
                    return (
                      <div key={strain} className="flex items-center gap-1.5 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-500/20 max-w-full">
                        <span className="text-[9px] font-bold text-purple-100 truncate">{strain}</span>
                        <span className="text-[9px] font-black text-purple-400 shrink-0">{breakdown}</span>
                      </div>
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
                      
                      let bg = empty ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-green-950 border-green-700 text-green-100';
                      if (!empty && hasMoms) bg = isMixed ? 'bg-gradient-to-br from-green-950 to-purple-950 border-purple-800' : 'bg-purple-950 border-purple-800 text-purple-100';

                      return (
                        <button
                          key={zoneId}
                          onClick={() => handleZoneClick(zoneId)}
                          className={`relative flex flex-col items-start p-0.5 min-h-[38px] sm:min-h-[90px] rounded-[2px] border transition-all text-left
                            ${bg} ${isSelected ? 'ring-1 ring-white z-10 scale-[1.03]' : ''}
                          `}
                        >
                          <div className="flex justify-between items-start w-full leading-none">
                            <span className="font-bold text-[9px] sm:text-xl">{slot}</span>
                            {!empty && hasMoms && <div className="w-1 h-1 rounded-full bg-purple-500"></div>}
                          </div>
                          
                          <div className="mt-auto w-full space-y-[1px]">
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

      {/* Right Column: Detail Panel */}
      <div className="w-full md:w-80 flex-shrink-0">
        <div className="bg-gray-900 rounded-lg border border-gray-800 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-2rem)] max-h-[800px]">
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
                    <button onClick={handleSave} disabled={isSaving} className="w-full py-2 bg-green-600 rounded-md font-bold text-sm shadow-lg active:scale-95 transition-transform">Save Details</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedZone.entries.map((e, i) => (e.strain || e.count > 0) && (
                      <div key={i} className={`flex justify-between items-center p-2 rounded border ${e.isMom ? 'bg-purple-950/40 border-purple-800' : 'bg-gray-950 border-gray-800'}`}>
                        <div>
                          <p className={`text-xs font-bold ${e.isMom ? 'text-purple-100' : 'text-white'}`}>{e.strain || 'Unknown'}</p>
                          {e.isMom && <p className="text-[9px] font-bold text-purple-400 uppercase">Mother • {e.momCategory || 'Veg'}</p>}
                        </div>
                        <span className={`text-lg font-black ${e.isMom ? 'text-purple-300' : 'text-green-400'}`}>{e.count}</span>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-gray-800 grid grid-cols-1 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">METRC Tag</p>
                        <p className="text-xs font-mono break-all text-blue-300">{selectedZone.metrc || 'None'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Planted Date</p>
                        <p className="text-xs text-gray-300">{selectedZone.plantedDate || 'N/A'}</p>
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
