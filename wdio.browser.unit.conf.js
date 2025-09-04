const path = require('path');

exports.config = {
    runner: 'browser',
    framework: 'mocha',
    specs: ['tests/unit/**/*.spec.ts'],
    reporters: ['spec'],
    browser: 'chrome',
    preset: 'vite',
    mochaOpts: { ui: 'bdd', timeout: 60000 },
    viteConfig: {
        resolve: {
            alias: {
                '../defs_server_symlink.js':     path.resolve(__dirname, './tests/mocks/defs_server_symlink.ts'),
                '../defs_server_symlink':        path.resolve(__dirname, './tests/mocks/defs_server_symlink.ts'),
                '../../defs_server_symlink.js':  path.resolve(__dirname, './tests/mocks/defs_server_symlink.ts'),
                '../../defs_server_symlink':     path.resolve(__dirname, './tests/mocks/defs_server_symlink.ts'),
                '../../../defs_server_symlink.js': path.resolve(__dirname, './tests/mocks/defs_server_symlink.ts'),
                '../../../defs_server_symlink':    path.resolve(__dirname, './tests/mocks/defs_server_symlink.ts'),
            },
        },
    },
    before: async () => {
        await import('./tests/setup.ts');
    },
};
