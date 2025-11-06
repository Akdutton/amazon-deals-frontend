// App.js - Amazon Deals Finder Frontend
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Facebook, AlertCircle } from 'lucide-react';

function App() {
  // ========================================
  // CONFIGURATION
  // ========================================
  
  const API_BASE = 'https://amazon-deals-backend.onrender.com';

  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  const [deals, setDeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minDiscount, setMinDiscount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [dedupeKey, setDedupeKey] = useState('asin');
  const [lastAddedIds, setLastAddedIds] = useState([]);
  const lastAddedTimerRef = useRef(null);
  
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize] = useState(30);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastKeyword, setLastKeyword] = useState('');
  const [noMorePages, setNoMorePages] = useState(false);
  
  const [debugPromotions, setDebugPromotions] = useState(false);
  const [showOnlyWithCodes, setShowOnlyWithCodes] = useState(false);
  const [maxResults, setMaxResults] = useState(1000);
  
  const [externalUrl, setExternalUrl] = useState('');
  const [externalMeta, setExternalMeta] = useState(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  
  const [externalOriginalPrice, setExternalOriginalPrice] = useState('');
  const [externalCurrentPrice, setExternalCurrentPrice] = useState('');
  const [externalDiscount, setExternalDiscount] = useState('');
  const [externalCouponCode, setExternalCouponCode] = useState('');

  const [monitorStats, setMonitorStats] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);

  const sentinelRef = useRef(null);

  // ========================================
  // API FUNCTIONS
  // ========================================

  const searchProductsWithKeyword = useCallback(async (keyword) => {
    setLoading(true);
    setError('');

    try {
      if (!keyword || keyword.trim().length === 0) {
        setError('❌ Keyword cannot be empty');
        setLoading(false);
        return;
      }

      console.log(`🔍 Searching for: ${keyword}, minDiscount: ${minDiscount}`);

      const searchPayload = {
        keyword: keyword.trim(),
        minDiscount: Number(minDiscount) || 0,
        page: 1,
        pageSize: 30,
        debugPromotions: debugPromotions === true
      };

      console.log('📤 Sending payload:', searchPayload);

      const response = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Backend error:', data);
        setError(`Server error: ${data.error || data.message || 'Unknown error from server'}`);
        setLoading(false);
        return;
      }

      if (data.success) {
        setLastKeyword(keyword);
        setServerPage(1);
        setNoMorePages(false);

        const newDeals = data.deals.map(d => ({ ...d, id: Date.now() + Math.random() }));

        setDeals(prev => {
          const existingKeys = new Set(prev.map(p => p[dedupeKey] || p.asin || p.url || p.title));
          
          const uniqueNew = newDeals.filter(n => {
            const key = n[dedupeKey] || n.asin || n.url || n.title;
            return key && !existingKeys.has(key);
          });
          
          const addedIds = uniqueNew.map(n => n.id);
          if (addedIds.length > 0) {
            setLastAddedIds(addedIds);
            if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
            lastAddedTimerRef.current = setTimeout(() => setLastAddedIds([]), 10000);
          }
          
          return [...uniqueNew, ...prev];
        });

        console.log(`✅ Found ${data.deals.length} deals`);
      } else {
        setError(`❌ ${data.error || 'Failed to fetch deals'}`);
      }
    } catch (err) {
      console.error('❌ Fetch error:', err);
      setError(`Cannot connect to server: ${err.message}`);
    }
    setLoading(false);
  }, [minDiscount, API_BASE, dedupeKey, debugPromotions]);

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;
    
    setServerPage(1);
    setNoMorePages(false);
    setLastKeyword(searchQuery);
    
    await searchProductsWithKeyword(searchQuery);
    setSearchQuery('');
  };

  const loadMoreFromServer = useCallback(async () => {
    if (isLoadingMore || noMorePages) return;
    
    setIsLoadingMore(true);
    const nextPage = serverPage + 1;
    
    try {
      const resp = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: lastKeyword, 
          minDiscount: Number(minDiscount) || 0,
          page: nextPage, 
          pageSize: serverPageSize, 
          debugPromotions: debugPromotions === true
        })
      });
      
      const data = await resp.json();
      if (data.success) {
        const newDeals = data.deals.map(d => ({ ...d, id: Date.now() + Math.random() }));
        
        setDeals(prev => {
          const existingKeys = new Set(prev.map(p => p[dedupeKey] || p.asin || p.url || p.title));
          const uniqueNew = newDeals.filter(n => {
            const key = n[dedupeKey] || n.asin || n.url || n.title;
            return key && !existingKeys.has(key);
          });
          
          if (uniqueNew.length === 0) {
            setNoMorePages(true);
          } else {
            const addedIds = uniqueNew.map(n => n.id);
            setLastAddedIds(addedIds);
            if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
            lastAddedTimerRef.current = setTimeout(() => setLastAddedIds([]), 10000);
          }
          
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
  // HELPER FUNCTIONS
  // ========================================

  const getDealCode = (deal) => {
    return deal.code || deal.couponCode || deal.promoCode || deal.coupon || '';
  };

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

  const copy = (text) => {
    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .trim();
      
    navigator.clipboard.writeText(cleanText);
    alert('✅ Copied!');
  };

  const shareToFacebook = (deal) => {
    const quote = encodeURIComponent(generatePost(deal));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deal.url)}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

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

  const generatePostForExternal = (meta, url) => {
    const origPrice = externalOriginalPrice || meta.originalPrice || '';
    const currPrice = externalCurrentPrice || meta.discountedPrice || '';
    const discount = externalDiscount || '';
    
    let priceSection = '';
    
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
    
    return `#ad\n${priceSection}${meta.title || url}\n\n${meta.description ? meta.description + '\n\n' : ''}Grab it now! 👇\n${url}\n\n⚡Prices may change at any time.\n\n#AmazonDeals #AllAboutSavings`;
  };

  const shareExternalOnFacebook = (meta, url) => {
    const quote = encodeURIComponent(generatePostForExternal(meta, url));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // ========================================
  // AUTO-LOAD DEALS ON STARTUP
  // ========================================
  
  useEffect(() => {
    const autoLoadDeals = async () => {
      console.log('🔄 Auto-loading deals...');
      const defaultKeywords = ['electronics', 'home kitchen', 'wireless'];
      
      for (const keyword of defaultKeywords) {
        console.log(`📍 Loading: ${keyword}`);
        try {
          await searchProductsWithKeyword(keyword);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`Error loading ${keyword}:`, err);
        }
      }
    };
    
    autoLoadDeals();
  }, [searchProductsWithKeyword]);

  // ========================================
  // FETCH MONITORING STATS
  // ========================================

  const fetchMonitorStats = useCallback(async () => { 
    try {
      const response = await fetch(`${API_BASE}/api/monitor/stats`);
      const data = await response.json();
      setMonitorStats(data);
    } catch (err) {
      console.error('Failed to fetch monitor stats:', err);
    }
  }, [API_BASE]);

  useEffect(() => {
    if (showMonitor) {
      fetchMonitorStats();
      const interval = setInterval(fetchMonitorStats, 60000);
      return () => clearInterval(interval);
    }
  }, [showMonitor, fetchMonitorStats]);

  // ========================================
  // FILTERING AND DISPLAY
  // ========================================

  const filtered = deals.filter(d => {
    if (d.discount < minDiscount) return false;
    if (showOnlyWithCodes && !getDealCode(d)) return false;
    return true;
  });

  const displayedDeals = filtered.slice(0, maxResults);

  // ========================================
  // INFINITE SCROLL OBSERVER
  // ========================================
  
  useEffect(() => {
    if (!sentinelRef.current) return;
    
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && filtered.length > displayedDeals.length) {
          loadMoreFromServer();
        }
      });
    }, { 
      root: null,
      rootMargin: '200px',
      threshold: 0.1
    });
    
    obs.observe(sentinelRef.current);
    
    return () => obs.disconnect();
  }, [loadMoreFromServer, filtered.length, displayedDeals.length]);

  // ========================================
  // RENDER UI
  // ========================================

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER & CONTROLS */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '12px', borderRadius: '12px' }}>
              <Facebook style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
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

          {/* API Monitor */}
          {showMonitor && monitorStats && (
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '2px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#333' }}>🔍 API Usage Monitor</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '15px' }}>
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>DAILY</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{monitorStats.dailyCount}</div>
                  <div style={{ fontSize: '10px', color: '#999' }}>{monitorStats.dailyPercent}%</div>
                </div>
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>MONTHLY</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{monitorStats.monthlyCount}</div>
                  <div style={{ fontSize: '10px', color: '#999' }}>{monitorStats.monthlyPercent}%</div>
                </div>
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>SUCCESS</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                    {monitorStats.totalRequests > 0 ? ((monitorStats.successCount / monitorStats.totalRequests) * 100).toFixed(0) : 0}%
                  </div>
                </div>
                <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>ERRORS</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: monitorStats.errorCount > 0 ? '#ef4444' : '#10b981' }}>
                    {monitorStats.errorCount}
                  </div>
                </div>
              </div>

              {monitorStats.dailyWarning && <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#92400e', marginBottom: '8px' }}>⚠️ Near daily limit</div>}
              {monitorStats.monthlyWarning && <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>⚠️ Near monthly limit</div>}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: '#fee', border: '2px solid #fcc', borderRadius: '8px', padding: '15px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <AlertCircle style={{ color: '#c00', flexShrink: 0 }} /> 
              {error}
            </div>
          )}

          {/* Search */}
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
                background: loading ? '#999' : 'linear-gradient(135deg, #667eea, #764ba2)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '🔄 Searching...' : '🔍 Search'}
            </button>
          </div>

          {/* Filters */}
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>Min Discount:</span>
              <input 
                type="number" 
                value={minDiscount} 
                onChange={(e) => setMinDiscount(parseInt(e.target.value) || 0)} 
                style={{ width: '80px', padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
              <span>%</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input type="checkbox" checked={showOnlyWithCodes} onChange={(e) => setShowOnlyWithCodes(e.target.checked)} />
              <span>Only deals with codes</span>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input type="checkbox" checked={debugPromotions} onChange={(e) => setDebugPromotions(e.target.checked)} />
              <span>Debug mode</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '120px' }}>Max results:</span>
              <input 
                type="number" 
                value={maxResults} 
                onChange={(e) => setMaxResults(Math.max(1, parseInt(e.target.value) || 1))} 
                style={{ width: '100px', padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} 
              />
            </label>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{deals.length}</div>
              <div>Total</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{filtered.length}</div>
              <div>Showing</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                {deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.discount, 0) / deals.length) : 0}%
              </div>
              <div>Avg Discount</div>
            </div>
          </div>
        </div>

        {/* DEALS */}
        {displayedDeals.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '15px', padding: '60px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <Search style={{ width: '80px', height: '80px', color: '#ddd', margin: '0 auto 20px' }} />
            <h2>No deals yet!</h2>
            <p>Search for products above</p>
          </div>
        ) : (
          displayedDeals.map(deal => (
            <div 
              key={deal.id} 
              style={{ 
                background: 'white', 
                borderRadius: '15px', 
                padding: '25px', 
                marginBottom: '20px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                display: 'grid',
                gridTemplateColumns: '200px 1fr auto',
                gap: '25px'
              }}
            >
              
              {/* Image */}
              <div style={{ position: 'relative', minWidth: '200px' }}>
                <img 
                  src={deal.image} 
                  alt={deal.title} 
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' }} 
                  onError={(e) => e.target.src = 'https://via.placeholder.com/200'}
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

              {/* Details */}
              <div>
                <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>
                  {deal.title}
                  {lastAddedIds.includes(deal.id) && (
                    <span style={{ background: '#fde68a', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '8px' }}>NEW</span>
                  )}
                </h3>
                
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#f90' }}>⭐ {deal.rating}</span>
                  <span style={{ color: '#999', marginLeft: '10px' }}>({deal.reviewCount.toLocaleString()})</span>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#0a0' }}>
                    ${deal.currentPrice.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '18px', color: '#999', textDecoration: 'line-through', marginLeft: '10px' }}>
                    ${deal.originalPrice.toFixed(2)}
                  </span>
                </div>
                
                <div style={{ color: '#0a0', fontWeight: 'bold' }}>
                  💰 Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}!
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '150px' }}>
                {getDealCode(deal) && (
                  <button 
                    onClick={() => copy(getDealCode(deal))} 
                    style={{ padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    🎟️ Copy Code
                  </button>
                )}
                
                <button 
                  onClick={() => copy(generatePost(deal))} 
                  style={{ padding: '10px', background: '#1877f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  📘 Copy Post
                </button>
                
                <button 
                  onClick={() => shareToFacebook(deal)} 
                  style={{ padding: '10px', background: '#4267B2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  🔁 Share FB
                </button>
                
                <button 
                  onClick={() => copy(deal.url)} 
                  style={{ padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  🔗 Copy Link
                </button>
                
                <button 
                  onClick={() => window.open(deal.url, '_blank')} 
                  style={{ padding: '10px', background: '#ff9900', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  🛒 View Amazon
                </button>
                
                <button 
                  onClick={() => setDeals(deals.filter(d => d.id !== deal.id))} 
                  style={{ padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  🗑️ Remove
                </button>
              </div>
            </div>
          ))
        )}

        {/* Sentinel */}
        <div ref={sentinelRef} style={{ height: '1px' }}></div>
        
        {isLoadingMore && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Loading more deals...
          </div>
        )}

        {!noMorePages && displayedDeals.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button 
              onClick={loadMoreFromServer} 
              disabled={isLoadingMore} 
              style={{ 
                padding: '12px 20px', 
                background: isLoadingMore ? '#999' : '#1f2937', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;