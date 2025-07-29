import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import NodeCache from 'node-cache';

dotenv.config();

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache for responses (1 hour TTL)
const cache = new NodeCache({ stdTTL: 3600 });

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.anthropic.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://oked-catalogue-assistant.vercel.app',
    'https://oked-catalogue-assistant-a7uohyna6-kazdatahelps-projects.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// Enhanced Claude API endpoint with OKED integration and fallback support
app.post('/api/claude', async (req, res) => {
  try {
    const { messages, model = 'claude-3-5-sonnet-20241022' } = req.body;
    
    // Comprehensive input validation
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Validate messages array length
    if (messages.length === 0) {
      return res.status(400).json({ error: 'Messages array cannot be empty' });
    }

    if (messages.length > 50) {
      return res.status(400).json({ error: 'Too many messages in conversation' });
    }

    // Validate each message structure
    for (const message of messages) {
      if (!message.role || !message.content) {
        return res.status(400).json({ error: 'Invalid message format: role and content required' });
      }
      
      if (!['user', 'assistant', 'system'].includes(message.role)) {
        return res.status(400).json({ error: 'Invalid message role' });
      }
      
      if (typeof message.content !== 'string') {
        return res.status(400).json({ error: 'Message content must be a string' });
      }
      
      if (message.content.length > 10000) {
        return res.status(400).json({ error: 'Message content too long' });
      }
    }

    // Validate model parameter
    const allowedModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229'
    ];
    
    if (!allowedModels.includes(model)) {
      return res.status(400).json({ error: 'Invalid model specified' });
    }

    // Extract the user query from messages
    const userMessage = messages.find(m => m.role === 'user');
    if (!userMessage) {
      return res.status(400).json({ error: 'No user message found' });
    }

    // Create cache key
    const cacheKey = `enhanced_claude_${JSON.stringify(messages)}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Check if Anthropic API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Anthropic API key not configured, returning fallback response');
      return generateFallbackResponse(userMessage.content, res, cache, cacheKey);
    }

    // Enhanced approach: Let Claude handle everything with rich context
    try {
      // Create enhanced prompt with OKED and Kazakhstan business context
      const enhancedPrompt = `You are an expert OKED (Kazakhstan Economic Activity Classification) consultant and business intelligence analyst for Kazakhstan.

CONTEXT: OKED Classification System
- OKED is Kazakhstan's standard for economic activity classification
- Based on international NACE Rev.2 standards  
- Hierarchical structure: Sections (A-U) → Groups (2-digit) → Classes (3-digit) → Subclasses (4-digit) → Activities (5-digit)
- Required for business registration, taxation, and statistical reporting

KAZAKHSTAN BUSINESS STATISTICS (Official stat.gov.kz data):
- Total Registered Entities: 2,383,083 businesses
- Legal Entities: 543,725 (22.8%) - Medium to large businesses
- Individual Entrepreneurs: 1,839,358 (77.2%) - Small business backbone
- Annual Growth Rate: 4.5% sustainable growth over past decade
- Active Business Rate: ~85% of registered entities remain operational

SECTOR DISTRIBUTION:
- Trade & Services (Sections G, I, M, N): 60% of businesses - Stable growth
- Manufacturing (Section C): 15% - Technology modernization focus
- Construction (Section F): 8% - Infrastructure boom 
- Agriculture (Section A): 12% - Digitalization opportunities
- IT & Communications (Section J): 3% - Fastest growing (+12.3% annually)
- Other Sectors: 2% - Specialized services

REGIONAL DISTRIBUTION:
- Almaty: 35% of businesses - Financial & tech hub, high competition
- Nur-Sultan: 28% - Government & corporate services, growing startups  
- Shymkent: 8% - Manufacturing & trade opportunities
- Atyrau/Mangystau: 6% - Energy sector, service gaps
- Other Regions: 23% - Agriculture & regional services, expansion potential

MARKET OPPORTUNITIES:
- High-Growth Sectors: IT (+12.3%), E-commerce (+8.7%), Renewable Energy (+6.2%)
- Emerging Markets: AgriTech, FinTech, Green Technology, Tourism Tech
- Investment: $24.3B foreign investment in 2023 (energy, mining, technology)
- Government Support: Tax incentives, special economic zones, digital grants

USER QUERY: "${userMessage.content}"

INSTRUCTIONS:
1. Respond in the same language as the user's query (e.g., if the query is in Russian, respond in Russian).
2. Provide comprehensive, accurate information about OKED classification 
3. Include relevant business statistics for Kazakhstan when discussing industries
4. Format responses as JSON with this structure:
{
  "response": "detailed answer with Kazakhstan business context",
  "codes": [{"code": "XXXXX", "name": "Activity name", "level": "Activity level", "explanation": "relevance"}],
  "suggestions": ["related query 1", "related query 2", "related query 3"],
  "confidence": "high|medium|low",
  "queryType": "business_stats|knowledge|search|code"
}

4. For business statistics queries, include real Kazakhstan data and growth trends
5. For OKED codes, provide complete hierarchy and examples
6. Always include actionable suggestions for follow-up queries
7. Use official Kazakhstan business intelligence when available`;

      console.log(`Processing query with Claude intelligence: "${userMessage.content}"`);
      
      // Call Claude with enhanced OKED and business context
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: enhancedPrompt }],
        temperature: 0.3,
      });

      const result = {
        content: response.content[0].text,
        usage: response.usage,
        enhanced: true,
        queryType: 'claude_intelligence',
        originalQuery: userMessage.content
      };

      // Cache the response
      cache.set(cacheKey, result);
      return res.json(result);
      
    } catch (enhancedError) {
      console.warn('Enhanced Claude processing failed, using basic fallback:', enhancedError.message);
      
      // Simple fallback without complex context
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 4000,
          messages,
          temperature: 0.3,
        });

        const result = {
          content: response.content[0].text,
          usage: response.usage,
          enhanced: false,
          queryType: 'fallback'
        };

        cache.set(cacheKey, result);
        return res.json(result);
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    
  } catch (error) {
    console.error('Claude API error:', error);
    
    if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else if (error.status === 400) {
      res.status(400).json({ error: 'Invalid request format' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Statistics API endpoint (placeholder for stat.gov.kz integration)
app.get('/api/statistics/:okedCode', async (req, res) => {
  try {
    const { okedCode } = req.params;
    
    // Validate OKED code format
    if (!okedCode || typeof okedCode !== 'string') {
      return res.status(400).json({ error: 'OKED code is required' });
    }
    
    // OKED codes should be 1-5 digits or letters A-U
    if (!/^[A-U]$|^\d{1,5}$/.test(okedCode)) {
      return res.status(400).json({ error: 'Invalid OKED code format' });
    }
    
    // Cache key for statistics
    const cacheKey = `stats_${okedCode}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // TODO: Integrate with real stat.gov.kz data source here.
    // Placeholder: Return 501 Not Implemented to indicate migration to real data is in progress.
    res.status(501).json({ error: "Real statistics integration in progress. See https://github.com/kazdatahelp/oked-catalogue-assistant/issues/6" });
  } catch (error) {
    console.error('Statistics API error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// OKED API endpoints
app.get('/api/oked/sections', async (req, res) => {
  try {
    const cacheKey = 'oked_sections';
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Mock data for OKED sections
    const sections = [
      { code: 'A', name: 'Agriculture, forestry and fishing', description: 'Section A - Agriculture' },
      { code: 'B', name: 'Mining and quarrying', description: 'Section B - Mining' },
      { code: 'C', name: 'Manufacturing', description: 'Section C - Manufacturing' },
      { code: 'F', name: 'Construction', description: 'Section F - Construction' },
      { code: 'G', name: 'Wholesale and retail trade', description: 'Section G - Trade' },
      { code: 'I', name: 'Accommodation and food service activities', description: 'Section I - Hospitality' },
      { code: 'J', name: 'Information and communication', description: 'Section J - IT & Communications' },
      { code: 'M', name: 'Professional, scientific and technical activities', description: 'Section M - Professional Services' }
    ];

    const result = { data: sections, cached: false };
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (error) {
    console.error('OKED sections error:', error);
    res.status(500).json({ error: 'Failed to fetch OKED sections' });
  }
});

// Fallback response function for when Anthropic API is not available
function generateFallbackResponse(userQuery, res, cache, cacheKey) {
  const queryLower = userQuery.toLowerCase();
  let response = "";
  let codes = [];
  let suggestions = [];
  
  // Basic classification based on keywords
  if (queryLower.includes('ресторан') || queryLower.includes('кафе') || queryLower.includes('питание') || queryLower.includes('restaurant')) {
    response = `По запросу "${userQuery}" найдены коды, связанные с общественным питанием. Рестораны и кафе классифицируются в секции I "Предоставление услуг по проживанию и питанию".`;
    codes = [
      { code: '56100', name: 'Деятельность ресторанов и кафе', level: 'Подкласс', explanation: 'Основная деятельность ресторанов' }
    ];
    suggestions = ['Различия между ресторанами и кафе', 'Классификация предприятий общественного питания'];
  } else if (queryLower.includes('магазин') || queryLower.includes('торговля') || queryLower.includes('продажа')) {
    response = `По запросу "${userQuery}" найдены коды розничной торговли. Торговые предприятия классифицируются в секции G "Оптовая и розничная торговля".`;
    codes = [
      { code: '47111', name: 'Розничная торговля в неспециализированных магазинах', level: 'Подкласс', explanation: 'Основная розничная торговля' }
    ];
    suggestions = ['Различия между оптовой и розничной торговлей', 'Классификация торговых точек'];
  } else if (queryLower.includes('программирование') || queryLower.includes('софт') || queryLower.includes('it')) {
    response = `По запросу "${userQuery}" найдены коды IT-деятельности. Разработка программного обеспечения классифицируется в секции J "Информация и связь".`;
    codes = [
      { code: '62010', name: 'Разработка программного обеспечения', level: 'Подкласс', explanation: 'Основная IT-деятельность' }
    ];
    suggestions = ['IT-консалтинг', 'Веб-разработка', 'Системная интеграция'];
  } else {
    response = `По запросу "${userQuery}" система работает в режиме офлайн. Для получения точной информации по классификации ОКЭД рекомендуется настроить подключение к Anthropic API.`;
    suggestions = ['Попробуйте более конкретные термины', 'Обратитесь к специалисту по ОКЭД', 'Настройте API ключ для расширенной функциональности'];
  }
  
  const result = {
    content: JSON.stringify({
      response,
      codes,
      suggestions,
      confidence: "low",
      warnings: [
        "Система работает без подключения к AI",
        "Рекомендуется настроить ANTHROPIC_API_KEY для полной функциональности"
      ],
      fallback: true
    }),
    fallback: true,
    enhanced: false
  };

  // Cache the response
  cache.set(cacheKey, result);
  return res.json(result);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'OKED Catalogue Backend is running',
    timestamp: new Date().toISOString(),
    cache_keys: cache.keys().length,
    uptime: process.uptime(),
    anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export the app for Vercel
export default app;