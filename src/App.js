import React, { useState, useEffect, useCallback } from 'react';
import { Search, Facebook, AlertCircle } from 'lucide-react';

function App() {
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
  const [deals, setDeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minDiscount, setMinDiscount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dedupeKey, setDedupeKey] = useState('asin');
  const [lastAddedIds, setLastAddedIds] = useState([]);
  const lastAddedTimerRef = React.useRef(null);
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize] = useState(30);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastKeyword, setLastKeyword] = useState('');
  const [noMorePages, setNoMorePages] = useState(false);
  const [debugPromotions, setDebugPromotions] = useState(false);

  const searchProductsWithKeyword = useCallback(async (keyword) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch (`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, minDiscount, debugPromotions })
      });

      const data = await response.json();
      if (data.success) {
        // ensure we track the keyword and reset paging when fresh results arrive
        setLastKeyword(keyword);
        setServerPage(1);
        setNoMorePages(false);

        // Preserve scroll position when prepending new items to avoid jump
        const scrollEl = document.scrollingElement || document.documentElement || document.body;
        const prevScrollTop = scrollEl.scrollTop;
        const prevScrollHeight = scrollEl.scrollHeight;

        const newDeals = data.deals.map(d => ({ ...d, id: Date.now() + Math.random() }));

        // Deduplicate by selected key (asin/url/title)
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
          const combined = [...uniqueNew, ...prev];

          // after React updates DOM, restore scroll to keep viewport stable
          setTimeout(() => {
            try {
              const newScrollHeight = scrollEl.scrollHeight;
              const delta = newScrollHeight - prevScrollHeight;
              // move the scroll down by the amount new content increased above
              if (delta !== 0) scrollEl.scrollTop = prevScrollTop + delta;
            } catch (e) {
              // ignore
            }
          }, 0);

          return combined;
        });
      }
    } catch (err) {
      setError('Cannot connect to server!');
    }
    setLoading(false);
  }, [minDiscount, API_BASE, dedupeKey, debugPromotions]);

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;
    // reset server paging when starting a fresh search
    setServerPage(1);
    setNoMorePages(false);
    setLastKeyword(searchQuery);
    await searchProductsWithKeyword(searchQuery);
    setSearchQuery('');
  };

  // Load more results from server (next page)
  const loadMoreFromServer = useCallback(async () => {
    if (isLoadingMore || noMorePages) return;
    setIsLoadingMore(true);
    const nextPage = serverPage + 1;
    try {
      const resp = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: lastKeyword, minDiscount, page: nextPage, pageSize: serverPageSize, debugPromotions })
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

  // Infinite scroll: use a sentinel div and IntersectionObserver
  const sentinelRef = React.useRef(null);
  useEffect(() => {
    // placeholder, actual observer is attached after filtered/displayedDeals are defined
  }, []);

  // Show only deals which include a coupon/code
  const [showOnlyWithCodes, setShowOnlyWithCodes] = useState(false);

  const getDealCode = (deal) => {
    return deal.code || deal.couponCode || deal.promoCode || deal.coupon || '';
  };

  // Auto-load deals when app starts
  useEffect(() => {
    const autoLoadDeals = async () => {
      console.log('🔄 Auto-loading deals...');
      const defaultKeywords = ['electronics', 'home kitchen', 'wireless'];
      
      for (const keyword of defaultKeywords) {
        await searchProductsWithKeyword(keyword);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };
    
    autoLoadDeals();
  }, [searchProductsWithKeyword]);

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

#AmazonDeals #Shopping #SaveMoney`;
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    alert('✅ Copied!');
  };

  const shareToFacebook = (deal) => {
    const quote = encodeURIComponent(generatePost(deal));
    // Use Facebook sharer dialog with quote param and the deal url as the shared link
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deal.url)}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const filtered = deals.filter(d => {
    if (d.discount < minDiscount) return false;
    if (showOnlyWithCodes && !getDealCode(d)) return false;
    return true;
  });

  // Max results control
  const [maxResults, setMaxResults] = useState(10);
  const displayedDeals = filtered.slice(0, maxResults);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalMeta, setExternalMeta] = useState(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);

  const fetchExternalMetadata = async () => {
    if (!externalUrl.trim()) return;
    setFetchingMeta(true);
    try {
      const resp = await fetch(`${API_BASE}/api/fetch-metadata`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: externalUrl }) });
      const data = await resp.json();
      if (data.success) setExternalMeta(data);
      else setExternalMeta({ title: '', description: '', image: '' });
    } catch (e) {
      setExternalMeta({ title: '', description: '', image: '' });
    }
    setFetchingMeta(false);
  };

  const generatePostForExternal = (meta, url) => {
    return `#ad\n\n${meta.title || url}\n\n${meta.description ? meta.description + '\n\n' : ''}${url}\n\n⚡Prices may change at any time.\n\n#AmazonDeals #SaveMoney`;
  };

  const shareExternalOnFacebook = (meta, url) => {
    const quote = encodeURIComponent(generatePostForExternal(meta, url));
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // Now that filtered/displayedDeals are defined, attach the intersection observer
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && filtered.length > displayedDeals.length) {
          loadMoreFromServer();
        }
      });
    }, { root: null, rootMargin: '200px', threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMoreFromServer, filtered.length, displayedDeals.length]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ overflowAnchor: 'none' }}>
        
        <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '12px', borderRadius: '12px' }}>
              <Facebook style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '32px' }}>Amazon Deals Finder</h1>
              <p style={{ margin: 0, color: '#666' }}>Find hot deals for Facebook</p>
            </div>
          </div>

          {/* Debug info: last fetch/unique counts */}
          <div style={{ marginBottom: '10px', color: '#666', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>Dedupe key:</span>
              <select value={dedupeKey} onChange={(e) => setDedupeKey(e.target.value)}>
                <option value="asin">ASIN</option>
                <option value="url">URL</option>
                <option value="title">Title</option>
              </select>
            </label>
            <div style={{ marginLeft: 'auto', fontSize: '13px' }}>
              Page: {serverPage} · PageSize: {serverPageSize} · Loading more: {isLoadingMore ? 'yes' : 'no'} · No more pages: {noMorePages ? 'yes' : 'no'}
            </div>
          </div>

          {error && (
            <div style={{ background: '#fee', border: '2px solid #fcc', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
              <AlertCircle style={{ display: 'inline', color: '#c00' }} /> {error}
            </div>
          )}

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
              style={{ padding: '15px 30px', fontSize: '16px', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? '🔄 Searching...' : '🔍 Search'}
            </button>
          </div>

          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Min Discount:</span>
              <input type="number" value={minDiscount} onChange={(e) => setMinDiscount(parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} />
              <span>%</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input type="checkbox" checked={showOnlyWithCodes} onChange={(e) => setShowOnlyWithCodes(e.target.checked)} />
              <span style={{ fontWeight: 'bold' }}>Only show deals with codes</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input type="checkbox" checked={debugPromotions} onChange={(e) => setDebugPromotions(e.target.checked)} />
              <span style={{ fontWeight: 'bold' }}>Debug promotions (include raw promotions)</span>
            </label>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="text" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="Paste external URL to generate FB post" style={{ flex: 1, padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} />
              <button onClick={fetchExternalMetadata} disabled={fetchingMeta} style={{ padding: '8px 12px', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none' }}>{fetchingMeta ? 'Fetching...' : 'Fetch'}</button>
            </div>
            {externalMeta && (
              <div style={{ marginTop: '10px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold' }}>{externalMeta.title || 'No title found'}</div>
                {externalMeta.description && <div style={{ color: '#666', marginTop: '6px' }}>{externalMeta.description}</div>}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => copy(generatePostForExternal(externalMeta, externalUrl))} style={{ padding: '8px 12px', borderRadius: '6px', background: '#1877f2', color: 'white', border: 'none' }}>📘 Copy FB Post</button>
                  <button onClick={() => shareExternalOnFacebook(externalMeta, externalUrl)} style={{ padding: '8px 12px', borderRadius: '6px', background: '#4267B2', color: 'white', border: 'none' }}>🔁 Share on Facebook</button>
                </div>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Max results:</span>
              <input type="number" value={maxResults} onChange={(e) => setMaxResults(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '100px', padding: '8px', border: '2px solid #ddd', borderRadius: '6px' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{deals.length}</div>
              <div>Total Deals</div>
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

        {displayedDeals.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '15px', padding: '60px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <Search style={{ width: '80px', height: '80px', color: '#ddd', margin: '0 auto 20px' }} />
            <h2>No deals yet!</h2>
            <p>Search for products above</p>
          </div>
        ) : (
          displayedDeals.map(deal => (
            <div key={deal.id} style={{ background: 'white', borderRadius: '15px', padding: '25px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', contain: 'layout paint' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '25px' }}>
                
                <div style={{ position: 'relative', minWidth: '200px' }}>
                  <img src={deal.image} alt={deal.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f00', color: 'white', padding: '8px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                    -{deal.discount}%
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>
                    {deal.title} {lastAddedIds.includes(deal.id) && <span style={{ background: '#fde68a', color: '#92400e', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', marginLeft: '8px' }}>NEW</span>}
                  </h3>
                  <div style={{ marginBottom: '15px' }}>
                    <span style={{ color: '#f90' }}>⭐ {deal.rating}</span>
                    <span style={{ color: '#999', marginLeft: '10px' }}>({deal.reviewCount.toLocaleString()})</span>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#0a0' }}>${deal.currentPrice.toFixed(2)}</span>
                    <span style={{ fontSize: '20px', color: '#999', textDecoration: 'line-through', marginLeft: '10px' }}>${deal.originalPrice.toFixed(2)}</span>
                  </div>
                  <div style={{ color: '#0a0', fontWeight: 'bold' }}>
                    💰 Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}!
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getDealCode(deal) && (
                    <button onClick={() => copy(getDealCode(deal))} style={{ padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      🎟️ Copy Code
                    </button>
                  )}
                  <button onClick={() => copy(generatePost(deal))} style={{ padding: '12px', background: '#1877f2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    📘 Copy FB Post
                  </button>
                  <button onClick={() => shareToFacebook(deal)} style={{ padding: '12px', background: '#4267B2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    🔁 Share on Facebook
                  </button>
                  <button onClick={() => copy(deal.url)} style={{ padding: '12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    🔗 Copy Link
                  </button>
                  <button onClick={() => window.open(deal.url, '_blank')} style={{ padding: '12px', background: '#ff9900', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    🛒 View on Amazon
                  </button>
                  <button onClick={() => setDeals(deals.filter(d => d.id !== deal.id))} style={{ padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    🗑️ Remove
                  </button>
                  {deal.rawPromotions && (
                    <pre style={{ whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#333' }}>
                      {JSON.stringify(deal.rawPromotions, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Reserve space while loading more to avoid layout jumps */}
        {isLoadingMore && (
          <>
            {Array.from({ length: serverPageSize }).map((_, idx) => (
              <div key={`ph-${idx}`} style={{ height: '260px', marginBottom: '20px', borderRadius: '15px', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }} />
            ))}
          </>
        )}

        {/* Load more button (server) & sentinel for infinite scroll */}
        {!noMorePages ? (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button onClick={() => loadMoreFromServer()} disabled={isLoadingMore} style={{ padding: '12px 20px', background: isLoadingMore ? '#6b7280' : '#1f2937', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoadingMore ? 'not-allowed' : 'pointer' }}>
              {isLoadingMore ? 'Loading more...' : 'Load more from server'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>No more pages</div>
        )}

  <div ref={sentinelRef} style={{ height: '1px' }} />
  </div>
        {isLoadingMore && (
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>Loading more...</div>
        )}
      </div>
    </div>
  );
}

export default App;