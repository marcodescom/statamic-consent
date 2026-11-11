import { initConsent } from '../../resources/js/consent.js'

export const DAY = 24 * 60 * 60 * 1000

/** Banner markup as rendered by resources/views/banner.blade.php. */
export function bannerHtml({
    categories = ['statistics', 'media'],
    gaId = 'G-TEST000000',
    version = '1',
    storageKey = 'consent',
    legacyKeys = null,
    googleSignals = true,
    adPersonalization = false,
    cookieDomain = 'auto',
} = {}) {
    const settings = categories.length > 1
        ? `<form data-consent-form hidden>
            <input type="checkbox" id="consent-necessary" checked disabled>
            ${categories.map((c) => `<input type="checkbox" id="consent-${c}" name="${c}">`).join('')}
          </form>`
        : ''
    const extra = categories.length > 1
        ? '<button type="button" data-consent-customize aria-expanded="false">Einstellungen</button><button type="button" data-consent-save hidden>Auswahl speichern</button>'
        : ''

    return `<section class="consent-banner" data-consent
        data-consent-version="${version}"
        data-consent-storage-key="${storageKey}"
        data-consent-categories="${categories.join(',')}"
        ${gaId ? `data-consent-ga-id="${gaId}"` : ''}
        data-consent-google-signals="${googleSignals}"
        data-consent-ad-personalization="${adPersonalization}"
        data-consent-cookie-domain="${cookieDomain}"
        ${legacyKeys ? `data-consent-legacy-keys='${JSON.stringify(legacyKeys)}'` : ''}
        data-consent-open-hashes='["#consent-settings"]'
        role="dialog" aria-labelledby="consent-title" tabindex="-1" hidden>
        <h2 id="consent-title">Datenschutz-Einstellungen</h2>
        ${settings}
        <button type="button" data-consent-accept>Alle akzeptieren</button>
        <button type="button" data-consent-reject>Nur notwendige</button>
        ${extra}
    </section>`
}

/** Gate markup as rendered by resources/views/gate.blade.php. */
export function gateHtml({ service = 'youtube', src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', allow = true, autoplay = 'autoplay=1' } = {}) {
    return `<div class="consent-gate" data-consent-gate="${service}" data-consent-gate-category="media" ${autoplay ? `data-consent-gate-autoplay="${autoplay}"` : ''}>
        <div class="consent-gate__placeholder" data-consent-gate-placeholder>
            <p>Hier wird ein Video eingebunden.</p>
            <button type="button" data-consent-gate-load>Einmal laden</button>
            ${allow ? '<button type="button" data-consent-gate-allow>Immer erlauben</button>' : ''}
        </div>
        <template data-consent-gate-content><iframe src="${src}" title="Video" loading="lazy" allowfullscreen></iframe></template>
    </div>`
}

export function reset() {
    window.Consent?.destroy?.()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    window.localStorage.clear()
    delete window.dataLayer
    delete window.gtag
    delete window.__consentDefaults
    Object.keys(window).filter((key) => key.startsWith('ga-disable-')).forEach((key) => delete window[key])
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean).forEach((name) => {
        ;['', '; domain=example.com', '; domain=.example.com', '; domain=www.example.com'].forEach((domain) => {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
        })
    })
}

export function setup(html, options) {
    document.body.innerHTML = html
    return initConsent(document, window, options)
}

export function store(value, key = 'consent') {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}

export function stored(key = 'consent') {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
}

export const banner = () => document.querySelector('[data-consent]')
export const click = (selector) => document.querySelector(selector).click()
export const gtagScript = () => document.querySelector('script[src*="googletagmanager.com"]')

/** dataLayer entries as plain arrays. */
export const layer = () => (window.dataLayer || []).map((entry) => Array.from(entry))
