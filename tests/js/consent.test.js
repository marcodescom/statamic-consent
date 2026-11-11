import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    convertLegacy,
    cookieDomains,
    deleteAnalyticsCookies,
    parseState,
    readOptions,
    withParam,
} from '../../resources/js/consent.js'
import { DAY, banner, bannerHtml, click, gateHtml, gtagScript, layer, reset, setup, store, stored } from './helpers.js'

beforeEach(reset)
afterEach(reset)

const fresh = (extra = {}) => ({
    version: '1',
    decidedAt: new Date().toISOString(),
    asked: ['statistics', 'media'],
    statistics: false,
    media: false,
    ...extra,
})

describe('banner visibility', () => {
    it('shows the banner without a stored choice, without moving focus', () => {
        setup(bannerHtml())
        expect(banner().hidden).toBe(false)
        expect(document.activeElement).toBe(document.body)
    })

    it('does nothing without a banner: no dataLayer, no gtag, no API state', () => {
        const api = setup('<p>No banner</p>')
        expect(window.dataLayer).toBeUndefined()
        expect(window.gtag).toBeUndefined()
        expect(api.get().asked).toEqual([])
    })

    it('drops statistics when the measurement id is missing or invalid', () => {
        document.body.innerHTML = bannerHtml({ gaId: 'UA-1234-1' })
        expect(readOptions(banner()).categories).toEqual(['media'])
        setup(bannerHtml({ gaId: '', categories: ['statistics'] }))
        expect(banner().hidden).toBe(true)
        expect(window.dataLayer).toBeUndefined()
    })

    it('keeps the banner hidden with a valid stored choice', () => {
        store(fresh())
        setup(bannerHtml())
        expect(banner().hidden).toBe(true)
    })
})

describe('choice storage', () => {
    it('stores version, decision time, asked categories and values in localStorage, no cookie', () => {
        setup(bannerHtml())
        click('[data-consent-accept]')
        const choice = stored()
        expect(choice).toMatchObject({ version: '1', asked: ['statistics', 'media'], statistics: true, media: true })
        expect(Math.abs(Date.parse(choice.decidedAt) - Date.now())).toBeLessThan(5000)
        expect(document.cookie).not.toContain('consent')
        expect(banner().hidden).toBe(true)
    })

    it('stores a rejection for every category', () => {
        setup(bannerHtml())
        click('[data-consent-reject]')
        expect(stored()).toMatchObject({ statistics: false, media: false, asked: ['statistics', 'media'] })
    })

    it('saves a selection from the settings view', () => {
        setup(bannerHtml())
        click('[data-consent-customize]')
        expect(document.querySelector('[data-consent-form]').hidden).toBe(false)
        expect(document.querySelector('[data-consent-save]').hidden).toBe(false)
        document.querySelector('input[name="media"]').checked = true
        click('[data-consent-save]')
        expect(stored()).toMatchObject({ statistics: false, media: true })
    })

    it('uses the configured storage key', () => {
        setup(bannerHtml({ storageKey: 'site_consent' }))
        click('[data-consent-reject]')
        expect(stored('site_consent')).not.toBeNull()
        expect(stored('consent')).toBeNull()
    })

    it('survives blocked storage: the choice holds for the page', () => {
        const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
        Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
        try {
            const api = setup(bannerHtml())
            click('[data-consent-accept]')
            expect(api.has('statistics')).toBe(true)
        } finally {
            Object.defineProperty(window, 'localStorage', original)
        }
    })

    it('emits consent:change with the new state', () => {
        const events = []
        document.addEventListener('consent:change', (event) => events.push(event.detail), { once: true })
        setup(bannerHtml())
        click('[data-consent-accept]')
        expect(events[0]).toMatchObject({ statistics: true, media: true, version: '1' })
    })
})

describe('expiry and versioning', () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    const at = (ms) => ({ ...fresh(), decidedAt: new Date(ms).toISOString() })

    it('accepts choices up to 12 months old', () => {
        expect(parseState(at(now - 364 * DAY), { version: '1', now })).not.toBeNull()
    })

    it('asks again after 12 months', () => {
        expect(parseState(at(now - 366 * DAY), { version: '1', now })).toBeNull()
    })

    it('honours a custom max age', () => {
        expect(parseState(at(now - 31 * DAY), { version: '1', maxAgeDays: 30, now })).toBeNull()
    })

    it('asks again when the stored time lies more than 24 hours in the future', () => {
        expect(parseState(at(now + 2 * DAY), { version: '1', now })).toBeNull()
        expect(parseState(at(now + 60 * 60 * 1000), { version: '1', now })).not.toBeNull()
    })

    it('asks again on a version change', () => {
        store(fresh({ version: '2025-01' }))
        setup(bannerHtml({ version: '2026-11' }))
        expect(banner().hidden).toBe(false)
    })

    it('rejects broken entries', () => {
        expect(parseState('{not json', { version: '1' })).toBeNull()
        expect(parseState({ version: '1', decidedAt: 'yesterday', asked: [] }, { version: '1' })).toBeNull()
        expect(parseState({ version: '1', decidedAt: new Date().toISOString() }, { version: '1' })).toBeNull()
    })
})

describe('category re-ask', () => {
    it('asks only about a new category and keeps earlier answers in effect', () => {
        store(fresh({ asked: ['statistics'], statistics: true, media: false }))
        const api = setup(bannerHtml())

        expect(banner().hidden).toBe(false)
        // Settings view with the earlier answer preselected.
        expect(document.querySelector('[data-consent-form]').hidden).toBe(false)
        expect(document.querySelector('input[name="statistics"]').checked).toBe(true)
        expect(document.querySelector('input[name="media"]').checked).toBe(false)
        // The statistics consent is still in effect.
        expect(api.has('statistics')).toBe(true)
        expect(gtagScript()).not.toBeNull()
    })

    it('does not ask again when an unused category is missing', () => {
        store(fresh({ asked: ['statistics'], statistics: false }))
        setup(bannerHtml({ categories: ['statistics'] }))
        expect(banner().hidden).toBe(true)
    })
})

describe('legacy migration', () => {
    const legacyKeys = ['old_consent', 'fg-consent', 'stats-consent']

    it('carries over a statistics decision {version, analytics, decidedAt}, media stays unasked', () => {
        const decidedAt = new Date(Date.now() - 10 * DAY).toISOString()
        store({ version: '2026-11', analytics: true, decidedAt }, 'old_consent')
        const api = setup(bannerHtml({ legacyKeys }))

        expect(stored()).toMatchObject({ version: '1', asked: ['statistics'], statistics: true, media: false, decidedAt })
        expect(stored('old_consent')).toBeNull()
        expect(api.has('statistics')).toBe(true)
        // Media was never asked: the banner asks about it.
        expect(banner().hidden).toBe(false)
    })

    it('carries over the per-category format with asked list (analytics, maps)', () => {
        store({ v: 2, ts: Date.now() - DAY, c: ['analytics', 'maps'], analytics: false, maps: true }, 'fg-consent')
        setup(bannerHtml({ legacyKeys }))
        expect(stored()).toMatchObject({ asked: ['statistics', 'media'], statistics: false, media: true })
        expect(stored('fg-consent')).toBeNull()
        expect(banner().hidden).toBe(true)
    })

    it('takes only maps from the version 1 format', () => {
        expect(convertLegacy({ v: 1, ts: Date.now(), maps: true, analytics: true })).toMatchObject({ asked: ['media'], media: true })
    })

    it('carries over the statistics-only format {v, ts, analytics}', () => {
        expect(convertLegacy({ v: 1, ts: Date.now(), analytics: true })).toMatchObject({ asked: ['statistics'], statistics: true })
    })

    it('takes the categories present when there is no asked list', () => {
        expect(convertLegacy({ v: 2, ts: Date.now(), analytics: false, maps: true })).toMatchObject({ asked: ['statistics', 'media'], statistics: false, media: true })
    })

    it('drops expired legacy choices but removes the key', () => {
        store({ version: 'x', analytics: true, decidedAt: new Date(Date.now() - 400 * DAY).toISOString() }, 'old_consent')
        setup(bannerHtml({ legacyKeys }))
        expect(stored()).toBeNull()
        expect(stored('old_consent')).toBeNull()
        expect(banner().hidden).toBe(false)
    })

    it('keeps a current choice and only cleans up legacy keys', () => {
        store(fresh({ statistics: false }))
        store({ version: 'x', analytics: true, decidedAt: new Date().toISOString() }, 'old_consent')
        setup(bannerHtml({ legacyKeys }))
        expect(stored()).toMatchObject({ statistics: false })
        expect(stored('old_consent')).toBeNull()
    })

    it('ignores unknown shapes', () => {
        expect(convertLegacy('{"foo":1}')).toBeNull()
        expect(convertLegacy('garbage')).toBeNull()
    })

    it('leaves legacy keys alone when none are configured', () => {
        store({ version: 'x', analytics: true, decidedAt: new Date().toISOString() }, 'old_consent')
        setup(bannerHtml())
        expect(stored('old_consent')).not.toBeNull()
    })
})

describe('Google Analytics', () => {
    it('pushes the Consent Mode defaults first and does not request gtag.js before consent', () => {
        setup(bannerHtml())
        expect(layer()[0]).toEqual(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
        expect(layer()[1]).toEqual(['set', 'ads_data_redaction', true])
        expect(gtagScript()).toBeNull()
    })

    it('does not push the defaults twice when {{ consent:head }} already did', () => {
        window.dataLayer = [['consent', 'default', {}]]
        window.__consentDefaults = true
        setup(bannerHtml())
        expect(layer().filter((entry) => entry[1] === 'default')).toHaveLength(1)
    })

    it('loads gtag.js only after accept, with the configured signals', () => {
        setup(bannerHtml())
        click('[data-consent-accept]')

        expect(gtagScript().src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST000000')
        expect(layer()).toContainEqual(['consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'granted' }])
        expect(layer()).toContainEqual(['config', 'G-TEST000000', { allow_google_signals: true, allow_ad_personalization_signals: false }])
        expect(window['ga-disable-G-TEST000000']).toBe(false)
    })

    it('grants only analytics_storage without Google signals', () => {
        setup(bannerHtml({ googleSignals: false }))
        click('[data-consent-accept]')
        expect(layer()).toContainEqual(['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' }])
        expect(layer()).toContainEqual(['config', 'G-TEST000000', { allow_google_signals: false, allow_ad_personalization_signals: false }])
    })

    it('passes an explicit cookie domain to gtag.js', () => {
        setup(bannerHtml({ cookieDomain: '.example.com' }))
        click('[data-consent-accept]')
        expect(layer()).toContainEqual(['config', 'G-TEST000000', { allow_google_signals: true, allow_ad_personalization_signals: false, cookie_domain: '.example.com' }])
    })

    it('loads gtag.js once on page load with a stored consent', () => {
        store(fresh({ statistics: true }))
        setup(bannerHtml())
        expect(document.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1)
    })

    it('does not load gtag.js on reject and sets ga-disable', () => {
        setup(bannerHtml())
        click('[data-consent-reject]')
        expect(gtagScript()).toBeNull()
        expect(window['ga-disable-G-TEST000000']).toBe(true)
    })

    it('stops analytics on withdrawal and deletes the cookies', () => {
        const api = setup(bannerHtml())
        click('[data-consent-accept]')
        document.cookie = '_ga=GA1.1.1; path=/; domain=.example.com'
        document.cookie = '_ga_TEST000000=GS1; path=/; domain=.example.com'
        api.set({ statistics: false, media: true })

        expect(window['ga-disable-G-TEST000000']).toBe(true)
        expect(layer().at(-1)).toEqual(['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
        expect(document.cookie).not.toMatch(/_ga/)
    })
})

describe('cookie deletion', () => {
    it('lists the host and every parent domain', () => {
        expect(cookieDomains('www.shop.example.com')).toEqual([
            '',
            '; domain=www.shop.example.com', '; domain=.www.shop.example.com',
            '; domain=shop.example.com', '; domain=.shop.example.com',
            '; domain=example.com', '; domain=.example.com',
        ])
    })

    it('adds an explicit cookie domain', () => {
        expect(cookieDomains('www.example.com', '.other.com')).toContain('; domain=.other.com')
    })

    it('deletes _ga, _ga_<id>, _gid and _gat cookies on parent domains, keeps others', () => {
        document.cookie = '_ga=1; path=/; domain=.example.com'
        document.cookie = '_ga_ABC=1; path=/; domain=example.com'
        document.cookie = '_gid=1; path=/'
        document.cookie = '_gat_UA=1; path=/; domain=www.example.com'
        document.cookie = 'session=keep; path=/'
        document.cookie = '_gallery=keep; path=/'

        deleteAnalyticsCookies(document)

        expect(document.cookie).toContain('session=keep')
        expect(document.cookie).toContain('_gallery=keep')
        expect(document.cookie).not.toMatch(/(^|; )(_ga|_ga_ABC|_gid|_gat_UA)=/)
    })

    it('deletes leftover analytics cookies on load without consent', () => {
        document.cookie = '_ga=1; path=/; domain=.example.com'
        setup(bannerHtml())
        expect(document.cookie).not.toMatch(/_ga=/)
    })

    it('leaves analytics cookies alone when statistics is not in use', () => {
        document.cookie = '_ga=1; path=/; domain=.example.com'
        setup(bannerHtml({ gaId: '', categories: ['media'] }))
        expect(document.cookie).toMatch(/_ga=/)
    })
})

describe('banner interaction', () => {
    it('reopens from [data-consent-open] with focus, in the settings view, and returns focus', () => {
        store(fresh({ statistics: true }))
        setup(bannerHtml() + '<button type="button" data-consent-open id="open">Cookie-Einstellungen</button>')
        const opener = document.getElementById('open')
        opener.focus()
        opener.click()

        expect(banner().hidden).toBe(false)
        expect(document.activeElement).toBe(banner())
        expect(document.querySelector('[data-consent-form]').hidden).toBe(false)
        expect(document.querySelector('input[name="statistics"]').checked).toBe(true)

        click('[data-consent-reject]')
        expect(banner().hidden).toBe(true)
        expect(document.activeElement).toBe(opener)
    })

    it('reopens from a link ending with a configured hash', () => {
        store(fresh())
        setup(bannerHtml() + '<a href="/privacy#consent-settings" id="link">Settings</a>')
        click('#link')
        expect(banner().hidden).toBe(false)
    })

    it('closes with Escape only when a choice exists', () => {
        setup(bannerHtml())
        banner().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(banner().hidden).toBe(false)

        click('[data-consent-reject]')
        window.Consent.open()
        banner().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(banner().hidden).toBe(true)
    })
})

describe('positions', () => {
    const backdrop = () => document.querySelector('.consent-backdrop')

    it('defaults to bottom-left, non-modal, without backdrop', () => {
        setup(bannerHtml({ position: 'sideways' }))
        expect(window.Consent).toBeDefined()
        expect(backdrop()).toBeNull()
        expect(document.activeElement).toBe(document.body)
    })

    it('center is a modal dialog with backdrop and focus inside', () => {
        setup('<button id="page">Page</button>' + bannerHtml({ position: 'center' }))
        expect(banner().getAttribute('aria-modal')).toBe('true')
        expect(backdrop().hidden).toBe(false)
        expect(document.activeElement).toBe(banner())

        click('[data-consent-reject]')
        expect(banner().hidden).toBe(true)
        expect(backdrop().hidden).toBe(true)
    })

    it('center traps the focus with Tab and Shift+Tab', () => {
        setup('<button id="page">Page</button>' + bannerHtml({ position: 'center' }))
        const buttons = Array.from(banner().querySelectorAll('a[href], button:not([hidden])'))
        const first = buttons[0]
        const last = buttons[buttons.length - 1]

        last.focus()
        banner().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
        expect(document.activeElement).toBe(first)

        first.focus()
        banner().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
        expect(document.activeElement).toBe(last)

        document.getElementById('page').focus()
        expect(document.activeElement).toBe(banner())
    })

    it('center returns the focus to the footer link after closing', () => {
        window.localStorage.setItem('consent', JSON.stringify(fresh()))
        setup(bannerHtml({ position: 'center' }) + '<button type="button" data-consent-open id="open">Cookie-Einstellungen</button>')
        const opener = document.getElementById('open')
        opener.focus()
        opener.click()
        expect(backdrop().hidden).toBe(false)
        banner().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(backdrop().hidden).toBe(true)
        expect(document.activeElement).toBe(opener)
    })
})

describe('buttons', () => {
    it('shows accept, reject and settings in the first view, save only in the settings view', () => {
        setup(bannerHtml({ categories: ['statistics'] }))
        const visible = (name) => ! document.querySelector(`[data-consent-${name}]`).hidden
        expect(['accept', 'reject', 'customize'].map(visible)).toEqual([true, true, true])
        expect(visible('save')).toBe(false)

        click('[data-consent-customize]')
        expect(['accept', 'reject', 'save'].map(visible)).toEqual([true, true, true])
        expect(visible('customize')).toBe(false)
        expect(document.querySelector('[data-consent-form]').hidden).toBe(false)
    })
})

describe('gates', () => {
    const iframes = () => document.querySelectorAll('iframe')
    const page = (gates = 2, options = {}) => bannerHtml(options) + Array.from({ length: gates }, () => gateHtml()).join('')

    it('contains no active iframe before consent', () => {
        setup(page())
        expect(iframes()).toHaveLength(0)
        document.querySelectorAll('[data-consent-gate-placeholder]').forEach((placeholder) => expect(placeholder.hidden).toBe(false))
    })

    it('"Einmal laden" loads only this embed with autoplay, focuses it and stores nothing', () => {
        setup(page())
        document.querySelector('[data-consent-gate-load]').click()

        expect(iframes()).toHaveLength(1)
        expect(iframes()[0].getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&autoplay=1')
        expect(document.activeElement).toBe(iframes()[0])
        expect(document.querySelector('[data-consent-gate-placeholder]').hidden).toBe(true)
        expect(stored()).toBeNull()
        expect(banner().hidden).toBe(false)
    })

    it('"Immer erlauben" stores media consent and opens every gate, without autoplay for the others', () => {
        setup(page(3))
        document.querySelectorAll('[data-consent-gate-allow]')[1].click()

        expect(stored()).toMatchObject({ media: true, statistics: false, asked: ['statistics', 'media'] })
        expect(iframes()).toHaveLength(3)
        expect(Array.from(iframes()).filter((iframe) => iframe.src.includes('autoplay=1'))).toHaveLength(1)
        expect(banner().hidden).toBe(true)
        expect(gtagScript()).toBeNull()
    })

    it('opens gates on page load with a stored media consent', () => {
        store(fresh({ media: true }))
        setup(page())
        expect(iframes()).toHaveLength(2)
        expect(Array.from(iframes()).some((iframe) => iframe.src.includes('autoplay'))).toBe(false)
    })

    it('replaces loaded embeds with placeholders again on withdrawal', () => {
        const api = setup(page())
        document.querySelector('[data-consent-gate-allow]').click()
        expect(iframes()).toHaveLength(2)

        api.set({ statistics: false, media: false })
        expect(iframes()).toHaveLength(0)
        document.querySelectorAll('[data-consent-gate]').forEach((gate) => {
            expect(gate.hasAttribute('data-consent-gate-loaded')).toBe(false)
            expect(gate.querySelector('[data-consent-gate-placeholder]').hidden).toBe(false)
        })
    })

    it('keeps a "load once" embed when only the statistics choice changes', () => {
        setup(page())
        document.querySelector('[data-consent-gate-load]').click()
        click('[data-consent-reject]')
        expect(iframes()).toHaveLength(1)
    })

    it('works without a banner as "load once" only', () => {
        setup(gateHtml({ allow: false }))
        document.querySelector('[data-consent-gate-load]').click()
        expect(iframes()).toHaveLength(1)
        expect(stored()).toBeNull()
    })

    it('ignores "Immer erlauben" when media is not a category in use', () => {
        setup(bannerHtml({ categories: ['statistics'] }) + gateHtml())
        document.querySelector('[data-consent-gate-allow]').click()
        expect(iframes()).toHaveLength(1)
        expect(stored()).toBeNull()
    })

    it('loads gates added later via Consent.refresh()', () => {
        store(fresh({ media: true }))
        const api = setup(bannerHtml())
        document.body.insertAdjacentHTML('beforeend', gateHtml())
        api.refresh()
        expect(iframes()).toHaveLength(1)
    })

    it('adds the autoplay parameter before a URL fragment', () => {
        expect(withParam('https://player.vimeo.com/video/1?dnt=1#t=30s', 'autoplay=1')).toBe('https://player.vimeo.com/video/1?dnt=1&autoplay=1#t=30s')
        expect(withParam('https://x.test/embed', 'autoplay=1')).toBe('https://x.test/embed?autoplay=1')
    })
})
