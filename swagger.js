const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'CTJ Fase 3 Backend API',
            version: '1.0.0',
            description: 'API for movie suggestions and management',
        },
    },
    apis: ['./app.js'],
};

export default options;