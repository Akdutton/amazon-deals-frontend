import React, { useState, useEffect } from 'react';
import { Search, Trash2, Copy, Facebook, AlertCircle } from 'lucide-react';

function App() {
  const [deals, setDeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minDiscount, setMinDiscount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchProductsWithKeyword = async (keyword) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch ('https://amazon-deals-backend.onrender.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, minDiscount })
      });

      const data = await response.json();
      if (data.success) {
        const newDeals = data.deals.map(d => ({
          ...d,
          id: Date.now() + Math.random()
        }));
        setDeals(prev => [...prev, ...newDeals]);
      }
    } catch (err) {
      setError('Cannot connect to server!');
    }
    setLoading(false);
  };

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;
    await searchProductsWithKeyword(searchQuery);
    setSearchQuery('');
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
  }, []);

  const generatePost = (deal) => {
    return `🔥 DEAL ALERT! ${deal.discount}% OFF! 🔥

${deal.title}

💰 Was: $${deal.originalPrice.toFixed(2)}
✨ Now: $${deal.currentPrice.toFixed(2)}
💵 Save: $${(deal.originalPrice - deal.currentPrice).toFixed(2)}!

⭐ ${deal.rating}/5 (${deal.reviewCount.toLocaleString()} reviews)

Grab it now! 👇
${deal.url}

#AmazonDeals #Shopping #SaveMoney`;
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    alert('✅ Copied!');
  };

  const filtered = deals.filter(d => d.discount >= minDiscount);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
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

        {filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '15px', padding: '60px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <Search style={{ width: '80px', height: '80px', color: '#ddd', margin: '0 auto 20px' }} />
            <h2>No deals yet!</h2>
            <p>Search for products above</p>
          </div>
        ) : (
          filtered.map(deal => (
            <div key={deal.id} style={{ background: 'white', borderRadius: '15px', padding: '25px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '25px' }}>
                
                <div style={{ position: 'relative' }}>
                  <img src={deal.image} alt={deal.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' }} />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f00', color: 'white', padding: '8px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                    -{deal.discount}%
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>{deal.title}</h3>
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
                  <button onClick={() => copy(generatePost(deal))} style={{ padding: '12px', background: '#1877f2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    📘 Copy FB Post
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
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;