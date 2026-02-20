# Amazon Deals Generator – React AI App

React frontend for **Amazon API deals search + AI rewrite descriptions** (OpenRouter backend).

![React](https://img.shields.io/badge/React-18-blue) 
![AI](https://img.shields.io/badge/AI-Rewrite-orange) 
![Amazon](https://img.shields.io/badge/Amazon-PA_API-yellow) 
![Vercel](https://img.shields.io/badge/Vercel-Live-black) 
![Render](https://img.shields.io/badge/Render-Backend-green)


## 🎯 Features
- Input desc → Amazon PA API deals search/display.
- **AI rewrites descriptions** (prompt eng).
- Multi-model (Mistral/Qwen via OpenRouter).


## Backend Tech (Private Render)
Custom Express server:
- Amazon PA API proxy (SigV4, quotas).
- OpenRouter AI rewrite (multi-model).

Snippet (/api/rewrite):
``` js
app.post('/api/rewrite', async (req, res) => {
  const { text, model } = req.body;
  
  const selectedModel = model || 'mistralai/mistral-7b-instruct:free';
  
  const prompt = `Rewrite product details into Facebook post format...\n\n${text}`;
  
  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: selectedModel,
    messages: [
      { role: 'system', content: 'Expert ad copywriter.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500
  }, {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const rewritten = response.data.choices[0].message.content.trim();
  res.json({ success: true, rewritten });
});
