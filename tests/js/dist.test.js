import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { bannerHtml, gateHtml, reset } from './helpers.js'

afterEach(reset)

const code = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/consent.js'), 'utf8')

describe('dist/consent.js (standalone build)', () => {
    it('starts by itself on a plain HTML page and keeps Google away until consent', () => {
        document.body.innerHTML = bannerHtml() + gateHtml()
        new Function(code)()

        expect(window.Consent).toBeDefined()
        expect(document.querySelector('[data-consent]').hidden).toBe(false)
        expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
        expect(document.querySelectorAll('iframe')).toHaveLength(0)

        window.Consent.acceptAll()
        expect(document.querySelector('script[src*="googletagmanager"]')).not.toBeNull()
        expect(document.querySelectorAll('iframe')).toHaveLength(1)
    })

    it('is up to date with resources/js (run "npm run build")', () => {
        expect(code).toContain('consent:change')
        expect(code).toContain('data-consent-gate-loaded')
    })
})
