import React, { useState, useEffect, useMemo } from 'react';

// --- CONFIGURATION ---
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/h468f58mnljzr';

const isSlotEmpty = (zone) => {
  if (!zone?.entries) return true;
  return zone.entries.every((e) => !e.strain && e.count === 0);
};

// Define the exact layout from the provided image
const layoutBlocks = [
  {
    id: 'top-block',
    rows: ['C', 'B', 'A'],
    getCols: (level) =>
      level === 'C' ? [31, 32, 33, 21, 22, 23] : [null, null, null, 21, 22, 23],
  },
  {
    id: 'middle-block',
    rows: ['C', 'B', 'A'],
    getCols: () => [null, null, null, 11, 12, 13],
  },
  {
    id: 'bottom-block',
    rows: ['C', 'B', 'A'],
    getCols: () => [1, 2, 3, 4, 5, 6],
  },
];

export default function App() {
  const initialZones = {};
  layoutBlocks.forEach((block) => {
    block.rows.forEach((level) => {
      block.getCols(level).forEach((slot) => {
        if (slot !== null) {
          const id = `${level}-${slot}`;
          initialZones[id] = {
            id,
            level,
            slot,
            metrc: '',
            entries: [
              { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
              { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
              { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
            ],
            notes: '',
            plantedDate: '',
          };
        }
      });
    });
  });

  const [zones, setZones] = useState(initialZones);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBulkClearConfirm, setShowBulkClearConfirm] = useState(false);

  const [syncStatus, setSyncStatus] = useState(
    SHEETDB_API_URL ? 'loading' : 'offline_demo'
  );

  // Calculate Stats for Dashboard
  const stats = useMemo(() => {
    let totalVeg = 0;
    const vegCounts = {};
    const motherStats = {};

    Object.values(zones).forEach((zone) => {
      zone.entries.forEach((entry) => {
        const count = parseInt(entry.count) || 0;
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
          const loadedZones = {};
          data.forEach((row) => {
            if (row.id) {
              loadedZones[row.id] = {
                id: row.id,
                level: row.level,
                slot: parseInt(row.slot) || row.slot,
                metrc: row.metrc || '',
                entries: [
                  {
                    strain: row.strain1 || '',
                    count: Math.min(99, Math.max(0, parseInt(row.count1) || 0)),
                    isMom: row.isMom1 === 'TRUE' || row.isMom1 === true,
                    momCategory: row.momCategory1 || 'Veg',
                  },
                  {
                    strain: row.strain2 || '',
                    count: Math.min(99, Math.max(0, parseInt(row.count2) || 0)),
                    isMom: row.isMom2 === 'TRUE' || row.isMom2 === true,
                    momCategory: row.momCategory2 || 'Veg',
                  },
                  {
                    strain: row.strain3 || '',
                    count: Math.min(99, Math.max(0, parseInt(row.count3) || 0)),
                    isMom: row.isMom3 === 'TRUE' || row.isMom3 === true,
                    momCategory: row.momCategory3 || 'Veg',
                  },
                ],
                notes: row.notes || '',
                plantedDate: row.plantedDate || '',
              };
            }
          });
          setZones((prev) => ({ ...prev, ...loadedZones }));
          setSyncStatus('success');
        } else if (Array.isArray(data) && data.length === 0) {
          // Initialize empty sheet
          const initialDataArray = Object.values(initialZones).map((z) => ({
            id: z.id,
            level: z.level,
            slot: z.slot,
            metrc: z.metrc,
            strain1: z.entries[0].strain,
            count1: z.entries[0].count,
            isMom1: z.entries[0].isMom,
            momCategory1: z.entries[0].momCategory,
            strain2: z.entries[1].strain,
            count2: z.entries[1].count,
            isMom2: z.entries[1].isMom,
            momCategory2: z.entries[1].momCategory,
            strain3: z.entries[2].strain,
            count3: z.entries[2].count,
            isMom3: z.entries[2].isMom,
            momCategory3: z.entries[2].momCategory,
            notes: z.notes,
            plantedDate: z.plantedDate,
          }));
          await fetch(baseUrl, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: initialDataArray }),
          });
          setSyncStatus('success');
        }
      } catch (error) {
        console.error('Error fetching from sheets:', error);
        setSyncStatus('error');
      }
    };
    fetchSheetData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveZoneToSheetDB = async (zoneData) => {
    if (!SHEETDB_API_URL) return;
    setSyncStatus('saving');
    try {
      const formattedData = {
        id: zoneData.id,
        level: zoneData.level,
        slot: zoneData.slot,
        metrc: zoneData.metrc,
        strain1: zoneData.entries[0].strain,
        count1: zoneData.entries[0].count,
        isMom1: zoneData.entries[0].isMom,
        momCategory1: zoneData.entries[0].momCategory,
        strain2: zoneData.entries[1].strain,
        count2: zoneData.entries[1].count,
        isMom2: zoneData.entries[1].isMom,
        momCategory2: zoneData.entries[1].momCategory,
        strain3: zoneData.entries[2].strain,
        count3: zoneData.entries[2].count,
        isMom3: zoneData.entries[2].isMom,
        momCategory3: zoneData.entries[2].momCategory,
        notes: zoneData.notes,
        plantedDate: zoneData.plantedDate,
      };
      const baseUrl = SHEETDB_API_URL.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/id/${zoneData.id}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [formattedData] }),
      });
      if (!response.ok && response.status === 400) {
        await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: [formattedData] }),
        });
      }
      setSyncStatus('success');
    } catch (error) {
      console.error('Failed to save:', error);
      setSyncStatus('error');
    }
  };

  const handleBulkClearVeg = async () => {
    setSyncStatus('saving');
    setShowBulkClearConfirm(false);

    const updatedZones = { ...zones };
    const itemsToUpdate = [];

    Object.keys(updatedZones).forEach((id) => {
      const zone = updatedZones[id];
      if (zone.level === 'A' || zone.level === 'B') {
        const clearedZone = {
          ...zone,
          metrc: '',
          entries: [
            { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
            { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
            { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
          ],
          notes: '',
          plantedDate: '',
        };
        updatedZones[id] = clearedZone;
        itemsToUpdate.push(clearedZone);
      }
    });

    setZones(updatedZones);
    if (
      selectedZone &&
      (selectedZone.level === 'A' || selectedZone.level === 'B')
    ) {
      setSelectedZone(updatedZones[selectedZone.id]);
      setFormData(updatedZones[selectedZone.id]);
    }

    if (SHEETDB_API_URL && itemsToUpdate.length > 0) {
      try {
        const baseUrl = SHEETDB_API_URL.replace(/\/$/, '');
        for (const zoneData of itemsToUpdate) {
          const formattedData = {
            id: zoneData.id,
            level: zoneData.level,
            slot: zoneData.slot,
            metrc: zoneData.metrc,
            strain1: zoneData.entries[0].strain,
            count1: zoneData.entries[0].count,
            isMom1: zoneData.entries[0].isMom,
            momCategory1: zoneData.entries[0].momCategory,
            strain2: zoneData.entries[1].strain,
            count2: zoneData.entries[1].count,
            isMom2: zoneData.entries[1].isMom,
            momCategory2: zoneData.entries[1].momCategory,
            strain3: zoneData.entries[2].strain,
            count3: zoneData.entries[2].count,
            isMom3: zoneData.entries[2].isMom,
            momCategory3: zoneData.entries[2].momCategory,
            notes: zoneData.notes,
            plantedDate: zoneData.plantedDate,
          };
          await fetch(`${baseUrl}/id/${zoneData.id}`, {
            method: 'PUT',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: [formattedData] }),
          });
        }
        setSyncStatus('success');
      } catch (error) {
        console.error('Failed to bulk clear:', error);
        setSyncStatus('error');
      }
    } else {
      setSyncStatus('offline_demo');
    }
  };

  const confirmClearSlot = () => {
    const clearedZone = {
      ...selectedZone,
      metrc: '',
      entries: [
        { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
        { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
        { strain: '', count: 0, isMom: false, momCategory: 'Veg' },
      ],
      notes: '',
      plantedDate: '',
    };
    setZones((prev) => ({ ...prev, [selectedZone.id]: clearedZone }));
    setSelectedZone(clearedZone);
    setFormData(clearedZone);
    setIsEditing(false);
    setShowClearConfirm(false);
    saveZoneToSheetDB(clearedZone);
  };

  const handleZoneClick = (zoneId) => {
    setSelectedZone(zones[zoneId]);
    setFormData(zones[zoneId]);
    setIsEditing(false);
    setShowClearConfirm(false);
  };

  const handleSave = () => {
    setZones((prev) => ({ ...prev, [formData.id]: formData }));
    setSelectedZone(formData);
    setIsEditing(false);
    saveZoneToSheetDB(formData);
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...formData.entries];
    if (field === 'count') {
      // Force value to be a number between 0 and 99
      value = Math.min(99, Math.max(0, parseInt(value) || 0));
    }
    newEntries[index] = { ...newEntries[index], [field]: value };
    setFormData({ ...formData, entries: newEntries });
  };

  const isSaving = syncStatus === 'saving';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 sm:p-8 flex flex-col md:flex-row gap-6">
      {/* Left Column: The Map */}
      <div className="flex-1 max-w-5xl">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-green-400 flex items-center gap-3">
                <span className="text-3xl">🗄️</span>
                Nursery Room Layout
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBulkClearConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800/50 rounded-lg shadow transition-colors text-sm font-semibold"
              >
                <span className="text-sm">🗑️</span> Clear Levels A & B
              </button>

              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-lg border border-gray-800 shadow">
                {syncStatus === 'offline_demo' && (
                  <>
                    <span className="text-sm">⚠️</span>
                    <span className="text-sm font-medium text-yellow-500">
                      Demo Mode
                    </span>
                  </>
                )}
                {syncStatus === 'loading' && (
                  <>
                    <span className="text-sm animate-spin inline-block">
                      🔄
                    </span>
                    <span className="text-sm font-medium text-blue-400">
                      Loading...
                    </span>
                  </>
                )}
                {syncStatus === 'saving' && (
                  <>
                    <span className="text-sm animate-spin inline-block">
                      🔄
                    </span>
                    <span className="text-sm font-medium text-blue-400">
                      Saving...
                    </span>
                  </>
                )}
                {syncStatus === 'success' && (
                  <>
                    <span className="text-sm">☁️</span>
                    <span className="text-sm font-medium text-green-400">
                      Cloud Synced
                    </span>
                  </>
                )}
                {syncStatus === 'error' && (
                  <>
                    <span className="text-sm">🔌</span>
                    <span className="text-sm font-medium text-red-500">
                      Sync Error
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 bg-green-950/20 border border-green-800/30 p-4 rounded-xl shadow-lg flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">
                  Total Veg Plants
                </p>
                <p className="text-4xl font-black text-green-400 mb-3">
                  {stats.totalVeg}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.vegCounts).length > 0 ? (
                    Object.entries(stats.vegCounts).map(([strain, count]) => (
                      <div
                        key={strain}
                        className="bg-green-900/20 border border-green-500/20 px-2 py-0.5 rounded flex items-center gap-1.5"
                      >
                        <span className="text-[10px] font-medium text-green-100">
                          {strain}
                        </span>
                        <span className="text-[10px] font-black text-green-400">
                          {count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-gray-500 italic">
                      No plants logged.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-purple-950/20 border border-purple-800/30 p-4 rounded-xl shadow-lg flex flex-col">
              <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">
                Mothers by Strain & Age
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.motherStats).length > 0 ? (
                  Object.entries(stats.motherStats).map(
                    ([strain, categories]) => {
                      const breakdown = Object.entries(categories)
                        .map(([cat, count]) => `${count} ${cat}`)
                        .join(', ');

                      return (
                        <div
                          key={strain}
                          className="bg-purple-900/40 border border-purple-500/30 px-3 py-2 rounded-lg flex items-baseline gap-2"
                        >
                          <span className="text-sm font-bold text-purple-100">
                            {strain}
                          </span>
                          <span className="text-xs font-medium text-purple-300 opacity-90">
                            {breakdown}
                          </span>
                        </div>
                      );
                    }
                  )
                ) : (
                  <p className="text-xs text-gray-500 italic py-1">
                    None logged.
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-xl overflow-x-auto relative">
          <div
            className={`min-w-[700px] flex flex-col gap-10 transition-opacity ${
              syncStatus === 'loading' ? 'opacity-30' : 'opacity-100'
            }`}
          >
            {layoutBlocks.map((block) => (
              <div key={block.id} className="flex flex-col gap-3">
                {block.rows.map((level) => (
                  <div
                    key={`${block.id}-${level}`}
                    className="grid grid-cols-7 gap-3"
                  >
                    {block.getCols(level).map((slot, index) => {
                      if (slot === null)
                        return (
                          <div
                            key={`empty-${level}-${index}`}
                            className="opacity-0"
                          />
                        );

                      const zoneId = `${level}-${slot}`;
                      const zone = zones[zoneId];
                      const isSelected = selectedZone?.id === zoneId;
                      const empty = isSlotEmpty(zone);

                      const hasMoms = zone.entries.some(
                        (e) => e.isMom && e.count > 0
                      );
                      const isMixed =
                        hasMoms &&
                        zone.entries.some((e) => !e.isMom && e.count > 0);

                      let bgClass = empty
                        ? 'bg-gray-800 border-gray-700 text-gray-400'
                        : 'bg-green-950 border-green-700 text-green-100';
                      if (!empty && hasMoms) {
                        bgClass = isMixed
                          ? 'bg-gradient-to-br from-green-950 to-purple-950 border-purple-700 text-green-100'
                          : 'bg-purple-950 border-purple-700 text-purple-100';
                      }

                      return (
                        <button
                          key={zoneId}
                          onClick={() => handleZoneClick(zoneId)}
                          disabled={syncStatus === 'loading'}
                          className={`relative flex flex-col items-start p-3 min-h-[90px] rounded-lg border-2 transition-all duration-200 text-left
                            ${bgClass} 
                            ${
                              isSelected
                                ? 'ring-4 ring-white z-10 shadow-lg scale-105'
                                : 'hover:opacity-90'
                            }
                            ${
                              syncStatus === 'loading'
                                ? 'cursor-not-allowed'
                                : 'cursor-pointer'
                            }
                          `}
                        >
                          <div className="flex justify-between items-start w-full mb-1">
                            <span className="font-bold text-xl tracking-wider leading-none">
                              {slot}
                            </span>
                            {!empty && hasMoms && (
                              <div
                                className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                                title="Contains Mothers"
                              ></div>
                            )}
                            {!empty && !hasMoms && (
                              <span className="opacity-50 text-sm">🌿</span>
                            )}
                          </div>

                          <div className="mt-auto w-full space-y-1">
                            {!empty ? (
                              zone.entries.map(
                                (entry, i) =>
                                  (entry.strain || entry.count > 0) && (
                                    <div
                                      key={i}
                                      className="flex justify-between items-center font-medium text-[10px] w-full bg-black/40 px-1.5 py-0.5 rounded overflow-hidden"
                                    >
                                      <span
                                        className={`truncate pr-2 ${
                                          entry.isMom
                                            ? 'text-purple-300 font-bold'
                                            : ''
                                        }`}
                                      >
                                        {entry.isMom && '★ '}
                                        {entry.strain || 'Unnamed'}
                                      </span>
                                      <span
                                        className={`${
                                          entry.isMom
                                            ? 'text-purple-400'
                                            : 'text-green-400'
                                        } font-black`}
                                      >
                                        {entry.count}
                                      </span>
                                    </div>
                                  )
                              )
                            ) : (
                              <div className="text-[10px] opacity-40 uppercase tracking-widest mt-1 font-bold">
                                Empty
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    <div className="flex items-center justify-center">
                      <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center font-black text-2xl text-gray-500 shadow-inner border border-gray-700/50">
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

      {/* Right Column: Detail / Edit Panel */}
      <div className="w-full md:w-96 flex-shrink-0">
        <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl sticky top-8 overflow-hidden flex flex-col h-[calc(100vh-4rem)] max-h-[850px] relative">
          {selectedZone ? (
            <>
              <div className="bg-gray-800 p-5 border-b border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-green-400">
                      Slot {selectedZone.slot}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                    Level {selectedZone.level}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isEditing && !isSlotEmpty(selectedZone) && (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="p-2.5 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 border border-gray-700 rounded-lg transition-colors shadow"
                      title="Clear Slot Data"
                    >
                      <span className="text-lg">🗑️</span>
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white shadow"
                      title="Edit Zone"
                    >
                      <span className="text-lg">✏️</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {isEditing ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-gray-300 border-b border-gray-800 pb-2">
                        Strains & Counts
                      </label>
                      {formData.entries.map((entry, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border transition-colors ${
                            entry.isMom
                              ? 'bg-purple-950/20 border-purple-800/50'
                              : 'bg-gray-950 border-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 border-b border-gray-800/50 pb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                              Entry {index + 1}
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={entry.isMom}
                                onChange={(e) =>
                                  handleEntryChange(
                                    index,
                                    'isMom',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-600 bg-gray-800 cursor-pointer"
                              />
                              <span
                                className={`text-xs font-bold uppercase tracking-wide transition-colors ${
                                  entry.isMom
                                    ? 'text-purple-400'
                                    : 'text-gray-500 group-hover:text-gray-400'
                                }`}
                              >
                                Is Mother
                              </span>
                            </label>
                          </div>

                          <div className="grid grid-cols-4 gap-3 mb-3">
                            <div className="col-span-3">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                Strain Name
                              </label>
                              <input
                                type="text"
                                value={entry.strain}
                                onChange={(e) =>
                                  handleEntryChange(
                                    index,
                                    'strain',
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Blue Dream"
                                className={`w-full border rounded-lg p-2.5 text-white outline-none text-sm transition-all ${
                                  entry.isMom
                                    ? 'bg-purple-900/20 border-purple-700/50 focus:ring-2 focus:ring-purple-500'
                                    : 'bg-gray-900 border-gray-700 focus:ring-2 focus:ring-green-500'
                                }`}
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                Count
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={entry.count}
                                onChange={(e) =>
                                  handleEntryChange(
                                    index,
                                    'count',
                                    e.target.value
                                  )
                                }
                                className={`w-full border rounded-lg p-2.5 text-white outline-none text-sm transition-all ${
                                  entry.isMom
                                    ? 'bg-purple-900/20 border-purple-700/50 focus:ring-2 focus:ring-purple-500'
                                    : 'bg-gray-900 border-gray-700 focus:ring-2 focus:ring-green-500'
                                }`}
                              />
                            </div>
                          </div>

                          {entry.isMom && (
                            <div className="pt-1 animate-in fade-in slide-in-from-top-1">
                              <label className="block text-[10px] font-bold text-purple-400 uppercase mb-1">
                                Age / Category
                              </label>
                              <select
                                value={entry.momCategory || 'Veg'}
                                onChange={(e) =>
                                  handleEntryChange(
                                    index,
                                    'momCategory',
                                    e.target.value
                                  )
                                }
                                className="w-full bg-purple-900/40 border border-purple-700/50 rounded-lg p-2.5 text-purple-100 focus:ring-2 focus:ring-purple-500 outline-none text-sm cursor-pointer"
                              >
                                <option value="Veg">Veg</option>
                                <option value="New">New</option>
                                <option value="Old">Old</option>
                                <option value="Full">Full</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <span>🏷️</span> Box METRC Tag #
                      </label>
                      <input
                        type="text"
                        value={formData.metrc || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, metrc: e.target.value })
                        }
                        placeholder="e.g. 1A40603000..."
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none font-mono [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <span>📅</span> Planted Date
                      </label>
                      <input
                        type="date"
                        value={formData.plantedDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            plantedDate: e.target.value,
                          })
                        }
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">
                        Notes
                      </label>
                      <textarea
                        rows="4"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Nutrients, issues, etc."
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {!isSlotEmpty(selectedZone) ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">
                            Planted Strains
                          </p>
                          {selectedZone.entries.map(
                            (entry, index) =>
                              (entry.strain || entry.count > 0) && (
                                <div
                                  key={index}
                                  className={`flex justify-between items-center p-3.5 rounded-lg border transition-all ${
                                    entry.isMom
                                      ? 'bg-purple-950/40 border-purple-800 shadow-inner'
                                      : 'bg-gray-950 border-gray-800'
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    {entry.isMom && (
                                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-0.5">
                                        Mother • {entry.momCategory || 'Veg'}
                                      </span>
                                    )}
                                    <span
                                      className={`text-lg font-medium ${
                                        entry.isMom
                                          ? 'text-purple-100'
                                          : 'text-white'
                                      }`}
                                    >
                                      {entry.strain || 'Unnamed Strain'}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-lg font-bold px-3 py-1 rounded-md ${
                                      entry.isMom
                                        ? 'text-purple-300 bg-purple-500/20 border border-purple-500/10'
                                        : 'text-green-400 bg-green-400/10 border border-green-400/10'
                                    }`}
                                  >
                                    {entry.count} Plants
                                  </span>
                                </div>
                              )
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {selectedZone.metrc && (
                            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 col-span-2">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1.5">
                                <span>🏷️</span> METRC Tag #
                              </p>
                              <p className="text-sm font-mono font-medium text-blue-300 tracking-wide break-all">
                                {selectedZone.metrc}
                              </p>
                            </div>
                          )}
                          <div
                            className={`bg-gray-950 p-4 rounded-lg border border-gray-800 ${
                              !selectedZone.metrc ? 'col-span-2' : 'col-span-2'
                            }`}
                          >
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1.5">
                              <span>📅</span> Planted Date
                            </p>
                            <p className="text-lg font-medium">
                              {selectedZone.plantedDate || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {selectedZone.notes && (
                          <div className="border-t border-gray-800 pt-5">
                            <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-2">
                              <span className="text-sm">ℹ️</span> Notes
                            </p>
                            <p className="text-gray-300 bg-gray-950 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-800">
                              {selectedZone.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-56 text-gray-500 space-y-4 bg-gray-950/50 rounded-xl border border-dashed border-gray-800 mt-4">
                        <span className="text-5xl opacity-30">🧪</span>
                        <p className="text-center px-4">
                          This slot is currently empty.
                          <br />
                          Click the edit icon to log new plants.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="p-5 border-t border-gray-800 bg-gray-900 flex gap-3">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(selectedZone);
                    }}
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-lg border border-gray-600 hover:bg-gray-800 font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 py-3 flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg transition-colors disabled:opacity-70"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin inline-block text-lg">
                          🔄
                        </span>{' '}
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="text-lg">✅</span> Save Data
                      </>
                    )}
                  </button>
                </div>
              )}

              {showClearConfirm && (
                <div className="absolute inset-0 z-50 bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                  <div className="bg-red-500/10 p-4 rounded-full mb-4">
                    <span className="text-5xl">🗑️</span>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">
                    Clear Slot {selectedZone.slot}?
                  </h4>
                  <p className="text-gray-400 mb-8 text-sm max-w-[250px]">
                    This will permanently delete all strains, counts, and notes
                    from your database.
                  </p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      disabled={isSaving}
                      className="flex-1 py-3 rounded-lg border border-gray-600 hover:bg-gray-800 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmClearSlot}
                      disabled={isSaving}
                      className="flex-1 py-3 flex justify-center items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg transition-colors"
                    >
                      {isSaving ? (
                        <span className="animate-spin inline-block text-lg">
                          🔄
                        </span>
                      ) : (
                        'Clear Data'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
              <span className="text-7xl opacity-10 mb-6">🌿</span>
              <h3 className="text-xl font-medium text-gray-400 mb-2">
                No Slot Selected
              </h3>
              <p className="text-sm leading-relaxed max-w-[250px]">
                Click on any numbered slot on the map to view its details or log
                new plant data.
              </p>
            </div>
          )}
        </div>
      </div>

      {showBulkClearConfirm && (
        <div className="fixed inset-0 z-[100] bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md shadow-2xl relative">
            <div className="bg-red-500/10 p-4 rounded-full mb-6 mx-auto w-fit">
              <span className="text-5xl">⚠️</span>
            </div>
            <h4 className="text-2xl font-bold text-white mb-3">
              Clear Levels A & B?
            </h4>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">
              This action will wipe all strains, counts, METRC tags, and notes
              from{' '}
              <strong className="text-white">
                every slot on Level A and Level B
              </strong>
              . Level C (Top) will remain untouched.
              <br />
              <br />
              This cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowBulkClearConfirm(false)}
                disabled={isSaving}
                className="flex-1 py-3 rounded-lg border border-gray-600 hover:bg-gray-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkClearVeg}
                disabled={isSaving}
                className="flex-1 py-3 flex justify-center items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg transition-colors"
              >
                {isSaving ? (
                  <span className="animate-spin inline-block text-lg">🔄</span>
                ) : (
                  'Yes, Clear Them'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
