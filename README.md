# PILETERO

An offline-first mobile and desktop application for pool maintenance registration and management.

## Project Overview

PILETERO is a comprehensive solution designed to help pool maintenance professionals register, track, and manage pool maintenance tasks with full offline capability. The application provides seamless synchronization between mobile and desktop platforms, allowing users to work without internet connectivity and sync data when back online.

## Key Features

- **Offline-First Architecture**: Works seamlessly without internet connectivity
- **Cross-Platform**: Native mobile (iOS/Android) and desktop (Windows/macOS/Linux) applications
- **Real-time Sync**: Automatic data synchronization when connectivity is restored
- **Pool Maintenance Tracking**: Register and manage pool maintenance tasks
- **User Management**: Multi-user support with authentication
- **Data Persistence**: Reliable local storage with cloud backup

## Tech Stack

- **Frontend**: React Native (mobile) + React (desktop web)
- **Backend**: Node.js with Express
- **Database**: SQLite (local) + PostgreSQL (cloud)
- **Workspace**: Monorepo structure with npm workspaces

## Project Structure

```
PILETERO/
├── backend/           # Backend API service
├── frontend/          # Frontend applications (mobile & desktop)
├── package.json       # Root workspace configuration
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install
```

### Development

```bash
# Install all workspace dependencies
npm install

# Start backend development server
npm run dev --workspace=backend

# Start frontend development server
npm run dev --workspace=frontend
```

## Development Team

- **Lead Developer**: Diego Robalo

## License

Proprietary - All rights reserved

## Notes

This is a monorepo project using npm workspaces. Each workspace (backend, frontend) has its own dependencies and configuration.
