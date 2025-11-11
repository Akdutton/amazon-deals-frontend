// App.js - Amazon Deals Finder Frontend (Complete)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Facebook, AlertCircle, Settings } from 'lucide-react';

function App() {
  // ========================================
  // CONFIGURATION
  // ========================================
  const API_BASE =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      : 'https://amazon-deals-backend.onrender.com';

  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [deals, setDeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minDiscount, setMinDiscount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dedupeKey] = useState('asin');
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
  const [rewritingExternal, setRewritingExternal] = useState(false);
  const [externalRewritten, setExternalRewritten] = useState('');

  const [monitorStats, setMonitorStats] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);

  const [aiModel, setAiModel] = useState('mistralai/mistral-7b-instruct:free');
  const [aiStatuses, setAiStatuses] = useState({});

  const sentinelRef = useRef(null);

  // ✅ AI Models List
  const AI_MODELS = [
    { id: 'mistralai/mistral-7b-instruct:free', label: '⚡ Mistral 7B (Free, Fast)', price: 'FREE' },
    { id: 'meta-llama/llama-2-7b-chat', label: '🦙 Llama 2 7B (Fast)', price: 'FREE' },
    { id: 'gpt-3.5-turbo', label: '🚀 GPT-3.5 Turbo (Best Quality)', price: '$' },
  ];

  // ========================================
  // API FUNCTIONS
  // ========================================

  const searchProductsWithKeyword = useCallback(
    async (keyword) => {
      setLoading(true);
      setError('');
      try {
        if (!keyword || keyword.trim().length === 0) {
          setError('❌ Keyword cannot be empty');
          setLoading(false);
          return;
        }

        const searchPayload = {
          keyword: keyword.trim(),
          minDiscount: Number(minDiscount) || 0,
          page: 1,
          pageSize: 30,
          debugPromotions: debugPromotions === true,
        };

        const response = await fetch(`${API_BASE}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchPayload),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(
            `❌ ${data.error || data.message || 'Unknown error from server'}`
          );
          setLoading(false);
          return;
        }

        if (data.success) {
          setLastKeyword(keyword);
          setServerPage(1);
          setNoMorePages(false);

          const newDeals = data.deals.map((d) => ({
            ...d,
            id: Date.now() + Math.random(),
          }));

          setDeals((prev) => {
            const existingKeys = new Set(
              prev.map((p) => p[dedupeKey] || p.asin || p.url || p.title)
            );
            const uniqueNew = newDeals.filter((n) => {
              const key = n[dedupeKey] || n.asin || n.url || n.title;
              return key && !existingKeys.has(key);
            });
            const addedIds = uniqueNew.map((n) => n.id);
            if (addedIds.length > 0) {
              setLastAddedIds(addedIds);
              if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
              lastAddedTimerRef.current = setTimeout(() => setLastAddedIds([]), 10000);
            }
            return [...uniqueNew, ...prev];
          });
        } else {
          setError(`❌ ${data.error || 'Failed to fetch deals'}`);
        }
      } catch (err) {
        setError(`❌ Cannot connect to server: ${err.message}`);
      }
      setLoading(false);
    },
    [minDiscount, API_BASE, dedupeKey, debugPromotions]
  );

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
          debugPromotions: debugPromotions === true,
        }),
      });
      const data = await resp.json();

      if (data.success) {
        const newDeals = data.deals.map((d) => ({
          ...d,
          id: Date.now() + Math.random(),
        }));
        setDeals((prev) => {
          const existingKeys = new Set(
            prev.map((p) => p[dedupeKey] || p.asin || p.url || p.title)
          );
          const uniqueNew = newDeals.filter((n) => {
            const key = n[dedupeKey] || n.asin || n.url || n.title;
            return key && !existingKeys.has(key);
          });
          if (uniqueNew.length === 0) setNoMorePages(true);

          const addedIds = uniqueNew.map((n) => n.id);
          if (addedIds.length > 0) {
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
  }, [
    isLoadingMore,
    serverPage,
    serverPageSize,
    lastKeyword,
    minDiscount,
    API_BASE,
    dedupeKey,
    noMorePages,
    debugPromotions,
  ]);

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  const getDealCode = (deal) => deal.code || deal.couponCode || deal.promoCode || deal.coupon || '';

  const generatePost = (deal) => {
    const code = getDealCode(deal);
    return `#ad 🔥 DEAL ALERT! ${deal.discount}% OFF! 🔥\n\n${deal.title}\n\n💰 Was: $${deal.originalPrice.toFixed(2)}\n✨ Now: $${deal.currentPrice.toFixed(2)}\n💵 Save: $${(deal.originalPrice - deal.currentPrice).toFixed(2)}!\n\n⭐ ${deal.rating}/5 (${deal.reviewCount.toLocaleString()} reviews)\n\n${code ? `Use code: ${code}\n\n` : ''}Grab it now! 👇\n${deal.url}\n\n⚡Prices may change at any time.\n#AmazonDeals #AllAboutSavings`;
  };

  const copy = (text) => {
    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    navigator.clipboard.writeText(cleanText);
    alert('✅ Copied to clipboard!');
  };

  const shareToFacebook = (deal) => {
    const quote = encodeURIComponent(generatePost(deal));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      deal.url
    )}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const fetchExternalMetadata = async () => {
    if (!externalUrl.trim()) {
      alert('Please enter a URL');
      return;
    }
    setFetchingMeta(true);
    try {
      const resp = await fetch(`${API_BASE}/api/fetch-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: externalUrl }),
      });
      const data = await resp.json();
      setExternalMeta(data.success ? data : { title: '', description: '', image: '' });
    } catch (e) {
      setExternalMeta({ title: '', description: '', image: '', error: e.message });
    }
    setFetchingMeta(false);
  };

  const generatePostForExternal = (meta, url) => {
    const origPrice = externalOriginalPrice || meta.originalPrice || '';
    const currPrice = externalCurrentPrice || meta.discountedPrice || '';
    const discount = externalDiscount || '';
    const couponCode = externalCouponCode || meta.couponCode || '';

    let priceSection = '';
    if (discount) priceSection += `🔥 ${discount}% OFF! 🔥\n\n`;
    if (origPrice && currPrice) {
      const diff = parseFloat(origPrice) - parseFloat(currPrice);
      const savings = diff > 0 ? diff.toFixed(2) : '';
      priceSection += `💰 Was: $${origPrice}\n✨ Now: $${currPrice}\n`;
      if (savings) priceSection += `💵 Save $${savings}!\n`;
      priceSection += '\n';
    } else if (currPrice) priceSection += `💰 Price: $${currPrice}\n\n`;
    if (couponCode) priceSection += `Use code: ${couponCode}\n\n`;

    return `#ad\n\n${priceSection}${meta.title || url}\n\n${
      meta.description ? meta.description + '\n\n' : ''
    }Grab it now! 👇\n${url}\n\n⚡Prices may change at any time.\n\n#AmazonDeals #AllAboutSavings`;
  };

  const shareExternalOnFacebook = (meta, url) => {
    const quote = encodeURIComponent(generatePostForExternal(meta, url));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url
    )}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // ========================================
  // AUTO-LOAD DEALS ON STARTUP
  // ========================================
  useEffect(() => {
    const autoLoadDeals = async () => {
      const defaultKeywords = ['electronics', 'home kitchen', 'wireless'];
      for (const keyword of defaultKeywords) {
        try {
          await searchProductsWithKeyword(keyword);
          await new Promise((r) => setTimeout(r, 1000));
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
  const filtered = deals.filter((d) => {
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
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && filtered.length > displayedDeals.length) {
            loadMoreFromServer();
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMoreFromServer, filtered.length, displayedDeals.length]);

  // ========================================
  // RENDER UI
  // ========================================
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* ========== HEADER ========== */}
        <div style={{ textAlign: 'center', marginBottom: '30px', color: 'white' }}>
          <h1 style={{ fontSize: '48px', margin: '0 0 10px 0' }}>💰 Amazon Deals Finder</h1>
          <p style={{ fontSize: '16px', margin: 0, opacity: 0.9 }}>Find the best deals and create viral Facebook posts</p>
        </div>

        {/* ========== ERROR DISPLAY ========== */}
        {error && (
          <div style={{ 
            backgroundColor: '#fee', 
            border: '2px solid #f66', 
            borderRadius: '8px', 
            padding: '15px', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle color="#f66" size={24} />
            <span style={{ color: '#c33', fontSize: '15px' }}>{error}</span>
          </div>
        )}

        {/* ========== SEARCH BAR ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1, display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                placeholder="Search for products (e.g., laptop, headphones, phone)..."
                style={{
                  flex: 1,
                  padding: '12px 15px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  outline: 'none'
                }}
              />
              <button
                onClick={searchProducts}
                disabled={loading}
                style={{
                  padding: '12px 25px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: loading ? 0.7 : 1
                }}
              >
                <Search size={18} />
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            <button
              onClick={() => setShowMonitor(!showMonitor)}
              style={{
                padding: '12px 20px',
                backgroundColor: showMonitor ? '#764ba2' : '#999',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Settings size={18} />
              Monitor
            </button>
          </div>

          {/* ========== FILTERS ========== */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                Minimum Discount: {minDiscount}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                Max Results: {maxResults}
              </label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={showOnlyWithCodes}
                  onChange={(e) => setShowOnlyWithCodes(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>Only deals with coupon codes</span>
              </label>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={debugPromotions}
                  onChange={(e) => setDebugPromotions(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>Debug promotions (dev)</span>
              </label>
            </div>
          </div>
        </div>

        {/* ========== AI MODEL SELECTOR ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '16px' }}>
            🤖 Select AI Model:
          </label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #667eea',
              fontSize: '15px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              width: '100%',
              maxWidth: '500px'
            }}
          >
            {AI_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.label} ({model.price})
              </option>
            ))}
          </select>
          <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
            💡 Mistral is fastest. GPT-3.5 has best quality.
          </small>
        </div>

        {/* ========== EXTERNAL URL SECTION ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>🔗 Create Post from External URL</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="Paste Amazon URL..."
              style={{
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                gridColumn: 'span 2'
              }}
            />
            <button
              onClick={fetchExternalMetadata}
              disabled={fetchingMeta}
              style={{
                padding: '12px 20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {fetchingMeta ? '⏳ Fetching...' : '📥 Fetch Metadata'}
            </button>
          </div>

          {externalMeta && (
            <div style={{
              backgroundColor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '15px'
            }}>
              {externalMeta.image && (
                <img src={externalMeta.image} alt="preview" style={{ maxWidth: '100%', maxHeight: '200px', marginBottom: '10px', borderRadius: '8px' }} />
              )}
              <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Title:</strong> {externalMeta.title}</p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Description:</strong> {externalMeta.description}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' }}>
            <input
              type="number"
              value={externalOriginalPrice}
              onChange={(e) => setExternalOriginalPrice(e.target.value)}
              placeholder="Original Price ($)"
              style={{ padding: '10px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            />
            <input
              type="number"
              value={externalCurrentPrice}
              onChange={(e) => setExternalCurrentPrice(e.target.value)}
              placeholder="Current Price ($)"
              style={{ padding: '10px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            />
            <input
              type="number"
              value={externalDiscount}
              onChange={(e) => setExternalDiscount(e.target.value)}
              placeholder="Discount (%)"
              style={{ padding: '10px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            />
            <input
              type="text"
              value={externalCouponCode}
              onChange={(e) => setExternalCouponCode(e.target.value)}
              placeholder="Coupon Code"
              style={{ padding: '10px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={async () => {
                try {
                  setRewritingExternal(true);
                  setExternalRewritten('');
                  if (!externalUrl.trim()) {
                    alert('Please enter a URL');
                    setRewritingExternal(false);
                    return;
                  }
                  const resp = await fetch(`${API_BASE}/api/rewrite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: externalUrl.trim(), model: aiModel }),
                  });
                  const data = await resp.json();
                  if (data.success) setExternalRewritten(data.rewritten);
                  else if (data.retry)
                    setExternalRewritten('⏳ Model warming up. Try again in a few seconds.');
                  else alert(`Rewrite failed: ${data.error}`);
                } catch (err) {
                  alert(`Error: ${err.message}`);
                } finally {
                  setRewritingExternal(false);
                }
              }}
              disabled={rewritingExternal || !externalUrl}
              style={{
                padding: '12px 20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {rewritingExternal ? '⏳ Rewriting…' : '🤖 AI Rewrite'}
            </button>
            {externalRewritten && (
              <>
                <button
                  onClick={() => copy(externalRewritten)}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#764ba2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  📋 Copy Post
                </button>
                <button
                  onClick={() => shareExternalOnFacebook(externalMeta || {}, externalUrl)}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#0A66C2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 'bold'
                  }}
                >
                  <Facebook size={18} />
                  Share on FB
                </button>
              </>
            )}
          </div>

          {externalRewritten && (
            <div style={{
              backgroundColor: '#f0f0f0',
              border: '2px solid #667eea',
              borderRadius: '8px',
              padding: '15px',
              marginTop: '15px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6'
            }}>
              {externalRewritten}
            </div>
          )}
        </div>

        {/* ========== MONITORING STATS ========== */}
        {showMonitor && monitorStats && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>📊 API Monitoring</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div><strong>Total Requests:</strong> {monitorStats.totalRequests}</div>
              <div><strong>Success:</strong> {monitorStats.successCount}</div>
              <div><strong>Errors:</strong> {monitorStats.errorCount}</div>
              <div><strong>Throttled:</strong> {monitorStats.throttleCount}</div>
              <div><strong>Daily:</strong> {monitorStats.dailyCount}/{monitorStats.dailyLimit} ({monitorStats.dailyPercent}%)</div>
              <div><strong>Monthly:</strong> {monitorStats.monthlyCount}/{monitorStats.monthlyLimit} ({monitorStats.monthlyPercent}%)</div>
            </div>
          </div>
        )}

        {/* ========== DEALS LIST ========== */}
        <div>
          <h2 style={{ color: 'white', marginBottom: '20px' }}>
            🎯 {displayedDeals.length > 0 ? `Found ${displayedDeals.length} deals` : 'No deals found'}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {displayedDeals.map((deal) => (
              <div
              key={deal.id}
              style={{
                backgroundColor: lastAddedIds.includes(deal.id) ? '#fffacd' : 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                 e.currentTarget.style.transform = 'translateY(-4px)';
                 e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                 e.currentTarget.style.transform = 'translateY(0)';
                 e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
             >
                {/* Deal Image */}
                {deal.image && (
                  <img src={deal.image} alt={deal.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                )}

                {/* Deal Info */}
                <div style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '16px', lineHeight: '1.4', minHeight: '50px' }}>
                        {deal.title}
                      </h3>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                        <span>⭐ {deal.rating}/5</span>
                        <span>👥 {deal.reviewCount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: '#ff6b6b',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      whiteSpace: 'nowrap'
                    }}>
                      {deal.discount}% OFF
                    </div>
                  </div>

                  {/* Pricing */}
                  <div style={{ backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
                    <div style={{ textDecoration: 'line-through', color: '#999', fontSize: '14px' }}>
                      ${deal.originalPrice.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                      ${deal.currentPrice.toFixed(2)}
                    </div>
                    <div style={{ color: '#28a745', fontSize: '13px', marginTop: '5px' }}>
                      Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                    </div>
                  </div>

                  {/* Coupon Code */}
                  {getDealCode(deal) && (
                    <div style={{
                      backgroundColor: '#e7f5ff',
                      border: '2px dashed #667eea',
                      padding: '8px',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: '#667eea'
                    }}>
                      Code: {getDealCode(deal)}
                    </div>
                  )}

                  {/* Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <button
                      onClick={async () => {
                        try {
                          setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Processing…' }));
                          const resp = await fetch(`${API_BASE}/api/rewrite`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: generatePost(deal), model: aiModel }),
                          });
                          const data = await resp.json();
                          if (data.success) {
                            setDeals((prev) =>
                              prev.map((d) => (d.id === deal.id ? { ...d, rewritten: data.rewritten } : d))
                            );
                            setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Done ✅' }));
                          } else {
                            setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Error ❌' }));
                            alert(`Error: ${data.error}`);
                          }
                        } catch (err) {
                          setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Error ❌' }));
                          alert(`Error: ${err.message}`);
                        }
                        setTimeout(() => {
                          setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Ready' }));
                        }, 3000);
                      }}
                      disabled={aiStatuses[deal.id] === 'Processing…'}
                      style={{
                        padding: '10px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        opacity: aiStatuses[deal.id] === 'Processing…' ? 0.7 : 1
                      }}
                    >
                      {aiStatuses[deal.id] ? aiStatuses[deal.id] : '🤖 AI Rewrite'}
                    </button>
                    <button
                      onClick={() => copy(generatePost(deal))}
                      style={{
                        padding: '10px',
                        backgroundColor: '#764ba2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                      }}
                    >
                      📋 Copy Post
                    </button>
                  </div>

                  <button
                    onClick={() => shareToFacebook(deal)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#0A66C2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Facebook size={18} />
                    Share on Facebook
                  </button>

                  {/* Rewritten Post */}
                  {deal.rewritten && (
                    <div style={{
                      marginTop: '12px',
                      backgroundColor: '#f0f0f0',
                      border: '2px solid #667eea',
                      borderRadius: '6px',
                      padding: '10px',
                      fontSize: '12px',
                      maxHeight: '200px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.4'
                    }}>
                      {deal.rewritten}
                    </div>
                  )}

                  {/* Deal URL */}
                  <a
                    href={deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '10px',
                      color: '#667eea',
                      textDecoration: 'none',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    🔗 View on Amazon
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========== LOAD MORE SENTINEL ========== */}
        <div ref={sentinelRef} style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
          {isLoadingMore && <div>⏳ Loading more deals...</div>}
          {noMorePages && displayedDeals.length > 0 && <div>✅ No more deals to load</div>}
        </div>
      </div>
    </div>
  );
}

export default App;