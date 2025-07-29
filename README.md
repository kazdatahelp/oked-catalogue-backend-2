# OKED Catalogue Assistant Backend

Serverless Node.js backend API for Kazakhstan OKED classification system with Claude AI integration.

## 🌐 Live Deployment

**API URL**: https://oked-catalogue-backend-2.vercel.app

## 🚀 Endpoints

- `GET /health` - Health check
- `POST /api/claude` - Claude AI integration
- `GET /api/statistics/:okedCode` - Business statistics

## 🛠️ Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Start development server
npm run dev
```

## 🔧 Environment Variables

- `ANTHROPIC_API_KEY` - Required for Claude AI integration
- `FRONTEND_URL` - Frontend URL for CORS
- `NODE_ENV` - Environment (production/development)

## 📡 CORS Configuration

Configured for:
- https://oked-catalogue-assistant.vercel.app
- http://localhost:3000 (development)

## 🏗️ Architecture

- **Framework**: Express.js
- **AI**: Anthropic Claude API
- **Cache**: NodeCache (1 hour TTL)
- **Security**: Helmet, CORS, Rate limiting
- **Platform**: Vercel Serverless Functions

## 📊 Features

- AI-powered OKED classification
- Kazakhstan business statistics
- Caching for performance
- Error handling & fallbacks
- Security best practices

---

**Frontend**: https://github.com/kazdatahelp/oked-catalogue-assistant
