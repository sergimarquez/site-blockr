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
  const [inputError, setInputError] = useState('');
  const [isBlockingEnabled, setIsBlockingEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [quote, setQuote] = useState<{ content: string; author: string } | null>(null);

  // Fetch quote on component mount
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await fetch('https://zenquotes.io/api/random');
        const data = await response.json();
        console.log('ZenQuotes API response:', data); // Debug log
        if (Array.isArray(data) && data.length > 0) {
          setQuote({
            content: data[0].q,
            author: data[0].a
          });
        } else {
          setQuote({
            content: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
            author: "Stephen Covey"
          });
        }
      } catch (error) {
        console.error('Error fetching quote:', error); // Debug log
        setQuote({
          content: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
          author: "Stephen Covey"
        });
      }
    };

    fetchQuote();
  }, []);

  // Helper to handle async storage with loading/error/retry
  const withLoading = async (fn: () => Promise<void>, retryFn?: () => void) => {
    // Only show loading for operations that might take longer
    const shouldShowLoading = fn.toString().includes('getDynamicRules') || 
                            fn.toString().includes('updateDynamicRules');
    
    if (shouldShowLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      await fn();
      if (shouldShowLoading) {
        setLoading(false);
      }
    } catch (e: any) {
      if (shouldShowLoading) {
        setLoading(false);
      }
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
            isBlockingEnabled: true
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

  // Clean and validate URL
  const cleanUrl = (url: string): string => {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();
  };

  const isValidUrl = (url: string): boolean => {
    const cleanedUrl = cleanUrl(url);
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
    return domainRegex.test(cleanedUrl) && cleanedUrl.length > 0;
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
    
    const cleanedUrl = cleanUrl(input.trim());
    
    if (!isValidUrl(input.trim())) {
      setInputError('Please enter a valid website URL');
      return;
    }

    // Check if site already exists
    if (sites.some(site => site.url === cleanedUrl)) {
      setInputError('This site is already blocked');
      return;
    }

    const newSite = {
      url: cleanedUrl,
      category: guessCategory(cleanedUrl)
    };
    const newSites = [...sites, newSite];
    setSites(newSites);
    updateStorage({ sites: newSites }, () => {
      setInput('');
      setInputError('');
      toast.success(`Added ${cleanedUrl} to blocked sites`);
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

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    toast.success(`Switched to ${!isDarkMode ? 'dark' : 'light'} mode`);
  };

  // Clear input error when user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (inputError) setInputError('');
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
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 transition-opacity duration-200">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-solid"></div>
        </div>
      )}
      {/* Error Message with Retry */}
      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center z-50 transition-opacity duration-200">
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
        <h1 className="text-xl font-bold">SiteBlockr</h1>
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
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-white dark:bg-gray-700 rounded shadow">
            <div className="text-sm text-gray-600 dark:text-gray-300">Blocked Sites</div>
            <div className="text-2xl font-bold">{sites.filter(site => site.url.trim()).length}</div>
          </div>
          <div className={`p-2 rounded shadow ${
            isBlockingEnabled 
              ? 'bg-green-50 dark:bg-green-900/20' 
              : 'bg-slate-50 dark:bg-slate-900/20'
          }`}>
            <div className="text-sm text-gray-600 dark:text-gray-300">Status</div>
            <div className="text-2xl font-bold">
              {isBlockingEnabled ? 'Active' : 'Disabled'}
            </div>
          </div>
        </div>
      </div>

      {/* Blocking Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span className="font-medium">Blocking Enabled</span>
        <button
          onClick={toggleBlocking}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isBlockingEnabled 
              ? 'bg-blue-600' 
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 ease-in-out ${
              isBlockingEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Site Management */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && addSite()}
              placeholder="Enter site URL (e.g., facebook.com)"
              className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${
                inputError ? 'border-red-500 dark:border-red-400' : ''
              }`}
            />
            {inputError && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-1 animate-fade-in">
                {inputError}
              </p>
            )}
          </div>
          <button
            onClick={addSite}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Empty State */}
        {sites.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 animate-fade-in">
            <div className="text-4xl mb-2">🌐</div>
            <p className="text-sm">No sites blocked yet</p>
            <p className="text-xs mt-1">Add a website above to get started</p>
          </div>
        )}

        {/* Sites by Category */}
        {CATEGORIES.map(category => {
          const categorySites = sitesByCategory[category.id] || [];
          if (categorySites.length === 0) return null;

          return (
            <div key={category.id} className="mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`font-medium ${category.color} text-white px-2 py-1 rounded`}>
                  {category.name} ({categorySites.length})
                </h3>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  Remove All
                </button>
              </div>
              <div className="space-y-2">
                {categorySites.map((site) => (
                  <div
                    key={site.url}
                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded shadow animate-fade-in transition-all duration-200 hover:shadow-md"
                  >
                    <span className="truncate">{site.url}</span>
                    <button
                      onClick={() => removeSite(site)}
                      className="text-red-600 hover:text-red-700 transition-colors"
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

      {/* Daily Quote at the bottom */}
      {quote && (
        <div className="mt-8 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 transition-all duration-300 ease-in-out hover:shadow-md">
          <p className="text-sm italic text-gray-600 dark:text-gray-300 mb-1">"{quote.content}"</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-right">— {quote.author}</p>
        </div>
      )}

      {/* Personal Signature */}
      <div className="mt-6 flex items-center justify-center space-x-2 text-gray-400 dark:text-gray-500 text-xs">
        <span className="font-mono text-blue-500 dark:text-blue-400">{"</>"}</span>
        <span className="font-light tracking-wider text-gray-500 dark:text-gray-400">crafted with</span>
        <span className="text-red-400 animate-pulse">♥</span>
        <span className="font-light tracking-wider text-gray-500 dark:text-gray-400">by</span>
        <a 
          href="https://github.com/sergimarquez" 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-300"
        >
          @sergimarquez
        </a>
      </div>

      {/* Copyright */}
      <div className="mt-3 text-center text-xs">
        <p className="text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} SiteBlockr</p>
        <p className="mt-1">
          <a 
            href="https://sergimarquez.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-300"
          >
            Sergi Marquez
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
