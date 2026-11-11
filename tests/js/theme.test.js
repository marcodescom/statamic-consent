import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme, computeTheme, contrast, parseColor, readableText } from '../../resources/js/theme.js'
import { bannerHtml, reset, setup } from './helpers.js'

const site = (css, body = '') => {
    document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)
    document.body.insertAdjacentHTML('afterbegin', body)
}

const autoVars = () => {
    const style = document.documentElement.style
    return Object.fromEntries(Array.from(style).filter((name) => name.startsWith('--consent-auto-')).map((name) => [name, style.getPropertyValue(name)]))
}

afterEach(() => {
    reset()
    document.documentElement.removeAttribute('style')
})

describe('colour helpers', () => {
    it('parses rgb, rgba, hex and transparent', () => {
        expect(parseColor('rgb(255, 128, 0)')).toEqual({ r: 255, g: 128, b: 0, a: 1 })
        expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
        expect(parseColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
        expect(parseColor('#fa0')).toEqual({ r: 255, g: 170, b: 0, a: 1 })
        expect(parseColor('transparent').a).toBe(0)
        expect(parseColor('nonsense')).toBeNull()
    })

    it('chooses black or white button text with at least AA contrast', () => {
        for (const [color, expected] of [['#f3952b', '#0a0a0a'], ['#1d4ed8', '#ffffff'], ['#ffeb3b', '#0a0a0a'], ['#362783', '#ffffff'], ['#808080', '#0a0a0a']]) {
            const background = parseColor(color)
            const text = readableText(background)
            expect(text, color).toBe(expected)
            expect(contrast(background, parseColor(text)), color).toBeGreaterThanOrEqual(4.5)
        }
    })
})

describe('auto theme', () => {
    it('takes background and text from the body and the accent from a primary button', () => {
        site('body { background-color: rgb(17, 17, 17); color: rgb(240, 240, 240); } .btn-primary { background-color: rgb(243, 149, 43); color: rgb(0, 0, 0); border-top-left-radius: 6px; }',
            '<a href="/x">Link</a><button class="btn-primary">Go</button>')

        expect(computeTheme(document, window)).toEqual({
            '--consent-bg': 'rgb(17 17 17)',
            '--consent-fg': 'rgb(240 240 240)',
            '--consent-button-bg': 'rgb(243 149 43)',
            '--consent-button-fg': '#0a0a0a',
            '--consent-focus': 'rgb(243 149 43)',
            '--consent-button-radius': '6px',
            '--consent-radius': '6px',
        })
    })

    it('prefers the colourful call-to-action in the header over neutral buttons', () => {
        site('.btn { background-color: rgb(10, 10, 10); color: #fff; } .cta { background-color: rgb(243, 149, 43); color: rgb(0, 0, 0); border-top-left-radius: 0px; }',
            '<header><a href="/">Logo</a><a class="cta" href="/kontakt">Kontakt</a></header><main><button class="btn">Go</button></main>')
        const theme = computeTheme(document, window)
        expect(theme['--consent-button-bg']).toBe('rgb(243 149 43)')
        expect(theme['--consent-button-fg']).toBe('#0a0a0a')
        expect(theme['--consent-button-radius']).toBe('0px')
    })

    it('falls back to the accent selector when no button is colourful', () => {
        site('.btn { background-color: rgb(20, 20, 20); }', '<header><a class="btn" href="/k">Kontakt</a></header>')
        expect(computeTheme(document, window)['--consent-button-bg']).toBe('rgb(20 20 20)')
    })

    it('keeps a site-specific accent selector over the automatic search', () => {
        site('.cta { background-color: rgb(243, 149, 43); } .mine { background-color: rgb(29, 78, 216); }',
            '<header><a class="cta" href="/k">Kontakt</a></header><button class="mine">Go</button>')
        expect(computeTheme(document, window, '.mine')['--consent-button-bg']).toBe('rgb(29 78 216)')
    })

    it('caps the card radius for pill buttons', () => {
        site('.btn { background-color: rgb(29, 78, 216); border-top-left-radius: 999px; }', '<button class="btn">Go</button>')
        const theme = computeTheme(document, window)
        expect(theme['--consent-button-radius']).toBe('999px')
        expect(theme['--consent-radius']).toBe('16px')
        expect(theme['--consent-button-fg']).toBe('#ffffff')
    })

    it('walks up to the first non-transparent background and falls back to white', () => {
        site('html { background-color: rgb(250, 240, 230); } body { background-color: transparent; }')
        expect(computeTheme(document, window)['--consent-bg']).toBe('rgb(250 240 230)')

        document.head.innerHTML = ''
        site('html, body { background-color: rgba(0, 0, 0, 0); }')
        expect(computeTheme(document, window)['--consent-bg']).toBe('rgb(255 255 255)')
    })

    it('uses the text colour of a link when its background is transparent', () => {
        site('a { color: rgb(29, 78, 216); background-color: transparent; }', '<a href="/x">Link</a>')
        expect(computeTheme(document, window)['--consent-button-bg']).toBe('rgb(29 78 216)')
    })

    it('skips hidden elements and elements inside the banner', () => {
        site('.btn-primary { background-color: rgb(200, 0, 0); } .hidden { display: none; } .btn { background-color: rgb(0, 120, 0); }',
            '<button class="btn-primary hidden">Hidden</button><section data-consent><button class="btn-primary">Inside</button></section><button class="btn">Visible</button>')
        expect(computeTheme(document, window)['--consent-button-bg']).toBe('rgb(0 120 0)')
    })

    it('falls back to the text colour without a usable accent', () => {
        site('body { background-color: rgb(255, 255, 255); color: rgb(20, 20, 20); } a { color: rgb(250, 250, 250); }', '<a href="/x">Almost invisible</a>')
        const theme = computeTheme(document, window)
        expect(theme['--consent-button-bg']).toBe('rgb(20 20 20)')
        expect(theme['--consent-button-fg']).toBe('#ffffff')
    })

    it('writes --consent-auto-* on <html>, but never for variables the site sets', () => {
        site('body { background-color: rgb(17, 17, 17); color: rgb(240, 240, 240); } .btn { background-color: rgb(243, 149, 43); border-top-left-radius: 4px; }', '<button class="btn">Go</button>')
        document.documentElement.style.setProperty('--consent-bg', '#123456')
        document.documentElement.style.setProperty('--consent-button-bg', '#00ff00')

        applyTheme(document, window)
        const vars = autoVars()

        expect(vars['--consent-auto-bg']).toBeUndefined()
        expect(vars['--consent-auto-button-bg']).toBeUndefined()
        // Computed for the auto accent, so skipped when the site sets the button colour.
        expect(vars['--consent-auto-button-fg']).toBeUndefined()
        expect(vars['--consent-auto-focus']).toBeUndefined()
        expect(vars['--consent-auto-fg']).toBe('rgb(240 240 240)')
        expect(vars['--consent-auto-radius']).toBe('4px')
    })

    it('runs on init with theme "auto" and not with "manual"', () => {
        site('body { color: rgb(1, 2, 3); }')
        setup(bannerHtml({ theme: 'manual' }))
        expect(autoVars()).toEqual({})
        window.Consent.destroy()

        setup(bannerHtml())
        expect(autoVars()['--consent-auto-fg']).toBe('rgb(1 2 3)')
    })

    it('honours a configured accent selector', () => {
        site('.brand { background-color: rgb(120, 0, 120); } .btn { background-color: rgb(0, 0, 200); }')
        setup('<button class="btn">A</button><span class="brand">B</span>' + bannerHtml({ accentSelector: '.brand' }))
        expect(autoVars()['--consent-auto-button-bg']).toBe('rgb(120 0 120)')
    })
})
