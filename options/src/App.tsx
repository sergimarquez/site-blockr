import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const STORAGE_KEY = 'blockedSites';
const THEME_KEY = 'theme';

interface BlockedSites {
  sites: Array<{
    url: string;
    category: string;
  }>;
  isBlockingEnabled: boolean;
  focusMode?: {
    isActive: boolean;
    endTime?: number;
    duration?: number;
  };
}

const CATEGORIES = [
  { id: 'social', name: 'Social Media', color: 'bg-blue-500' },
  { id: 'entertainment', name: 'Entertainment', color: 'bg-purple-500' },
  { id: 'gaming', name: 'Gaming', color: 'bg-green-500' },
  { id: 'shopping', name: 'Shopping', color: 'bg-yellow-500' },
  { id: 'other', name: 'Other', color: 'bg-gray-500' }
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

function App() {
  const [sites, setSites] = useState<BlockedSites['sites']>([]);
  const [input, setInput] = useState('');
  const [isBlockingEnabled, setIsBlockingEnabled] = useState(true);
  const [focusMode, setFocusMode] = useState<BlockedSites['focusMode']>({ isActive: false });
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  // Helper to handle async storage with loading/error/retry
  const withLoading = async (fn: () => Promise<void>, retryFn?: () => void) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'An error occurred');
      setRetryAction(() => retryFn || fn);
    }
  };

  // Load from chrome.storage
  useEffect(() => {
    withLoading(
      () => new Promise<void>((resolve, reject) => {
        chrome.storage.local.get(['blockedSites'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          const data = result.blockedSites || { sites: [], isBlockingEnabled: true };
          setSites(data.sites || []);
          setIsBlockingEnabled(data.isBlockingEnabled ?? true);
          setFocusMode(data.focusMode || { isActive: false });
          
          // If no data exists, initialize storage
          if (!result.blockedSites) {
            chrome.storage.local.set({ blockedSites: data });
          }
          
          resolve();
        });
      }),
      () => window.location.reload()
    );
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
  const updateStorage = (updates: Partial<BlockedSites>, onSuccess?: () => void) => {
    withLoading(
      () => new Promise<void>((resolve, reject) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          const currentData = result[STORAGE_KEY] as BlockedSites || {
            sites: [],
            isBlockingEnabled: true,
            focusMode: { isActive: false }
          };
          const newData = { ...currentData, ...updates };
          chrome.storage.local.set({ [STORAGE_KEY]: newData }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve();
            if (onSuccess) onSuccess();
          });
        });
      }),
      () => updateStorage(updates, onSuccess)
    );
  };

  const toggleBlocking = () => {
    const newState = !isBlockingEnabled;
    setIsBlockingEnabled(newState);
    updateStorage({ isBlockingEnabled: newState }, () => {
      toast.success(`Blocking ${newState ? 'enabled' : 'disabled'}`);
    });
  };

  const startFocusMode = (minutes: number) => {
    const endTime = Date.now() + minutes * 60 * 1000;
    const newFocusMode = {
      isActive: true,
      endTime,
      duration: minutes
    };
    setFocusMode(newFocusMode);
    updateStorage({ focusMode: newFocusMode, isBlockingEnabled: true }, () => {
      toast.success(`Focus mode started for ${minutes} minutes`);
    });
  };

  const stopFocusMode = () => {
    const newFocusMode = { isActive: false };
    setFocusMode(newFocusMode);
    updateStorage({ focusMode: newFocusMode }, () => {
      toast.success('Focus mode stopped');
    });
  };

  function guessCategory(url: string): CategoryId {
    const domain = url.toLowerCase();
    if (/(facebook|twitter|instagram|tiktok|linkedin|reddit)/.test(domain)) return 'social';
    if (/(youtube|netflix|hulu|spotify|twitch|vimeo|primevideo)/.test(domain)) return 'entertainment';
    if (/(game|steam|epicgames|roblox|miniclip)/.test(domain)) return 'gaming';
    if (/(shop|amazon|ebay|aliexpress|etsy|walmart)/.test(domain)) return 'shopping';
    return 'other';
  }

  const addSite = () => {
    if (!input.trim()) return;
    const newSite = {
      url: input.trim(),
      category: guessCategory(input.trim())
    };
    const newSites = [...sites, newSite];
    setSites(newSites);
    updateStorage({ sites: newSites }, () => {
      setInput('');
      toast.success(`Added ${input.trim()} to blocked sites`);
    });
  };

  const removeSite = (site: BlockedSites['sites'][0]) => {
    const newSites = sites.filter(s => s.url !== site.url);
    setSites(newSites);
    updateStorage({ sites: newSites }, () => {
      toast.success(`Removed ${site.url} from blocked sites`);
    });
  };

  const toggleCategory = (categoryId: string) => {
    const newSites = sites.filter(site => site.category !== categoryId);
    setSites(newSites);
    updateStorage({ sites: newSites }, () => {
      toast.success(`Removed all sites from ${CATEGORIES.find(c => c.id === categoryId)?.name}`);
    });
  };

  // Group sites by category
  const sitesByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category.id] = sites.filter(site => site.category === category.id);
    return acc;
  }, {} as Record<string, BlockedSites['sites']>);

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
      {/* Loading Spinner Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-solid"></div>
        </div>
      )}
      {/* Error Message with Retry */}
      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow text-center">
            <div className="text-red-600 dark:text-red-400 mb-2 font-bold">{error}</div>
            {retryAction && (
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  retryAction();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      
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
            <div className="text-2xl font-bold">{sites.filter(site => site.url.trim()).length}</div>
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
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isBlockingEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isBlockingEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Site Management */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addSite()}
            placeholder="Enter site URL"
            className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <button
            onClick={addSite}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        {/* Sites by Category */}
        {CATEGORIES.map(category => {
          const categorySites = sitesByCategory[category.id] || [];
          if (categorySites.length === 0) return null;

          return (
            <div key={category.id} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`font-medium ${category.color} text-white px-2 py-1 rounded`}>
                  {category.name} ({categorySites.length})
                </h3>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove All
                </button>
              </div>
              <div className="space-y-2">
                {categorySites.map((site) => (
                  <div
                    key={site.url}
                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded shadow"
                  >
                    <span className="truncate">{site.url}</span>
                    <button
                      onClick={() => removeSite(site)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Focus Mode */}
      <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="font-medium mb-2">Focus Mode</h2>
        {focusMode?.isActive ? (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatTimeLeft(timeLeft!)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">remaining</div>
            </div>
            <button
              onClick={stopFocusMode}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Stop Focus Mode
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startFocusMode(25)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Focus 25m
            </button>
            <button
              onClick={() => startFocusMode(50)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Focus 50m
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
