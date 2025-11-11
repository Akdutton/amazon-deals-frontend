// App.js - Amazon Deals Finder Frontend
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Facebook, AlertCircle } from 'lucide-react';

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
  const [aiStatuses, setAiStatuses] = useState({}); // per-deal AI status
  const AI_MODELS = [
    { id: 'mistralai/mistral-7b-instruct:free', label:'⚡ Mistral 7B (Free, Fast)', price: 'FREE'},
    { id: 'meta-llama/llama-2-7b-chat', label: '🦙 Llama 2 7B (Fast)', price: 'FREE'},
    { id: 'gpt-3.5-turbo', label: '🚀 GPT-3.5 Turbo (Best Quality)', price: '$' },
  ]

  const sentinelRef = useRef(null);

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
            `Server error: ${data.error || data.message || 'Unknown error from server'}`
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
        setError(`Cannot connect to server: ${err.message}`);
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
    return `#ad 🔥 DEAL ALERT! ${deal.discount}% OFF! 🔥 ${deal.title} 💰 Was: $${deal.originalPrice.toFixed(
      2
    )} ✨ Now: $${deal.currentPrice.toFixed(2)} 💵 Save: $${(
      deal.originalPrice - deal.currentPrice
    ).toFixed(2)}! ⭐ ${deal.rating}/5 (${deal.reviewCount.toLocaleString()} reviews) ${
      code ? `Use code: ${code}\n\n` : ''
    }Grab it now! 👇 ${deal.url} ⚡Prices may change at any time. #AmazonDeals #AllAboutSavings`;
  };

  const copy = (text) => {
    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/["']/g, "'")
      .trim();
    navigator.clipboard.writeText(cleanText);
    alert('✅ Copied!');
  };

  const shareToFacebook = (deal) => {
    const quote = encodeURIComponent(generatePost(deal));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      deal.url
    )}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };
  {/* --- AI Model Selector --- */}
<div style={{ 
  marginBottom: '30px', 
  padding: '20px', 
  backgroundColor: 'rgba(255,255,255,0.95)', 
  borderRadius: '12px',
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
    💡 Tip: Mistral is fastest & free. GPT-3.5 is best quality.
  </small>
</div>

  const fetchExternalMetadata = async () => {
    if (!externalUrl.trim()) return;
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
      setExternalMeta({ title: '', description: '', image: '' });
    }
    setFetchingMeta(false);
  };

  const generatePostForExternal = (meta, url) => {
    const origPrice = externalOriginalPrice || meta.originalPrice || '';
    const currPrice = externalCurrentPrice || meta.discountedPrice || '';
    const discount = externalDiscount || '';
    const couponCode = externalCouponCode || meta.couponCode || '';

    let priceSection = '';
    if (discount) priceSection += `\n🔥 ${discount}% OFF! 🔥\n\n`;
    if (origPrice && currPrice) {
      const diff = parseFloat(origPrice) - parseFloat(currPrice);
      const savings = diff > 0 ? diff.toFixed(2) : '';
      priceSection += `💰 Was: ${origPrice}\n✨ Now: ${currPrice}\n`;
      if (savings) priceSection += `💵 Save $${savings}!\n`;
      priceSection += '\n';
    } else if (currPrice) priceSection += `💰 Price: ${currPrice}\n\n`;
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* --- Header, Search, Filters, Monitor --- */}
        {/* ... Keep all your existing header/search/filter code as-is ... */}
        {/* --- AI External URL Rewrite Section --- */}
        <div>
          <input
            type="text"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Paste Amazon URL to create Facebook post"
          />
          <button onClick={fetchExternalMetadata}>Fetch</button>

          <input
            type="number"
            value={externalOriginalPrice}
            onChange={(e) => setExternalOriginalPrice(e.target.value)}
            placeholder="Original Price ($)"
          />
          <input
            type="number"
            value={externalCurrentPrice}
            onChange={(e) => setExternalCurrentPrice(e.target.value)}
            placeholder="Current Price ($)"
          />
          <input
            type="number"
            value={externalDiscount}
            onChange={(e) => setExternalDiscount(e.target.value)}
            placeholder="Discount (%)"
          />
          <input
            type="text"
            value={externalCouponCode}
            onChange={(e) => setExternalCouponCode(e.target.value)}
            placeholder="Coupon Code"
          />

          <button
            onClick={async () => {
              try {
                setRewritingExternal(true);
                setExternalRewritten('');
                if (!externalUrl.trim()) {
                  alert('Please enter a URL or product description');
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
                  setExternalRewritten('⏳ Model is warming up. Please try again in a few seconds.');
                else alert(`AI rewrite failed: ${data.error || data.message}`);
              } catch (err) {
                alert(`AI rewrite failed: ${err.message}`);
              } finally {
                setRewritingExternal(false);
              }
            }}
            disabled={rewritingExternal || !externalUrl}
          >
            {rewritingExternal ? '⏳ Rewriting…' : '🤖 AI Rewrite'}
          </button>
        </div>

        {/* --- Deals List --- */}
        {displayedDeals.map((deal) => (
          <div key={deal.id}>
            <h3>{deal.title}</h3>
            <div>
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
                      alert(`Rewrite failed: ${data.error || data.message}`);
                    }
                  } catch (err) {
                    setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Error ❌' }));
                    alert(`AI rewrite failed: ${err.message}`);
                  } finally {
                    setTimeout(() => {
                      setAiStatuses((prev) => ({ ...prev, [deal.id]: 'Ready' }));
                    }, 3000);
                  }
                }}
                disabled={aiStatuses[deal.id] === 'Processing…'}
              >
                {aiStatuses[deal.id] === 'Processing…' ? '⏳ Rewriting…' : '🤖 AI Rewrite'}
              </button>
              <button onClick={() => copy(generatePost(deal))}>Copy FB Post</button>
              <button onClick={() => shareToFacebook(deal)}>Share FB</button>
            </div>
            {deal.rewritten && <textarea readOnly value={deal.rewritten}></textarea>}
          </div>
        ))}

      </div>
    </div>
  );
}

export default App;
