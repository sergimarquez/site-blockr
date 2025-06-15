import { useEffect, useState } from 'react';

const STORAGE_KEY = 'blockedSites';

interface BlockedSites {
  sites: string[];
  isBlockingEnabled: boolean;
  focusMode?: {
    isActive: boolean;
    endTime?: number;
    duration?: number;
  };
  schedule?: {
    startTime: string;
    endTime: string;
    days: number[];
  };
}

const defaultSchedule = {
  startTime: '09:00',
  endTime: '17:00',
  days: [1, 2, 3, 4, 5] // Monday to Friday
};

function App() {
  const [sites, setSites] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isBlockingEnabled, setIsBlockingEnabled] = useState(true);
  const [focusMode, setFocusMode] = useState<BlockedSites['focusMode']>({ isActive: false });
  const [schedule, setSchedule] = useState<BlockedSites['schedule']>(defaultSchedule);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Load from chrome.storage
  useEffect(() => {
    chrome.storage.local.get(['blockedSites'], (result) => {
      const data = result.blockedSites || { sites: [], isBlockingEnabled: true };
      setSites(data.sites || []);
      setIsBlockingEnabled(data.isBlockingEnabled ?? true);
      setFocusMode(data.focusMode || { isActive: false });
      setSchedule(data.schedule || { startTime: '', endTime: '', days: [] });
    });
  }, []);

  // Update time left for focus mode
  useEffect(() => {
    if (focusMode?.isActive && focusMode.endTime) {
      const updateTimeLeft = () => {
        const remaining = focusMode.endTime! - Date.now();
        if (remaining > 0) {
          setTimeLeft(remaining);
        } else {
          setTimeLeft(null);
          setFocusMode({ isActive: false });
        }
      };

      updateTimeLeft();
      const interval = setInterval(updateTimeLeft, 1000);
      return () => clearInterval(interval);
    }
  }, [focusMode]);

  // Save to chrome.storage
  const updateStorage = (updates: Partial<BlockedSites>) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const currentData = result[STORAGE_KEY] as BlockedSites || {
        sites: [],
        isBlockingEnabled: true,
        focusMode: { isActive: false },
        schedule: defaultSchedule
      };
      const newData = { ...currentData, ...updates };
      chrome.storage.local.set({ [STORAGE_KEY]: newData });
    });
  };

  const toggleBlocking = () => {
    const newState = !isBlockingEnabled;
    setIsBlockingEnabled(newState);
    updateStorage({ isBlockingEnabled: newState });
  };

  const startFocusMode = (minutes: number) => {
    const endTime = Date.now() + minutes * 60 * 1000;
    const newFocusMode = {
      isActive: true,
      endTime,
      duration: minutes
    };
    setFocusMode(newFocusMode);
    updateStorage({ focusMode: newFocusMode, isBlockingEnabled: true });
  };

  const stopFocusMode = () => {
    const newFocusMode = { isActive: false };
    setFocusMode(newFocusMode);
    updateStorage({ focusMode: newFocusMode });
  };

  const updateSchedule = (updates: Partial<BlockedSites['schedule']>) => {
    if (!schedule) return;
    const newSchedule = { ...schedule, ...updates };
    setSchedule(newSchedule);
    updateStorage({ schedule: newSchedule });
  };

  const addSite = () => {
    if (!input.trim()) return;
    const newSites = [...new Set([...sites, input.trim()])];
    setSites(newSites);
    updateStorage({ sites: newSites });
    setInput('');
  };

  const removeSite = (site: string) => {
    const newSites = sites.filter(s => s !== site);
    setSites(newSites);
    updateStorage({ sites: newSites });
  };

  const formatTimeLeft = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">SiteBlockr Dashboard</h1>
      
      {/* Blocking Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 rounded">
        <span className="font-medium">Blocking Enabled</span>
        <button
          onClick={toggleBlocking}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isBlockingEnabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isBlockingEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Focus Mode */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h2 className="font-medium mb-2">Focus Mode</h2>
        {focusMode?.isActive ? (
          <div className="space-y-2">
            <div className="text-center text-lg font-bold">
              {timeLeft ? formatTimeLeft(timeLeft) : '0:00'}
            </div>
            <button
              onClick={stopFocusMode}
              className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Stop Focus Mode
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startFocusMode(25)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Focus 25m
            </button>
            <button
              onClick={() => startFocusMode(50)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Focus 50m
            </button>
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h2 className="font-medium mb-2">Schedule</h2>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <label className="w-20">Start:</label>
            <input
              type="time"
              value={schedule?.startTime}
              onChange={(e) => updateSchedule({ startTime: e.target.value })}
              className="flex-1 p-1 border rounded"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="w-20">End:</label>
            <input
              type="time"
              value={schedule?.endTime}
              onChange={(e) => updateSchedule({ endTime: e.target.value })}
              className="flex-1 p-1 border rounded"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <button
                key={day}
                onClick={() => {
                  const days = schedule?.days || [];
                  const newDays = days.includes(index)
                    ? days.filter(d => d !== index)
                    : [...days, index].sort();
                  updateSchedule({ days: newDays });
                }}
                className={`px-2 py-1 rounded ${
                  (schedule?.days || []).includes(index)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Site Management */}
      <div className="mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. twitter.com"
          className="w-full p-2 border rounded mb-2"
        />
        <button onClick={addSite} className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Site
        </button>
      </div>

      <ul className="space-y-2">
        {(sites || []).map(site => (
          <li key={site} className="flex justify-between items-center p-2 border-b">
            <span>{site}</span>
            <button onClick={() => removeSite(site)} className="text-red-500 hover:text-red-700">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
