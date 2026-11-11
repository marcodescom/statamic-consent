import { defineConfig } from 'vitest/config'

const webstorageFlag = Number(process.versions.node.split('.')[0]) >= 22 ? ['--no-experimental-webstorage'] : []

export default defineConfig({
    test: {
        include: ['tests/js/**/*.test.js'],
        environment: 'jsdom',
        // Node 22+ knows a built-in localStorage global (on by default since
        // Node 25), which hides jsdom's. Switch it off for the test workers.
        poolOptions: {
            forks: { execArgv: webstorageFlag },
            threads: { execArgv: webstorageFlag },
        },
        environmentOptions: {
            jsdom: { url: 'https://www.example.com/page' },
        },
    },
})
