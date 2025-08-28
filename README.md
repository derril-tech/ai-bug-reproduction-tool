# AI Bug Reproduction Tool

[![CI](https://github.com/your-org/ai-bug-reproduction-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/ai-bug-reproduction-tool/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What is the AI Bug Reproduction Tool?

The AI Bug Reproduction Tool is a revolutionary platform that transforms natural-language bug reports into deterministic, runnable reproductions. It's designed to eliminate the frustrating back-and-forth between developers and bug reporters by automatically generating comprehensive test cases, fixtures, and reproducible environments from simple text descriptions, screenshots, HAR files, and logs.

## 🚀 What does the product do?

The AI Bug Reproduction Tool provides a complete end-to-end solution for bug reproduction:

### **Core Capabilities:**
- **Natural Language Processing**: Converts bug reports written in plain English into structured test cases
- **Multi-Format Input**: Accepts text descriptions, screenshots, HAR files, browser logs, and console outputs
- **Intelligent Analysis**: Uses AI to extract relevant information and identify root causes
- **Automated Test Generation**: Creates Playwright scripts, HTTP sequences, and API tests
- **Deterministic Reproductions**: Ensures consistent, reliable bug reproductions across environments
- **Multi-Ecosystem Support**: Works with JavaScript/TypeScript, Python, JVM (Maven/Gradle), Go, and .NET projects

### **Advanced Features:**
- **Trace Visualization**: rrweb-based DOM/state diff overlays with timeline playback
- **AI-Powered Fix Suggestions**: LLM-generated solutions with risk assessment and safety gates
- **Flaky Test Detection**: Automated CI integration with quarantine and stability scoring
- **Export & Collaboration**: Generate PRs, sandbox environments, Docker containers, and detailed reports
- **RAG-Powered Mapping**: Intelligent codebase analysis and documentation search

## 💡 Benefits of the product

### **For Developers:**
- **🚀 Faster Debugging**: Reduce time-to-fix by 80% with instant, reliable reproductions
- **🎯 Precise Bug Isolation**: Eliminate "works on my machine" issues with deterministic environments
- **🔍 Deep Insights**: Get detailed traces, state changes, and network activity for comprehensive debugging
- **🤖 AI Assistance**: Receive intelligent fix suggestions with risk assessment and alternatives
- **🔄 Continuous Integration**: Automatically detect and quarantine flaky tests in CI/CD pipelines

### **For QA Engineers:**
- **📝 Simplified Reporting**: Write bug reports in natural language, let AI handle the technical details
- **🎬 Rich Context**: Include screenshots, videos, and logs for complete bug context
- **📊 Comprehensive Coverage**: Generate multiple test scenarios and edge cases automatically
- **🔗 Seamless Integration**: Works with existing test frameworks and CI/CD systems

### **For Product Teams:**
- **📈 Improved Quality**: Catch bugs earlier with more reliable reproductions
- **⏱️ Faster Releases**: Reduce bug investigation time and accelerate development cycles
- **💰 Cost Reduction**: Minimize developer time spent on bug reproduction and investigation
- **🎯 Better User Experience**: Faster bug fixes lead to happier users and better product quality

### **For Organizations:**
- **🏗️ Scalable Process**: Handle increasing bug reports without proportional team growth
- **📚 Knowledge Retention**: Preserve debugging context and solutions for future reference
- **🔄 Process Standardization**: Consistent bug reproduction methodology across teams
- **📊 Analytics & Insights**: Track bug patterns, fix success rates, and team productivity

## 🏗️ Architecture

The AI Bug Reproduction Tool is built as a modern, scalable microservices architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Workers       │
│   (Next.js)     │◄──►│   (NestJS)      │◄──►│   (Python)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   Redis/NATS    │
                       │   (pgvector)    │    │   (Event Bus)   │
                       └─────────────────┘    └─────────────────┘
```

### **Core Components:**
- **Frontend**: Modern React/Next.js interface with real-time updates
- **API Gateway**: NestJS REST API with OpenAPI documentation
- **Workers**: Python-based microservices for AI processing and test generation
- **Database**: PostgreSQL with pgvector for embeddings and similarity search
- **Message Bus**: NATS for asynchronous communication between services
- **Storage**: S3-compatible storage for artifacts and exports

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.11+
- Docker and Docker Compose
- PostgreSQL 16+ (with pgvector extension)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/ai-bug-reproduction-tool.git
   cd ai-bug-reproduction-tool
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   pip install -r requirements.txt
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the infrastructure:**
   ```bash
   docker-compose up -d postgres redis nats
   ```

5. **Run database migrations:**
   ```bash
   pnpm run db:migrate
   ```

6. **Start the development servers:**
   ```bash
   pnpm run dev
   ```

7. **Start the workers:**
   ```bash
   pnpm run workers:dev
   ```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs

## 📖 Usage

### 1. Create a Bug Report
Navigate to the reports page and click "Create New Report". You can:
- Write a natural language description of the bug
- Upload screenshots or videos
- Attach HAR files or console logs
- Specify the affected project and environment

### 2. AI Processing
The system will automatically:
- Extract relevant information from your inputs
- Analyze the codebase for context
- Generate test cases and fixtures
- Create a reproducible environment

### 3. Review & Validate
- View the generated test code
- Run the reproduction to verify it captures the bug
- Check the trace visualization for detailed insights
- Review AI-generated fix suggestions

### 4. Export & Share
- Generate a PR with the fix
- Create a sandbox environment for collaboration
- Export as Docker container or tarball
- Generate detailed reports and documentation

## 🛠️ Development

### Project Structure
```
ai-bug-reproduction-tool/
├── apps/
│   ├── api/                 # NestJS API Gateway
│   └── frontend/            # Next.js Frontend
├── workers/
│   ├── ingest-worker/       # OCR, ASR, HAR parsing
│   ├── signal-worker/       # Error signature clustering
│   ├── synth-worker/        # Test generation
│   ├── validate-worker/     # Stability testing
│   ├── map-worker/          # RAG and code mapping
│   ├── export-worker/       # Export generation
│   └── cli-worker/          # JVM/Go ecosystem support
├── infra/                   # Infrastructure as Code
├── docker/                  # Docker configurations
└── docs/                    # Documentation
```

### Available Scripts
```bash
# Development
pnpm run dev                 # Start all services in development
pnpm run workers:dev         # Start all workers
pnpm run db:migrate          # Run database migrations
pnpm run db:seed             # Seed database with sample data

# Testing
pnpm run test                # Run all tests
pnpm run test:watch          # Run tests in watch mode
pnpm run test:e2e            # Run end-to-end tests

# Building
pnpm run build               # Build all applications
pnpm run build:workers       # Build worker Docker images

# Deployment
pnpm run deploy:dev          # Deploy to development environment
pnpm run deploy:prod         # Deploy to production environment
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm run test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/ai-bug-reproduction-tool/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/ai-bug-reproduction-tool/discussions)
- **Email**: support@your-org.com

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/), [NestJS](https://nestjs.com/), and [Python](https://python.org/)
- AI powered by OpenAI and local models
- Infrastructure managed with [Terraform](https://terraform.io/) and [Docker](https://docker.com/)
- Testing with [Playwright](https://playwright.dev/) and [Jest](https://jestjs.io/)

---

**Transform your bug reports into actionable code with AI-powered precision.** 🚀
