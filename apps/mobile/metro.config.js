const { getSentryExpoConfig } = require('@sentry/react-native/metro')

// Conserva la resolución del monorepo de Expo y agrega IDs a los sourcemaps.
module.exports = getSentryExpoConfig(__dirname)
