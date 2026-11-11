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

describe('dist/consent.css', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/consent.css'), 'utf8')

    it('keeps the settings link colour, font and decoration in @layer base, so site utility classes win', () => {
        const layered = css.match(/@layer base\s*\{(:where\(\.consent-settings-link\)\s*\{[^}]*\})\s*\}/)
        expect(layered).not.toBeNull()
        expect(layered[1]).toContain('.consent-settings-link')
        expect(layered[1]).toMatch(/color:\s*inherit/)
        // Outside the layer the link rule must not set colour (unlayered beats every utility).
        const unlayered = css.replace(layered[0], '')
        const rule = unlayered.match(/:where\(\.consent-settings-link\)\s*\{([^}]*)\}/)
        expect(rule).not.toBeNull()
        expect(rule[1]).not.toMatch(/(^|\s|;)color:/)
    })
})
