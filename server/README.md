# Vital - Backend Server

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)

This is the backend server for the Vital health monitoring application, built with Node.js and Express.

## 🚀 Features

- RESTful API endpoints
- User authentication and authorization
- Data validation
- Error handling
- CORS support
- Request logging
- Environment-based configuration

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: (SQLite)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Database (SQLite)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/stones4semper/vital-monitor.git
   cd vital-monitor/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   Create a `.env` file in the server root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   
   # Database
   DB_URI=sqlite:./vital.db
      
   # CORS
   CLIENT_URL=http://localhost:19006
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
