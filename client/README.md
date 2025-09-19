# Vital - Mobile Client

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)

This is the mobile client for the Vital health monitoring application, built with React Native and Expo.

## 📱 Features

- Cross-platform support (iOS, Android, Web)
- Real-time vital sign monitoring
- Interactive charts and data visualization
- User authentication
- Dark/Light theme support
- Offline data persistence

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Expo CLI (`npm install -g expo-cli`)
- Android Studio / Xcode (for native development)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Configure environment variables**
   Create a `.env` file in the client root directory:
   ```env
   API_URL=http://localhost:3000
   # Add other environment variables here
   ```

3. **Start the development server**
   ```bash
   npm start
   # or
   yarn start
   ```

4. **Run on a device/simulator**
   - **iOS Simulator**: Press `i` in the terminal after starting the development server
   - **Android Emulator**: Press `a` in the terminal after starting the development server
   - **Physical Device**: Use the Expo Go app to scan the QR code

## 🛠 Project Structure

```
client/
├── assets/           # Images, fonts, and other static files
├── components/       # Reusable UI components
├── constants/        # App constants and theme configurations
├── context/          # React context providers
├── hooks/            # Custom React hooks
├── navigation/       # Navigation configuration
├── screens/          # App screens
├── services/         # API services and data fetching
├── store/            # State management (Redux/Context)
├── utils/            # Utility functions and helpers
├── App.js            # Main application component
└── app.json          # Expo configuration
```

## 📱 Available Scripts

- `npm start` - Start the development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run on web browser
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 📚 Dependencies

### Core
- React Native
- Expo
- React Navigation
- React Native Reanimated
- React Native Gesture Handler

### UI Components
- React Native Paper (or your UI library of choice)
- React Native SVG
- React Native Chart Kit

### State Management
- React Context API
- Redux (if applicable)

### Networking
- Axios

## 🔒 Security

- Secure storage for sensitive data
- HTTPS for all API requests
- Input validation
- Error handling

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
