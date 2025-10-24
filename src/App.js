// App.js - Amazon Deals Finder Frontend
// A React application for searching Amazon deals and sharing them on Facebook
// Features: infinite scroll, deduplication, coupon code extraction, and social sharing

import React, { useState, useEffect, useCallback, use } from 'react';
import { Search, Facebook, AlertCircle } from 'lucide-react';

function App() {
  // ========================================
  // CONFIGURATION
  // ========================================
  
  // Backend API URL - defaults to localhost for development
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  // Core data and UI state
  const [deals, setDeals] = useState([]);              // All fetched deals
  const [searchQuery, setSearchQuery] = useState('');  // Current search input
  const [minDiscount, setMinDiscount] = useState(20);  // Minimum discount filter (%)
  const [loading, setLoading] = useState(false);       // Loading indicator for searches
  const [error, setError] = useState('');              // Error messages
  
  // Deduplication settings
  // Prevents showing duplicate products based on selected key (ASIN, URL, or Title)
  const [dedupeKey, setDedupeKey] = useState('asin');
  
  // Visual feedback for newly added items
  const [lastAddedIds, setLastAddedIds] = useState([]);  // IDs of recently added deals (shown as "NEW")
  const lastAddedTimerRef = React.useRef(null);          // Timer to clear "NEW" badges after 10s
  
  // Server-side pagination state
  const [serverPage, setServerPage] = useState(1);       // Current page number from API
  const [serverPageSize] = useState(30);                 // Items per page (fixed at 30)
  const [isLoadingMore, setIsLoadingMore] = useState(false);  // Loading more pages indicator
  const [lastKeyword, setLastKeyword] = useState('');    // Last searched keyword (for pagination)
  const [noMorePages, setNoMorePages] = useState(false); // Whether we've reached the end
  
  // Debug mode - includes raw promotion data in results
  const [debugPromotions, setDebugPromotions] = useState(false);
  
  // Filtering options
  const [showOnlyWithCodes, setShowOnlyWithCodes] = useState(false);  // Filter to only show deals with coupon codes
  const [maxResults, setMaxResults] = useState(10);                   // Max number of deals to display
  
  // External URL sharing feature
  const [externalUrl, setExternalUrl] = useState('');           // URL input for non-Amazon links
  const [externalMeta, setExternalMeta] = useState(null);       // Fetched metadata for external URL
  const [fetchingMeta, setFetchingMeta] = useState(false);      // Loading state for metadata fetch
  
  // Manual pricing inputs for external URLs (when auto-fetch doesn't work)
  const [externalOriginalPrice, setExternalOriginalPrice] = useState('');
  const [externalCurrentPrice, setExternalCurrentPrice] = useState('');
  const [externalDiscount, setExternalDiscount] = useState('');
  const [externalCouponCode, setExternalCouponCode] = useState('');

  //API Monitoring state
  const [monitorStats, setMonitorStats] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);

  // ========================================
  // API FUNCTIONS
  // ========================================

  /**
   * Search for products with a specific keyword
   * Makes POST request to backend /api/search endpoint
   * Deduplicates results and preserves scroll position
   * @param {string} keyword - Search term
   */
  const searchProductsWithKeyword = useCallback(async (keyword) => {
    setLoading(true);
    setError('');

    try {
      // Call backend search API
      const response = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, minDiscount, debugPromotions })
      });

      const data = await response.json();
      if (data.success) {
        // Reset pagination state for fresh search
        setLastKeyword(keyword);
        setServerPage(1);
        setNoMorePages(false);

        // Add unique IDs to each deal for React keys
        const newDeals = data.deals.map(d => ({ ...d, id: Date.now() + Math.random() }));

        // ========================================
        // DEDUPLICATION LOGIC
        // ========================================
        // Prevent duplicate products from appearing in the list
        setDeals(prev => {
          // Create a Set of existing keys (ASIN/URL/Title) for fast lookup
          const existingKeys = new Set(prev.map(p => p[dedupeKey] || p.asin || p.url || p.title));
          
          // Filter out new deals that already exist
          const uniqueNew = newDeals.filter(n => {
            const key = n[dedupeKey] || n.asin || n.url || n.title;
            return key && !existingKeys.has(key);
          });
          
          // Mark newly added deals with "NEW" badge for 10 seconds
          const addedIds = uniqueNew.map(n => n.id);
          if (addedIds.length > 0) {
            setLastAddedIds(addedIds);
            // Clear previous timer
            if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
            // Set new timer to remove "NEW" badges after 10 seconds
            lastAddedTimerRef.current = setTimeout(() => setLastAddedIds([]), 10000);
          }
          
          // Prepend new deals to top of list
          return [...uniqueNew, ...prev];
        });
      }
    } catch (err) {
      setError('Cannot connect to server!');
    }
    setLoading(false);
  }, [minDiscount, API_BASE, dedupeKey, debugPromotions]);

  /**
   * Search products with user input from search bar
   * Resets pagination and clears search input after submission
   */
  const searchProducts = async () => {
    if (!searchQuery.trim()) return;
    
    // Reset server paging when starting a fresh search
    setServerPage(1);
    setNoMorePages(false);
    setLastKeyword(searchQuery);
    
    await searchProductsWithKeyword(searchQuery);
    setSearchQuery('');  // Clear input after search
  };

  /**
   * Load next page of results from server (pagination)
   * Appends new deals to existing list without duplicates
   */
  const loadMoreFromServer = useCallback(async () => {
    if (isLoadingMore || noMorePages) return;  // Prevent duplicate requests
    
    setIsLoadingMore(true);
    const nextPage = serverPage + 1;
    
    try {
      const resp = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: lastKeyword, 
          minDiscount, 
          page: nextPage, 
          pageSize: serverPageSize, 
          debugPromotions 
        })
      });
      
      const data = await resp.json();
      if (data.success) {
        const newDeals = data.deals.map(d => ({ ...d, id: Date.now() + Math.random() }));
        
        setDeals(prev => {
          // Deduplicate against existing deals
          const existingKeys = new Set(prev.map(p => p[dedupeKey] || p.asin || p.url || p.title));
          const uniqueNew = newDeals.filter(n => {
            const key = n[dedupeKey] || n.asin || n.url || n.title;
            return key && !existingKeys.has(key);
          });
          
          // If no new unique deals found, we've reached the end
          if (uniqueNew.length === 0) {
            setNoMorePages(true);
          } else {
            // Mark new deals and set timer to clear badges
            const addedIds = uniqueNew.map(n => n.id);
            setLastAddedIds(addedIds);
            if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
            lastAddedTimerRef.current = setTimeout(() => setLastAddedIds([]), 10000);
          }
          
          // Append to end of list
          return [...prev, ...uniqueNew];
        });
        
        setServerPage(nextPage);
      }
    } catch (err) {
      console.error('Load more error', err);
    }
    
    setIsLoadingMore(false);
  }, [isLoadingMore, serverPage, serverPageSize, lastKeyword, minDiscount, API_BASE, dedupeKey, noMorePages, debugPromotions]);

  // ========================================
  // INFINITE SCROLL SETUP
  // ========================================
  
  // Ref for the sentinel div that triggers loading when visible
  const sentinelRef = React.useRef(null);
  
  // Placeholder effect - actual observer is set up after filtered/displayedDeals are defined
  useEffect(() => {
    // Empty dependency array - just a placeholder
  }, []);

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  /**
   * Extract coupon/promo code from a deal object
   * Checks multiple possible field names
   * @param {Object} deal - Deal object
   * @returns {string} Coupon code or empty string
   */
  const getDealCode = (deal) => {
    return deal.code || deal.couponCode || deal.promoCode || deal.coupon || '';
  };

  /**
   * Generate formatted Facebook post text for a deal
   * Includes pricing, discount, rating, and optional coupon code
   * @param {Object} deal - Deal object
   * @returns {string} Formatted post text
   */
  const generatePost = (deal) => {
    const code = getDealCode(deal);
    return `#ad

🔥 DEAL ALERT! ${deal.discount}% OFF! 🔥

${deal.title}

💰 Was: $${deal.originalPrice.toFixed(2)}
✨ Now: $${deal.currentPrice.toFixed(2)}
💵 Save: $${(deal.originalPrice - deal.currentPrice).toFixed(2)}!

⭐ ${deal.rating}/5 (${deal.reviewCount.toLocaleString()} reviews)

${code ? `Use code: ${code}\n\n` : ''}Grab it now! 👇
${deal.url}

⚡Prices may change at any time.

#AmazonDeals #AllAboutSavings`;
  };

  /**
   * Copy text to clipboard with user feedback
   * @param {string} text - Text to copy
   */
  const copy = (text) => {
    navigator.clipboard.writeText(text);
    alert('✅ Copied!');
  };

  /**
   * Open Facebook share dialog with pre-filled post
   * Uses Facebook's sharer dialog with quote parameter
   * @param {Object} deal - Deal object to share
   */
  const shareToFacebook = (deal) => {
    const quote = encodeURIComponent(generatePost(deal));
    // Facebook sharer with quote param and deal URL
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deal.url)}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * Fetch Open Graph metadata for external URL
   * Used for sharing non-Amazon links on Facebook
   */
  const fetchExternalMetadata = async () => {
    if (!externalUrl.trim()) return;
    
    setFetchingMeta(true);
    try {
      const resp = await fetch(`${API_BASE}/api/fetch-metadata`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ url: externalUrl }) 
      });
      
      const data = await resp.json();
      if (data.success) {
        setExternalMeta(data);
      } else {
        setExternalMeta({ title: '', description: '', image: '' });
      }
    } catch (e) {
      setExternalMeta({ title: '', description: '', image: '' });
    }
    
    setFetchingMeta(false);
  };

  /**
   * Generate Facebook post for external URL
   * @param {Object} meta - Metadata object (title, description, etc.)
   * @param {string} url - Original URL
   * @returns {string} Formatted post text
   */
  const generatePostForExternal = (meta, url) => {
    // Use manual pricing if provided, otherwise use fetched data
    const origPrice = externalOriginalPrice || meta.originalPrice || '';
    const currPrice = externalCurrentPrice || meta.discountedPrice || '';
    const discount = externalDiscount || '';
    
    let priceSection = '';
    
    // If we have pricing information, add it to the post
    if (discount) {
      priceSection = `\n🔥 ${discount}% OFF! 🔥\n\n`;
    }
    
    if (origPrice && currPrice) {
      priceSection += `💰 Was: ${origPrice}\n✨ Now: ${currPrice}\n`;
      const savings = (parseFloat(origPrice) - parseFloat(currPrice)).toFixed(2);
      if (savings > 0) {
        priceSection += `💵 Save: ${savings}!\n`;
      }
      priceSection += '\n';
    } else if (currPrice) {
      priceSection += `💰 Price: ${currPrice}\n\n`;
    }
    
    return `#ad\n${priceSection}${meta.title || url}\n\n${meta.description ? meta.description + '\n\n' : ''}Grab it now! 👇\n${url}\n\n⚡Prices may change at any time.\n\n#AmazonDeals #SaveMoney`;
  };

  /**
   * Share external URL on Facebook with metadata
   * @param {Object} meta - Metadata object
   * @param {string} url - URL to share
   */
  const shareExternalOnFacebook = (meta, url) => {
    const quote = encodeURIComponent(generatePostForExternal(meta, url));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // ========================================
  // AUTO-LOAD DEALS ON STARTUP
  // ========================================
  
  /**
   * Automatically load deals when app starts
   * Searches for default keywords to populate the feed
   */
  useEffect(() => {
    const autoLoadDeals = async () => {
      console.log('🔄 Auto-loading deals...');
      const defaultKeywords = ['electronics', 'home kitchen', 'wireless'];
      
      // Search each keyword with a small delay between requests
      for (const keyword of defaultKeywords) {
        await searchProductsWithKeyword(keyword);
        await new Promise(resolve => setTimeout(resolve, 500));  // 500ms delay
      }
    };
    
    autoLoadDeals();
  }, [searchProductsWithKeyword]);

  //=========================================
  //FETCH MONITORING STATS
  //=========================================

  const fetchMonitorStats = useCallback(async () => { 
    try {
      const response = await fetch(`${API_BASE}/api/monitor-stats`);
      const data = await response.json();
      setMonitorStats(data);
    } catch (err) {
      console.error('Failed to fetch monitor stats:', err);
    }
  }, [API_BASE]);

  useEffect(() => {
    if (showMonitor) {
      fetchMonitorStats();
      const interval = setInterval(fetchMonitorStats, 60000); // Refresh every 60s
      return () => clearInterval(interval);
    }
  }, [showMonitor, fetchMonitorStats]);

  // ========================================
  // FILTERING AND DISPLAY
  // ========================================

  // Filter deals based on minimum discount and coupon code requirements
  const filtered = deals.filter(d => {
    if (d.discount < minDiscount) return false;
    if (showOnlyWithCodes && !getDealCode(d)) return false;
    return true;
  });

  // Limit displayed deals based on maxResults setting
  const displayedDeals = filtered.slice(0, maxResults);

  // ========================================
  // INFINITE SCROLL OBSERVER
  // ========================================
  
  /**
   * Set up IntersectionObserver for infinite scroll
   * When sentinel div becomes visible, load more results
   */
  useEffect(() => {
    if (!sentinelRef.current) return;
    
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        // If sentinel is visible and there are more deals to load
        if (e.isIntersecting && filtered.length > displayedDeals.length) {
          loadMoreFromServer();
        }
      });
    }, { 
      root: null,           // Viewport as root
      rootMargin: '200px',  // Trigger 200px before reaching sentinel
      threshold: 0.1        // 10% visibility triggers callback
    });
    
    obs.observe(sentinelRef.current);
    
    // Cleanup observer on unmount
    return () => obs.disconnect();
  }, [loadMoreFromServer, filtered.length, displayedDeals.length]);

  // ========================================
  // RENDER UI
  // ========================================

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ========================================
            HEADER & CONTROLS SECTION
            ======================================== */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          
          {/* App Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '12px', borderRadius: '12px' }}>
              <Facebook style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>
            <div style={{ flex: 1}}>
             <h1 style={{ margin: 0, fontSize: '32px' }}>Amazon Deals Finder</h1>
              <p style={{ margin: 0, color: '#666' }}>Find hot deals for Facebook</p>
            </div>
            <button 
              onClick={() => setShowMonitor(!showMonitor)}
              style={{ 
                padding: '10px 20px', 
                background: showMonitor ? '#10b981' : '#667eea', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {showMonitor ? '📊 Hide Monitor' : '📊 API Monitor'}
            </button>
          </div>

          {/* API Monitoring Panel */}
          {showMonitor && monitorStats && (
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '2px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#333' }}>🔍 API Usage Monitor</h2>
              
              {/* Key Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '15px' }}>
                
                {/* Daily Requests */}
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>DAILY REQUESTS</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>{monitorStats.dailyCount}</div>
                  <div style={{ fontSize: '11px', color: '#999' }}>{monitorStats.dailyPercentage} of 8,640</div>
                  <div style={{ background: '#e5e7eb', height: '6px', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ 
                      background: monitorStats.dailyCount > 7000 ? '#ef4444' : monitorStats.dailyCount > 5000 ? '#f59e0b' : '#10b981', 
                      height: '100%', 
                      width: monitorStats.dailyPercentage,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                
                {/* Success Rate */}
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>SUCCESS RATE</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                    {monitorStats.totalRequests > 0 ? ((monitorStats.successCount / monitorStats.totalRequests) * 100).toFixed(1) : 0}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>{monitorStats.successCount} successful</div>
                </div>
                
                {/* Error Count */}
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>ERRORS</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: monitorStats.errorCount > 0 ? '#ef4444' : '#10b981' }}>{monitorStats.errorCount}</div>
                  <div style={{ fontSize: '11px', color: '#999' }}>Failed requests</div>
                </div>
                
                {/* Throttle Count */}
                <div style={{ background: monitorStats.throttleCount > 0 ? '#fee' : 'white', padding: '15px', borderRadius: '8px', border: '1px solid ' + (monitorStats.throttleCount > 0 ? '#fca5a5' : '#e5e7eb') }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>THROTTLED</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: monitorStats.throttleCount > 0 ? '#dc2626' : '#10b981' }}>{monitorStats.throttleCount}</div>
                  <div style={{ fontSize: '11px', color: '#999' }}>{monitorStats.throttleRate}</div>
                </div>
                
              </div>
              
              {/* Operations Breakdown */}
              {Object.keys(monitorStats.operationCounts || {}).length > 0 && (
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>Operations:</div>
                  {Object.entries(monitorStats.operationCounts).map(([op, count]) => (
                    <div key={op} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px' }}>
                      <span style={{ color: '#666' }}>{op.replace('com.amazon.paapi5.v1.ProductAdvertisingAPIv1.', '')}</span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Warnings */}
              {monitorStats.dailyCount > 7000 && (
                <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '13px', color: '#92400e' }}>
                  ⚠️ Warning: Approaching daily limit ({monitorStats.dailyCount}/8,640)
                </div>
              )}
              {monitorStats.throttleCount > 5 && (
                <div style={{ background: '#fee', border: '1px solid #fca5a5', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '13px', color: '#991b1b' }}>
                  🚨 High throttle count detected! Consider slowing down requests.
                </div>
              )}
              
            </div>
          )}

          {/* Debug Info & Settings */}
          <div style={{ marginBottom: '10px', color: '#666', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>Dedupe key:</span>
              <select value={dedupeKey} onChange={(e) => setDedupeKey(e.target.value)}>
                <option value="asin">ASIN</option>
                <option value="url">URL</option>
                <option value="title">Title</option>
              </select>
            </label>
            {/* Pagination debug info */}
            <div style={{ marginLeft: 'auto', fontSize: '13px' }}>
              Page: {serverPage} · PageSize: {serverPageSize} · Loading more: {isLoadingMore ? 'yes' : 'no'} · No more pages: {noMorePages ? 'yes' : 'no'}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{ background: '#fee', border: '2px solid #fcc', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
              <AlertCircle style={{ display: 'inline', color: '#c00' }} /> {error}
            </div>
          )}

          {/* Search Bar */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              style={{ flex: 1, padding: '15px', fontSize: '16px', border: '2px solid #ddd', borderRadius: '8px' }}
              onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
            />
            <button
              onClick={searchProducts}
              disabled={loading}
              style={{ 
                padding: '15px 30px', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                background: 'linear-gradient(135deg, #667eea, #764ba2)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: loading ? 'not-allowed' : 'pointer' 
              }}
            >
              {loading ? '🔄 Searching...' : '🔍 Search'}
            </button>
          </div>

          {/* Filters & Options */}
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            
            {/* Minimum Discount Filter */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Min Discount:</span>
              <input 
                type="number" 
                value={minDiscount} 
                onChange={(e) => setMinDiscount(parseInt(e.target.value) || 0)} 
                style={{ width: '80px', padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
              <span>%</span>
            </label>
            
            {/* Show Only Deals with Codes */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input 
                type="checkbox" 
                checked={showOnlyWithCodes} 
                onChange={(e) => setShowOnlyWithCodes(e.target.checked)} 
              />
              <span style={{ fontWeight: 'bold' }}>Only show deals with codes</span>
            </label>
            
            {/* Debug Promotions Mode */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input 
                type="checkbox" 
                checked={debugPromotions} 
                onChange={(e) => setDebugPromotions(e.target.checked)} 
              />
              <span style={{ fontWeight: 'bold' }}>Debug promotions (include raw promotions)</span>
            </label>
            
            {/* External URL Sharing Feature */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                value={externalUrl} 
                onChange={(e) => setExternalUrl(e.target.value)} 
                placeholder="Paste external URL to generate FB post" 
                style={{ flex: 1, padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
              <button 
                onClick={fetchExternalMetadata} 
                disabled={fetchingMeta} 
                style={{ padding: '8px 12px', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none' }}
              >
                {fetchingMeta ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
            
            {/* Manual Pricing Inputs */}
            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              <input 
                type="number" 
                value={externalOriginalPrice} 
                onChange={(e) => setExternalOriginalPrice(e.target.value)} 
                placeholder="Original Price ($)" 
                step="0.01"
                style={{ padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
              <input 
                type="number" 
                value={externalCurrentPrice} 
                onChange={(e) => setExternalCurrentPrice(e.target.value)} 
                placeholder="Current Price ($)" 
                step="0.01"
                style={{ padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
              <input 
                type="number" 
                value={externalDiscount} 
                onChange={(e) => setExternalDiscount(e.target.value)} 
                placeholder="Discount (%)" 
                style={{ padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
              <input 
                type="text" 
                value={externalCouponCode} 
                onChange={(e) => setExternalCouponCode(e.target.value)} 
                placeholder="Coupon Code" 
                style={{ padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
              💡 Fill in pricing & coupon manually if auto-fetch doesn't work
            </div>
            
            {/* External URL Metadata Display */}
            {externalMeta && (
              <div style={{ marginTop: '10px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold' }}>{externalMeta.title || 'No title found'}</div>
                {externalMeta.description && <div style={{ color: '#666', marginTop: '6px' }}>{externalMeta.description}</div>}
                
                {/* Show manual inputs if provided */}
                {(externalOriginalPrice || externalCurrentPrice || externalDiscount || externalCouponCode) && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#f0f9ff', borderRadius: '4px', fontSize: '13px' }}>
                    {externalDiscount && <div>💥 Discount: {externalDiscount}%</div>}
                    {externalOriginalPrice && <div>💰 Was: ${externalOriginalPrice}</div>}
                    {externalCurrentPrice && <div>✨ Now: ${externalCurrentPrice}</div>}
                    {externalCouponCode && <div>🎟️ Code: {externalCouponCode}</div>}
                  </div>
                )}
                
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => copy(generatePostForExternal(externalMeta, externalUrl))} 
                    style={{ padding: '8px 12px', borderRadius: '6px', background: '#1877f2', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    📘 Copy FB Post
                  </button>
                  <button 
                    onClick={() => shareExternalOnFacebook(externalMeta, externalUrl)} 
                    style={{ padding: '8px 12px', borderRadius: '6px', background: '#4267B2', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    🔁 Share on Facebook
                  </button>
                </div>
              </div>
            )}
            
            {/* Max Results Control */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Max results:</span>
              <input 
                type="number" 
                value={maxResults} 
                onChange={(e) => setMaxResults(Math.max(1, parseInt(e.target.value) || 1))} 
                style={{ width: '100px', padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
            </label>
          </div>

          {/* Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            {/* Total Deals */}
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{deals.length}</div>
              <div>Total Deals</div>
            </div>
            
            {/* Filtered/Showing Count */}
            <div style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{filtered.length}</div>
              <div>Showing</div>
            </div>
            
            {/* Average Discount */}
            <div style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                {deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.discount, 0) / deals.length) : 0}%
              </div>
              <div>Avg Discount</div>
            </div>
          </div>
        </div>

        {/* ========================================
            DEALS LIST
            ======================================== */}

        {/* Empty State */}
        {displayedDeals.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '15px', padding: '60px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <Search style={{ width: '80px', height: '80px', color: '#ddd', margin: '0 auto 20px' }} />
            <h2>No deals yet!</h2>
            <p>Search for products above</p>
          </div>
        ) : (
          /* Deal Cards */
          displayedDeals.map(deal => (
            <div 
              key={deal.id} 
              style={{ 
                background: 'white', 
                borderRadius: '15px', 
                padding: '25px', 
                marginBottom: '20px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)', 
                contain: 'layout paint'  // Performance optimization
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '25px' }}>
                
                {/* Product Image & Discount Badge */}
                <div style={{ position: 'relative', minWidth: '200px' }}>
                  <img 
                    src={deal.image} 
                    alt={deal.title} 
                    style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} 
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: '10px', 
                    right: '10px', 
                    background: '#f00', 
                    color: 'white', 
                    padding: '8px 12px', 
                    borderRadius: '20px', 
                    fontWeight: 'bold' 
                  }}>
                    -{deal.discount}%
                  </div>
                </div>

                {/* Product Details */}
                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>
                    {deal.title} 
                    {/* "NEW" Badge for Recently Added Deals */}
                    {lastAddedIds.includes(deal.id) && (
                      <span style={{ 
                        background: '#fde68a', 
                        color: '#92400e', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        fontSize: '12px', 
                        marginLeft: '8px' 
                      }}>
                        NEW
                      </span>
                    )}
                  </h3>
                  
                  {/* Rating */}
                  <div style={{ marginBottom: '15px' }}>
                    <span style={{ color: '#f90' }}>⭐ {deal.rating}</span>
                    <span style={{ color: '#999', marginLeft: '10px' }}>({deal.reviewCount.toLocaleString()})</span>
                  </div>
                  
                  {/* Pricing */}
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#0a0' }}>
                      ${deal.currentPrice.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '20px', color: '#999', textDecoration: 'line-through', marginLeft: '10px' }}>
                      ${deal.originalPrice.toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Savings */}
                  <div style={{ color: '#0a0', fontWeight: 'bold' }}>
                    💰 Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}!
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Copy Coupon Code (if available) */}
                  {getDealCode(deal) && (
                    <button 
                      onClick={() => copy(getDealCode(deal))} 
                      style={{ 
                        padding: '12px', 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        fontWeight: 'bold' 
                      }}
                    >
                      🎟️ Copy Code
                    </button>
                  )}
                  
                  {/* Copy Facebook Post */}
                  <button 
                    onClick={() => copy(generatePost(deal))} 
                    style={{ 
                      padding: '12px', 
                      background: '#1877f2', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold' 
                    }}
                  >
                    📘 Copy FB Post
                  </button>
                  
                  {/* Share Directly on Facebook */}
                  <button 
                    onClick={() => shareToFacebook(deal)} 
                    style={{ 
                      padding: '12px', 
                      background: '#4267B2', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold' 
                    }}
                  >
                    🔁 Share on Facebook
                  </button>
                  
                  {/* Copy Amazon Link */}
                  <button 
                    onClick={() => copy(deal.url)} 
                    style={{ 
                      padding: '12px', 
                      background: '#8b5cf6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold' 
                    }}
                  >
                    🔗 Copy Link
                  </button>
                  
                  {/* Open on Amazon */}
                  <button 
                    onClick={() => window.open(deal.url, '_blank')} 
                    style={{ 
                      padding: '12px', 
                      background: '#ff9900', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold' 
                    }}
                  >
                    🛒 View on Amazon
                  </button>
                  
                  {/* Remove Deal */}
                  <button 
                    onClick={() => setDeals(deals.filter(d => d.id !== deal.id))} 
                    style={{ 
                      padding: '12px', 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold' 
                    }}
                  >
                    🗑️ Remove
                  </button>
                  
                  {/* Debug: Show Raw Promotions Data */}
                  {deal.rawPromotions && (
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      background: '#f9fafb', 
                      padding: '10px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      color: '#333' 
                    }}>
                      {JSON.stringify(deal.rawPromotions, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* ========================================
            LOADING PLACEHOLDERS
            ======================================== */}
        
        {/* Reserve space while loading more to prevent layout shift */}
        {isLoadingMore && (
          <>
            {Array.from({ length: serverPageSize }).map((_, idx) => (
              <div 
                key={`ph-${idx}`} 
                style={{ 
                  height: '260px', 
                  marginBottom: '20px', 
                  borderRadius: '15px', 
                  background: '#fff', 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.04)' 
                }} 
              />
            ))}
          </>
        )}

        {/* ========================================
            LOAD MORE CONTROLS
            ======================================== */}
        
        {/* Load More Button or End Message */}
        {!noMorePages ? (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button 
              onClick={() => loadMoreFromServer()} 
              disabled={isLoadingMore} 
              style={{ 
                padding: '12px 20px', 
                background: isLoadingMore ? '#6b7280' : '#1f2937', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: isLoadingMore ? 'not-allowed' : 'pointer' 
              }}
            >
              {isLoadingMore ? 'Loading more...' : 'Load more from server'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
            No more pages
          </div>
        )}

        {/* Sentinel Div for Infinite Scroll Detection */}
        <div ref={sentinelRef} style={{ height: '1px' }} />
        
        </div>
        
        {/* Loading Indicator */}
        {isLoadingMore && (
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
            Loading more...
          </div>
        )}
      </div>
    
  
  );}

export default App;