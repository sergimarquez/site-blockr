import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const STORAGE_KEY = 'blockedSites';
const THEME_KEY = 'theme';

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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

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

  // Handle theme changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

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
    toast.success(`Blocking ${newState ? 'enabled' : 'disabled'}`);
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
    toast.success(`Focus mode started for ${minutes} minutes`);
  };

  const stopFocusMode = () => {
    const newFocusMode = { isActive: false };
    setFocusMode(newFocusMode);
    updateStorage({ focusMode: newFocusMode });
    toast.success('Focus mode stopped');
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
    toast.success(`Added ${input.trim()} to blocked sites`);
  };

  const removeSite = (site: string) => {
    const newSites = sites.filter(s => s !== site);
    setSites(newSites);
    updateStorage({ sites: newSites });
    toast.success(`Removed ${site} from blocked sites`);
  };

  const formatTimeLeft = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    toast.success(`Switched to ${!isDarkMode ? 'dark' : 'light'} mode`);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white',
          style: {
            background: isDarkMode ? '#1f2937' : '#fff',
            color: isDarkMode ? '#fff' : '#000',
          },
        }}
      />
      
      {/* Header with theme toggle */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">SiteBlockr Dashboard</h1>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-2xl hover:scale-110 transform duration-200"
          aria-label="Toggle theme"
        >
          {isDarkMode ? '🌞' : '🌙'}
        </button>
      </div>

      {/* Statistics Panel */}
      <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm">
        <h2 className="font-medium mb-2">Statistics</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-white dark:bg-gray-700 rounded shadow">
            <div className="text-sm text-gray-600 dark:text-gray-300">Blocked Sites</div>
            <div className="text-2xl font-bold">{sites.length}</div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-700 rounded shadow">
            <div className="text-sm text-gray-600 dark:text-gray-300">Status</div>
            <div className="text-2xl font-bold">
              {focusMode?.isActive ? 'Focus Mode' : isBlockingEnabled ? 'Active' : 'Disabled'}
            </div>
          </div>
        </div>
      </div>

      {/* Blocking Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span className="font-medium">Blocking Enabled</span>
        <button
          onClick={toggleBlocking}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isBlockingEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
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
      <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="font-medium mb-2">Focus Mode</h2>
        {focusMode?.isActive ? (
          <div className="space-y-2">
            <div className="text-center text-lg font-bold">
              {timeLeft ? formatTimeLeft(timeLeft) : '0:00'}
            </div>
            <button
              onClick={stopFocusMode}
              className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Stop Focus Mode
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startFocusMode(25)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Focus 25m
            </button>
            <button
              onClick={() => startFocusMode(50)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Focus 50m
            </button>
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="font-medium mb-2">Schedule</h2>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <label className="w-20">Start:</label>
            <input
              type="time"
              value={schedule?.startTime}
              onChange={(e) => updateSchedule({ startTime: e.target.value })}
              className="flex-1 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="w-20">End:</label>
            <input
              type="time"
              value={schedule?.endTime}
              onChange={(e) => updateSchedule({ endTime: e.target.value })}
              className="flex-1 p-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                className={`px-2 py-1 rounded transition-colors ${
                  (schedule?.days || []).includes(index)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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
          placeholder="Enter site to block (e.g., facebook.com)"
          className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <button 
          onClick={addSite} 
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Add Site
        </button>
      </div>

      <ul className="space-y-2">
        {(sites || []).map(site => (
          <li key={site} className="flex justify-between items-center p-2 border-b dark:border-gray-700">
            <span>{site}</span>
            <button 
              onClick={() => removeSite(site)} 
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
