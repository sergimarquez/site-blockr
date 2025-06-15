import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const STORAGE_KEY = 'blockedSites';
const THEME_KEY = 'theme';

interface BlockedSites {
  sites: Array<{
    url: string;
  }>;
  isBlockingEnabled: boolean;
}



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

  const cleanUrl = (url: string): string => {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();
  };

  const isValidUrl = (url: string): boolean => {
    const cleanedUrl = cleanUrl(url);
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
    return domainRegex.test(cleanedUrl) && cleanedUrl.length > 0;
  };



  const addSite = () => {
    if (!input.trim()) return;
    
    const cleanedUrl = cleanUrl(input.trim());
    
    if (!isValidUrl(input.trim())) {
      setInputError('Please enter a valid website URL');
      return;
    }

    if (sites.some(site => site.url === cleanedUrl)) {
      setInputError('This site is already blocked');
      return;
    }

    const newSite = {
      url: cleanedUrl
    };

    const newSites = [...sites, newSite];
    setSites(newSites);
    updateStorage({ sites: newSites }, () => {
      toast.success(`Added ${cleanedUrl}`);
      setInput('');
    });
  };

  const removeSite = (site: BlockedSites['sites'][0]) => {
    const newSites = sites.filter(s => s.url !== site.url);
    setSites(newSites);
    updateStorage({ sites: newSites }, () => {
      toast.success(`Removed ${site.url}`);
    });
  };

  const removeAllSites = () => {
    setSites([]);
    updateStorage({ sites: [] }, () => {
      toast.success('Removed all sites');
    });
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    toast.success(`Switched to ${!isDarkMode ? 'dark' : 'light'} mode`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (inputError) setInputError('');
  };

  return (
    <div className="container">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            fontSize: '14px',
          },
        }}
      />
      
      {/* Loading Spinner Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {/* Error Message with Retry */}
      {error && (
        <div className="error-dialog">
          <div className="error-content">
            <div className="error-title">{error}</div>
            {retryAction && (
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  retryAction();
                }}
                className="button button-primary"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="title">SiteBlockr</h1>
          <button
            onClick={toggleTheme}
            className="button-icon"
            aria-label="toggle theme"
          >
            {isDarkMode ? '☀' : '☾'}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="section">
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{sites.filter(site => site.url.trim()).length}</div>
            <div className="stat-label">Blocked Sites</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: isBlockingEnabled ? 'var(--color-accent)' : 'var(--color-text)' }}>
              {isBlockingEnabled ? 'Active' : 'Disabled'}
            </div>
            <div className="stat-label">Status</div>
          </div>
        </div>
      </div>

      {/* Blocking Toggle */}
      <div className="section">
        <div className="control-row">
          <span>Blocking Enabled</span>
          <button
            onClick={toggleBlocking}
            className={`toggle ${isBlockingEnabled ? 'active' : ''}`}
          >
            <div className="toggle-thumb" />
          </button>
        </div>
      </div>

      {/* Add Site */}
      <div className="section">
        <div className="input-row">
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && addSite()}
              placeholder="Enter site URL (e.g., facebook.com)"
              className={`input ${inputError ? 'error' : ''}`}
            />
            {inputError && (
              <div className="error-message fade-in">
                {inputError}
              </div>
            )}
          </div>
          <button
            onClick={addSite}
            className="button button-primary"
          >
            Add
          </button>
        </div>
      </div>

             {/* Sites List */}
       <div className="section">
         {sites.length === 0 ? (
           <div className="empty-state fade-in">
             <div className="empty-icon">🌐</div>
             <div>No sites blocked yet</div>
             <div className="text-small">Add a website above to get started</div>
           </div>
         ) : (
           <div className="fade-in">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
               <h3 className="subtitle">Blocked Sites ({sites.length})</h3>
               <button
                 onClick={removeAllSites}
                 className="button-ghost text-small"
                 style={{ color: 'var(--color-danger)' }}
               >
                 Remove All
               </button>
             </div>
             <div>
               {sites.map((site) => (
                 <div key={site.url} className="site-item fade-in">
                   <div className="site-url">{site.url}</div>
                   <button
                     onClick={() => removeSite(site)}
                     className="button-ghost text-small"
                     style={{ color: 'var(--color-danger)' }}
                   >
                     Remove
                   </button>
                 </div>
               ))}
             </div>
           </div>
         )}
       </div>

      {/* Quote */}
      {quote && (
        <div className="quote">
          <p className="quote-text">"{quote.content}"</p>
          <p className="quote-author">— {quote.author}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '3rem', 
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--color-text-tertiary)'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 300, letterSpacing: '0.05em' }}>made with</span>
          {' '}
          <span style={{ 
            fontWeight: 500,
            color: 'var(--color-accent)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontSize: '0.7rem'
          }}>
            focus
          </span>
          {' '}
          <span style={{ fontWeight: 300, letterSpacing: '0.05em' }}>by</span>
          {' '}
          <a 
            href="https://github.com/sergimarquez" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
            style={{ 
              fontWeight: 500,
              color: 'var(--color-text-secondary)'
            }}
          >
            sergimarquez
          </a>
        </div>
        <div>© {new Date().getFullYear()} SiteBlockr</div>
      </div>
    </div>
  );
}

export default App;
