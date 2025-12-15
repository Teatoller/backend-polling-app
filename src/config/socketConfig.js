// src/config/socketConfig.js
export const getSocketConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        cors: {
            origin: isProduction
                ? [
                    process.env.FRONTEND_URL,
                    'https://your-frontend.vercel.app',  // Update with your URL
                    'http://localhost:5173'
                ]
                : process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,  // 60 seconds for Heroku
        pingInterval: 25000, // 25 seconds
        // Heroku specific: handle proxy issues
        ...(isProduction && {
            allowEIO3: true,
            cookie: false
        })
    };
};