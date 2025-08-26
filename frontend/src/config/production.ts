// Production configuration
export const productionConfig = {
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || 'https://your-production-api.com',
  
  // Feature flags
  features: {
    analytics: true,
    notifications: true,
    fileUpload: true,
    realTimeUpdates: true,
  },
  
  // Performance settings
  performance: {
    enableServiceWorker: true,
    enableCaching: true,
    enableCompression: true,
  },
  
  // Security settings
  security: {
    enableHTTPS: true,
    enableCSP: true,
    enableHSTS: true,
  },
  
  // Monitoring
  monitoring: {
    enableErrorTracking: true,
    enablePerformanceMonitoring: true,
    enableUserAnalytics: true,
  },
  
  // External services
  services: {
    sentry: {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: 'production',
    },
    analytics: {
      googleAnalyticsId: import.meta.env.VITE_GA_ID,
      mixpanelToken: import.meta.env.VITE_MIXPANEL_TOKEN,
    },
  },
};

export default productionConfig;
