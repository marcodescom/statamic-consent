/**
 * Consent banner, Google Analytics 4 with Google Consent Mode v2 (strict opt-in)
 * and two-click consent gates for external media.
 *
 * Markup: resources/views/banner.blade.php and gate.blade.php (or the standalone
 * snippet in the README). Everything happens in the browser, so the same
 * statically cached HTML works for every visitor.
 *
 * Categories:
 *   necessary   always on, never a toggle
 *   statistics  Google Analytics 4 (only with a valid measurement id)
 *   media       external media (YouTube, Vimeo, Google Maps)
 *
 * Google Analytics:
 *   - Consent Mode defaults (all denied, ads_data_redaction) are pushed first.
 *   - gtag.js is not requested until the visitor consents to "statistics".
 *   - Without consent every _ga/_gid/_gat cookie of this site is deleted on this
 *     host and every parent domain, and ga-disable-<id> is set.
 *
 * Storage: localStorage only (no cookie), with version, decision time and the
 * list of categories the visitor was asked about. A category added later is
 * asked again on its own, earlier answers stay in effect until then. Choices
 * expire after max-age days, on a version change, or when the stored time lies
 * more than 24 hours in the future (clock changed).
 *
 * Events on document: "consent:ready" (after init) and "consent:change"
 * (after every decision), detail = { version, decidedAt, asked, statistics, media }.
 * Position (data-consent-position): bottom-left (default), bottom-center,
 * bottom-right, bar, or center (a modal with backdrop and focus trap). The
 * settings view is modal in every position (data-consent-settings on the banner).
 * Theme (data-consent-theme): "auto" takes colours from the site, see theme.js.
 *
 * API: window.Consent.has(category), .get(), .set({ statistics, media }),
 * .open(), .acceptAll(), .rejectAll(), .refresh()
 */

import { applyTheme, DEFAULT_ACCENT_SELECTOR } from './theme.js'

export const CATEGORIES = ['statistics', 'media']
export const POSITIONS = ['bottom-left', 'bottom-center', 'bottom-right', 'center', 'bar']
export const DEFAULT_STORAGE_KEY = 'consent'
export const DEFAULT_MAX_AGE_DAYS = 365
export const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000
export const GA_ID = /^G-[A-Z0-9]{4,20}$/
const DAY_MS = 24 * 60 * 60 * 1000
const GTAG_URL = 'https://www.googletagmanager.com/gtag/js?id='

export const DENIED = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
}

/**
 * Consent Mode signals sent on "statistics" consent.
 * Google signals only collect data when ad_storage and ad_user_data are
 * granted, so those follow allow_google_signals. ad_personalization follows
 * allow_ad_personalization_signals (default off: no remarketing).
 */
export function grantedSignals({ googleSignals = true, adPersonalization = false } = {}) {
    return {
        ad_storage: googleSignals ? 'granted' : 'denied',
        ad_user_data: googleSignals ? 'granted' : 'denied',
        ad_personalization: adPersonalization ? 'granted' : 'denied',
        analytics_storage: 'granted',
    }
}

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

function bool(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }
    return value === 'true' || value === '1'
}

function list(value) {
    if (! value) {
        return []
    }
    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item) : []
    } catch (e) {
        return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
}

/** Reads the options from the data attributes of the banner element. */
export function readOptions(banner) {
    const data = banner?.dataset || {}
    const gaId = GA_ID.test(data.consentGaId || '') ? data.consentGaId : ''
    let categories = list(data.consentCategories).filter((category) => CATEGORIES.includes(category))
    // Statistics only exists with a valid measurement id.
    categories = categories.filter((category) => category !== 'statistics' || gaId)
    const maxAgeDays = Number(data.consentMaxAgeDays)

    return {
        version: data.consentVersion || '1',
        storageKey: data.consentStorageKey || DEFAULT_STORAGE_KEY,
        maxAgeDays: Number.isFinite(maxAgeDays) && maxAgeDays > 0 ? maxAgeDays : DEFAULT_MAX_AGE_DAYS,
        categories,
        gaId,
        googleSignals: bool(data.consentGoogleSignals, true),
        adPersonalization: bool(data.consentAdPersonalization, false),
        cookieDomain: data.consentCookieDomain || 'auto',
        legacyKeys: list(data.consentLegacyKeys),
        openHashes: list(data.consentOpenHashes),
        position: POSITIONS.includes(data.consentPosition) ? data.consentPosition : 'bottom-left',
        theme: data.consentTheme === 'manual' ? 'manual' : 'auto',
        accentSelector: data.consentAccentSelector || DEFAULT_ACCENT_SELECTOR,
    }
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function getItem(win, key) {
    try {
        return win.localStorage.getItem(key)
    } catch (e) {
        return null
    }
}

function setItem(win, key, value) {
    try {
        win.localStorage.setItem(key, value)
    } catch (e) {
        // Storage blocked (private mode, settings): the choice holds for this page only.
    }
}

function removeItem(win, key) {
    try {
        win.localStorage.removeItem(key)
    } catch (e) {
        // Nothing to clean up when storage is blocked.
    }
}

/** True when a decision time is neither expired nor too far in the future. */
export function isFresh(decided, now, maxAgeDays) {
    if (Number.isNaN(decided)) {
        return false
    }
    return now - decided <= maxAgeDays * DAY_MS && decided - now <= FUTURE_TOLERANCE_MS
}

/** Normalises a stored state or returns null when it is invalid, expired or of another version. */
export function parseState(raw, { version, maxAgeDays = DEFAULT_MAX_AGE_DAYS, now = Date.now() }) {
    if (! raw) {
        return null
    }
    let state
    try {
        state = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (e) {
        return null
    }
    if (! state || typeof state !== 'object' || state.version !== version || ! Array.isArray(state.asked)) {
        return null
    }
    if (! isFresh(Date.parse(state.decidedAt), now, maxAgeDays)) {
        return null
    }
    const asked = state.asked.filter((category) => CATEGORIES.includes(category) && typeof state[category] === 'boolean')
    const result = { version, decidedAt: state.decidedAt, asked }
    CATEGORIES.forEach((category) => {
        result[category] = asked.includes(category) && state[category] === true
    })
    return result
}

export function readState(win, options, now = Date.now()) {
    return parseState(getItem(win, options.storageKey), { ...options, now })
}

export function buildState(version, asked, values, now = Date.now()) {
    const state = { version, decidedAt: new Date(now).toISOString(), asked: [...asked] }
    CATEGORIES.forEach((category) => {
        state[category] = asked.includes(category) && values[category] === true
    })
    return state
}

export function writeState(win, options, state) {
    setItem(win, options.storageKey, JSON.stringify(state))
    return state
}

/* ------------------------------------------------------------------ */
/* Legacy migration                                                    */
/* ------------------------------------------------------------------ */

/**
 * Converts a choice stored by an earlier consent implementation.
 * Returns { decidedAt, asked, statistics, media } or null.
 *
 * Known shapes:
 *   { version, analytics: boolean, decidedAt: ISO string }
 *       statistics only (media was never asked)
 *   { v: 2, ts: number, c: ['analytics', 'maps'], analytics?, maps? }
 *       per category with the list of asked categories (c)
 *   { v: 1, ts: number, maps: boolean }
 *       only maps is carried over (statistics was asked without Consent Mode)
 *   { v, ts: number, analytics?: boolean, maps?: boolean }
 *       the categories present are taken as asked
 * "analytics" becomes "statistics", "maps" becomes "media".
 */
export function convertLegacy(raw) {
    let data
    try {
        data = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (e) {
        return null
    }
    if (! data || typeof data !== 'object') {
        return null
    }

    const values = {}
    let decidedAt = null

    if (typeof data.analytics === 'boolean' && typeof data.decidedAt === 'string') {
        decidedAt = data.decidedAt
        values.statistics = data.analytics
    } else if (typeof data.ts === 'number') {
        decidedAt = new Date(data.ts).toISOString()
        const map = { analytics: 'statistics', maps: 'media' }
        let keys = Object.keys(map)
        if (Array.isArray(data.c)) {
            keys = keys.filter((key) => data.c.includes(key))
        } else if (data.v === 1 && 'maps' in data) {
            keys = ['maps']
        }
        keys.forEach((key) => {
            if (typeof data[key] === 'boolean') {
                values[map[key]] = data[key]
            }
        })
    }

    const asked = Object.keys(values)
    if (! decidedAt || ! asked.length) {
        return null
    }
    return { decidedAt, asked, statistics: values.statistics === true, media: values.media === true }
}

/**
 * Carries over the first valid legacy choice when no current one exists,
 * then removes every legacy key. Categories the old implementation never
 * asked about stay unasked. The original decision time is kept, so the
 * old choice still expires on schedule.
 */
export function migrateLegacy(win, options, now = Date.now()) {
    let migrated = null
    const current = readState(win, options, now)

    // A site that had its own banner under the same key (storage_key = the old key): the
    // old record is not a valid current state, so convert it in place, like a legacy key.
    if (! current) {
        const raw = getItem(win, options.storageKey)
        if (raw !== null) {
            const legacy = convertLegacy(raw)
            if (legacy && isFresh(Date.parse(legacy.decidedAt), now, options.maxAgeDays)) {
                migrated = {
                    version: options.version,
                    decidedAt: new Date(Date.parse(legacy.decidedAt)).toISOString(),
                    asked: legacy.asked,
                    statistics: legacy.statistics,
                    media: legacy.media,
                }
                writeState(win, options, migrated)
            }
        }
    }

    if (! options.legacyKeys.length) {
        return migrated
    }

    options.legacyKeys.forEach((key) => {
        if (key === options.storageKey) {
            return
        }
        const raw = getItem(win, key)
        if (raw === null) {
            return
        }
        if (! current && ! migrated) {
            const legacy = convertLegacy(raw)
            if (legacy && isFresh(Date.parse(legacy.decidedAt), now, options.maxAgeDays)) {
                migrated = {
                    version: options.version,
                    decidedAt: new Date(Date.parse(legacy.decidedAt)).toISOString(),
                    asked: legacy.asked,
                    statistics: legacy.statistics,
                    media: legacy.media,
                }
                writeState(win, options, migrated)
            }
        }
        removeItem(win, key)
    })

    return migrated
}

/* ------------------------------------------------------------------ */
/* Google Analytics                                                    */
/* ------------------------------------------------------------------ */

/** Host-only plus every parent domain, with and without the leading dot. */
export function cookieDomains(hostname, extra = 'auto') {
    const parts = hostname.split('.')
    const domains = ['']
    for (let i = 0; i < parts.length - 1; i++) {
        const domain = parts.slice(i).join('.')
        domains.push(`; domain=${domain}`, `; domain=.${domain}`)
    }
    if (extra && extra !== 'auto' && extra !== 'none') {
        const clean = extra.replace(/^\./, '')
        ;[`; domain=${clean}`, `; domain=.${clean}`].forEach((domain) => {
            if (! domains.includes(domain)) {
                domains.push(domain)
            }
        })
    }
    return domains
}

/**
 * Deletes _ga, _ga_<id>, _gid and _gat* for this host and every parent domain,
 * because gtag.js sets them on the top-most possible domain (".example.com").
 */
export function deleteAnalyticsCookies(doc, cookieDomain = 'auto') {
    const names = doc.cookie
        .split(';')
        .map((part) => part.split('=')[0].trim())
        .filter((name) => /^(_ga($|_)|_gid$|_gat)/.test(name))

    if (! names.length) {
        return []
    }

    const domains = cookieDomains(doc.location.hostname, cookieDomain)
    names.forEach((name) => {
        domains.forEach((domain) => {
            doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/${domain}`
        })
    })
    return names
}

/** Defines gtag() and pushes the Consent Mode defaults once per page. */
export function pushDefaults(win) {
    win.dataLayer = win.dataLayer || []
    if (typeof win.gtag !== 'function') {
        win.gtag = function gtag() {
            // gtag.js expects the Arguments object, not an array.
            win.dataLayer.push(arguments) // eslint-disable-line prefer-rest-params
        }
    }
    // {{ consent:head }} may already have pushed them inline.
    if (! win.__consentDefaults) {
        win.gtag('consent', 'default', DENIED)
        win.gtag('set', 'ads_data_redaction', true)
        win.__consentDefaults = true
    }
}

export function createAnalytics(doc, win, options) {
    const id = options.gaId
    let loaded = false

    const load = () => {
        if (loaded || doc.querySelector('script[data-consent-gtag]')) {
            loaded = true
            return
        }
        loaded = true
        const config = {
            allow_google_signals: options.googleSignals,
            allow_ad_personalization_signals: options.adPersonalization,
        }
        if (options.cookieDomain && options.cookieDomain !== 'auto' && options.cookieDomain !== 'none') {
            config.cookie_domain = options.cookieDomain
        }
        win.gtag('js', new Date())
        win.gtag('config', id, config)
        const script = doc.createElement('script')
        script.async = true
        script.src = GTAG_URL + encodeURIComponent(id)
        script.dataset.consentGtag = ''
        doc.head.appendChild(script)
    }

    return {
        apply(granted) {
            if (granted) {
                win[`ga-disable-${id}`] = false
                win.gtag('consent', 'update', grantedSignals(options))
                load()
            } else {
                // Stops a gtag.js that already runs on this page, then removes its cookies.
                win[`ga-disable-${id}`] = true
                win.gtag('consent', 'update', DENIED)
                deleteAnalyticsCookies(doc, options.cookieDomain)
            }
        },
    }
}

/* ------------------------------------------------------------------ */
/* Gates                                                               */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'iframe, a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function isGateLoaded(gate) {
    return gate.hasAttribute('data-consent-gate-loaded')
}

/** Adds "key=value" to a URL, before any #fragment. */
export function withParam(url, param) {
    const [base, hash] = url.split('#')
    return base + (base.includes('?') ? '&' : '?') + param + (hash !== undefined ? '#' + hash : '')
}

/**
 * Injects the content of the gate's <template> (the iframe) and hides the
 * placeholder. With autoplay, the iframe src gets the gate's autoplay
 * parameter (only used for a click on this very gate).
 */
export function loadGate(gate, { autoplay = false, focus = false } = {}) {
    if (isGateLoaded(gate)) {
        return false
    }
    const template = gate.querySelector('template[data-consent-gate-content]')
    if (! template) {
        return false
    }
    const doc = gate.ownerDocument
    keepHeight(gate)
    const frame = doc.createElement('div')
    frame.className = 'consent-gate__frame'
    frame.setAttribute('data-consent-gate-frame', '')
    frame.appendChild(doc.importNode(template.content, true))

    const param = gate.getAttribute('data-consent-gate-autoplay')
    if (autoplay && param) {
        frame.querySelectorAll('iframe[src]').forEach((iframe) => {
            iframe.setAttribute('src', withParam(iframe.getAttribute('src'), param))
        })
    }

    gate.appendChild(frame)
    gate.setAttribute('data-consent-gate-loaded', '')
    const placeholder = gate.querySelector('[data-consent-gate-placeholder]')
    if (placeholder) {
        placeholder.hidden = true
    }
    if (focus) {
        const target = frame.querySelector(FOCUSABLE)
        if (target) {
            target.focus()
        } else {
            frame.tabIndex = -1
            frame.focus()
        }
    }
    return true
}

/**
 * A box with a fixed ratio grows when the placeholder needs more room (narrow
 * phones). Keeps that height for the loaded embed, so the page does not jump.
 */
export function keepHeight(gate) {
    if (! gate.classList.contains('consent-gate--ratio') || typeof gate.getBoundingClientRect !== 'function') {
        return
    }
    const { width, height } = gate.getBoundingClientRect()
    const view = gate.ownerDocument.defaultView
    const match = String(view?.getComputedStyle(gate).aspectRatio || '').match(/([\d.]+)\s*\/\s*([\d.]+)/)
    if (! width || ! height || ! match || ! Number(match[1])) {
        return
    }
    const natural = width * Number(match[2]) / Number(match[1])
    if (height > natural + 1) {
        gate.style.minHeight = `${Math.round(height)}px`
    }
}

/** Removes the loaded content and shows the placeholder again. */
export function unloadGate(gate) {
    if (! isGateLoaded(gate)) {
        return false
    }
    gate.querySelectorAll('[data-consent-gate-frame]').forEach((frame) => frame.remove())
    gate.removeAttribute('data-consent-gate-loaded')
    gate.style.minHeight = ''
    const placeholder = gate.querySelector('[data-consent-gate-placeholder]')
    if (placeholder) {
        placeholder.hidden = false
    }
    return true
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */

export function initConsent(doc = document, win = window, { now = () => Date.now() } = {}) {
    if (win.Consent && win.Consent.__initialised) {
        return win.Consent
    }

    const banner = doc.querySelector('[data-consent]')
    const options = readOptions(banner)
    const categories = banner ? options.categories : []
    const modal = options.position === 'center'

    if (options.theme === 'auto' && (banner || doc.querySelector('[data-consent-gate]'))) {
        try {
            applyTheme(doc, win, { selector: options.accentSelector, probe: banner || doc.querySelector('[data-consent-gate]') })
        } catch (e) {
            // Unreadable styles: the defaults of consent.css apply.
        }
    }
    const analytics = categories.includes('statistics') ? createAnalytics(doc, win, options) : null

    if (analytics) {
        pushDefaults(win)
    }

    migrateLegacy(win, options, now())
    let state = categories.length ? readState(win, options, now()) : null
    let opener = null

    const form = banner?.querySelector('[data-consent-form]')
    const button = (name) => banner?.querySelector(`[data-consent-${name}]`)

    const has = (category) => categories.includes(category) && Boolean(state?.asked.includes(category) && state[category])
    const decided = () => Boolean(state) && categories.every((category) => state.asked.includes(category))
    const current = () => {
        const detail = { version: options.version, decidedAt: state?.decidedAt || null, asked: state ? [...state.asked] : [] }
        CATEGORIES.forEach((category) => {
            detail[category] = has(category)
        })
        return detail
    }

    /* Effects of the current state ---------------------------------- */

    const gates = () => Array.from(doc.querySelectorAll('[data-consent-gate]'))
    const gateCategory = (gate) => gate.getAttribute('data-consent-gate-category') || 'media'

    const syncGates = (before = {}) => {
        gates().forEach((gate) => {
            const category = gateCategory(gate)
            if (has(category)) {
                loadGate(gate)
            } else if (before[category]) {
                // Consent withdrawn: back to the placeholder (also for "load once" embeds).
                unloadGate(gate)
            }
        })
    }

    const apply = (before = {}) => {
        if (analytics) {
            // Without consent: ga-disable, Consent Mode "denied" and no _ga
            // cookies, also leftovers from an expired, rejected or older choice.
            analytics.apply(has('statistics'))
        }
        syncGates(before)
    }

    /* Banner -------------------------------------------------------- */

    // The settings view is a modal dialog in every position: backdrop, focus trap.
    let settingsOpen = false
    const isModal = () => modal || settingsOpen

    const syncModal = () => {
        if (! banner) {
            return
        }
        banner.toggleAttribute('data-consent-settings', settingsOpen)
        banner.setAttribute('aria-modal', String(isModal()))
        if (backdrop) {
            backdrop.hidden = banner.hidden || ! isModal()
        }
    }

    const showSettings = (show) => {
        if (! form) {
            return
        }
        settingsOpen = show
        syncModal()
        form.hidden = ! show
        const customize = button('customize')
        const save = button('save')
        if (customize) {
            customize.hidden = show
            customize.setAttribute('aria-expanded', String(show))
        }
        if (save) {
            save.hidden = ! show
        }
        if (show) {
            categories.forEach((category) => {
                const input = form.elements.namedItem(category)
                if (input) {
                    input.checked = has(category)
                }
            })
        }
    }

    // The centred dialog and the settings view are modal: a backdrop covers the
    // page (it can still scroll, nothing is locked) and the focus stays inside.
    let backdrop = null
    if (banner) {
        banner.setAttribute('aria-modal', String(modal))
        backdrop = doc.createElement('div')
        backdrop.className = 'consent-backdrop'
        backdrop.hidden = true
        backdrop.setAttribute('aria-hidden', 'true')
        banner.parentNode.insertBefore(backdrop, banner)
    }

    // Focus that leaves the modal dialog (click on the page, screen reader) is pulled back.
    const onFocusIn = (event) => {
        if (banner && ! banner.hidden && isModal() && ! banner.contains(event.target)) {
            banner.focus()
        }
    }

    const focusables = () => Array.from(banner.querySelectorAll('a[href], button, input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((element) => ! element.hidden && ! element.closest('[hidden]'))

    const hide = () => {
        if (! banner || banner.hidden) {
            return
        }
        const hadFocus = banner.contains(doc.activeElement)
        banner.hidden = true
        settingsOpen = false
        syncModal()
        if (hadFocus && opener && doc.contains(opener)) {
            opener.focus()
        }
        opener = null
    }

    const show = ({ trigger = null, settings = false } = {}) => {
        if (! banner || ! categories.length) {
            return
        }
        opener = trigger || (modal || settings ? doc.activeElement : null)
        banner.hidden = false
        showSettings(settings)
        syncModal()
        // Opened on purpose (footer link) or modal: focus moves into the banner.
        // Non-modal banner on page load: no focus jump, it is early in the tab order.
        if (trigger || isModal()) {
            banner.focus()
        }
    }

    const set = (values) => {
        if (! categories.length) {
            return current()
        }
        const before = current()
        state = writeState(win, options, buildState(options.version, categories, values, now()))
        apply(before)
        hide()
        const detail = current()
        doc.dispatchEvent(new win.CustomEvent('consent:change', { detail }))
        return detail
    }

    const all = (value) => Object.fromEntries(categories.map((category) => [category, value]))

    if (banner) {
        button('accept')?.addEventListener('click', () => set(all(true)))
        button('reject')?.addEventListener('click', () => set(all(false)))
        button('customize')?.addEventListener('click', () => {
            showSettings(true)
            form?.querySelector('input:not([disabled])')?.focus()
        })
        button('save')?.addEventListener('click', () => {
            set(Object.fromEntries(categories.map((category) => [category, Boolean(form?.elements.namedItem(category)?.checked)])))
        })
        form?.addEventListener('submit', (event) => event.preventDefault())
        banner.addEventListener('keydown', (event) => {
            // Escape closes a reopened banner, the choice stays as it was.
            if (event.key === 'Escape' && decided()) {
                event.preventDefault()
                hide()
                return
            }
            if (event.key === 'Tab' && isModal()) {
                const items = focusables()
                if (! items.length) {
                    return
                }
                const first = items[0]
                const last = items[items.length - 1]
                const active = doc.activeElement
                if (event.shiftKey && (active === first || active === banner)) {
                    event.preventDefault()
                    last.focus()
                } else if (! event.shiftKey && active === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        })
        doc.addEventListener('focusin', onFocusIn)
    }

    const isOpenLink = (element) => {
        if (element.closest('[data-consent-open]')) {
            return element.closest('[data-consent-open]')
        }
        const link = element.closest('a[href]')
        if (link && options.openHashes.some((hash) => link.getAttribute('href').endsWith(hash))) {
            return link
        }
        return null
    }

    const onClick = (event) => {
        const target = event.target
        if (! target || typeof target.closest !== 'function') {
            return
        }

        const gateButton = target.closest('[data-consent-gate-load], [data-consent-gate-allow]')
        if (gateButton) {
            const gate = gateButton.closest('[data-consent-gate]')
            if (! gate) {
                return
            }
            event.preventDefault()
            const always = gateButton.hasAttribute('data-consent-gate-allow')
            const category = gateCategory(gate)
            // Load this gate first so it can autoplay and receive focus.
            loadGate(gate, { autoplay: true, focus: true })
            if (always && categories.includes(category)) {
                // Categories not answered yet count as rejected, otherwise the
                // banner would stay open and could undo this choice.
                set({ ...current(), [category]: true })
            }
            return
        }

        const trigger = isOpenLink(target)
        if (trigger && banner && categories.length) {
            event.preventDefault()
            show({ trigger, settings: true })
        }
    }

    doc.addEventListener('click', onClick)

    /* Start ---------------------------------------------------------- */

    apply()
    if (banner && categories.length && ! decided()) {
        // A category added since the last choice: show the settings with the
        // earlier answers preselected, so only the new one needs an answer.
        show({ settings: Boolean(state) })
    }

    const api = {
        __initialised: true,
        has,
        get: current,
        set,
        open: () => show({ settings: true }),
        close: hide,
        acceptAll: () => set(all(true)),
        rejectAll: () => set(all(false)),
        refresh: () => syncGates(),
        destroy: () => {
            doc.removeEventListener('click', onClick)
            doc.removeEventListener('focusin', onFocusIn)
            backdrop?.remove()
            delete win.Consent
        },
    }
    win.Consent = api
    doc.dispatchEvent(new win.CustomEvent('consent:ready', { detail: current() }))
    return api
}
