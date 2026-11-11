/**
 * Automatic colours from the site's design (theme "auto").
 *
 * Reads computed styles once at init and writes --consent-auto-* properties on
 * <html>. The stylesheet resolves every colour as
 *     site variable (--consent-*)  >  auto value (--consent-auto-*)  >  default
 * so a --consent-* variable set by the site always wins. Additionally no auto
 * value is written for a variable the site already defines.
 *
 *   background  first non-transparent background from <body> upwards, else white
 *   text        colour of <body>
 *   accent      first visible element matching the accent selector: its
 *               background if not transparent (and not the page background),
 *               otherwise its text colour; too faint accents fall back to the text colour
 *   radius      border radius of that element (card radius capped at 16px)
 *   button text black or white, whichever contrasts more with the accent (WCAG AA)
 * Muted text, borders, hover and gate colours are mixed in CSS from these.
 */

export const DEFAULT_ACCENT_SELECTOR = '.btn-primary, .button-primary, .btn, .button, button[type="submit"], main a, a'

const MAX_CARD_RADIUS = 16
const MIN_ACCENT_CONTRAST = 1.5
const DARK = '#0a0a0a'
const LIGHT = '#ffffff'

/** Parses a computed colour into { r, g, b, a } (0-255, alpha 0-1) or null. */
export function parseColor(value, doc = null) {
    if (! value) {
        return null
    }
    const text = String(value).trim().toLowerCase()
    if (text === 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0 }
    }
    const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
    if (rgb) {
        let alpha = rgb[4] === undefined ? 1 : parseFloat(rgb[4])
        if (rgb[4] && rgb[4].endsWith('%')) {
            alpha /= 100
        }
        return { r: Math.round(+rgb[1]), g: Math.round(+rgb[2]), b: Math.round(+rgb[3]), a: alpha }
    }
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
    if (hex) {
        const full = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1]
        return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: 1 }
    }
    // oklch(), color(), lab() and friends: let the browser convert via canvas.
    try {
        const canvas = doc?.createElement('canvas')
        const context = canvas?.getContext?.('2d', { willReadFrequently: true })
        if (context) {
            canvas.width = canvas.height = 1
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = text
            context.fillRect(0, 0, 1, 1)
            const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
            return { r, g, b, a: a / 255 }
        }
    } catch (e) {
        // No canvas (old browser, test environment): colour unknown.
    }
    return null
}

export function toCss({ r, g, b }) {
    return `rgb(${r} ${g} ${b})`
}

/** Relative luminance (WCAG 2). */
export function luminance({ r, g, b }) {
    const channel = (value) => {
        const c = value / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a, b) {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

/** Black or white text, whichever contrasts more with the background (always >= 4.5:1). */
export function readableText(background) {
    const dark = parseColor(DARK)
    const light = parseColor(LIGHT)
    return contrast(background, dark) >= contrast(background, light) ? DARK : LIGHT
}

const visible = (element, win) => {
    if (element.closest('[hidden], [data-consent], [data-consent-gate], .consent-backdrop')) {
        return false
    }
    const style = win.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

/** First visible element for the first selector (in the given order) that has one. */
export function findAccentElement(doc, win, selector = DEFAULT_ACCENT_SELECTOR) {
    for (const part of selector.split(',').map((item) => item.trim()).filter(Boolean)) {
        let elements = []
        try {
            elements = Array.from(doc.querySelectorAll(part))
        } catch (e) {
            continue
        }
        const found = elements.find((element) => visible(element, win))
        if (found) {
            return found
        }
    }
    return null
}

/** Page background: first non-transparent background from <body> up to <html>. */
export function pageBackground(doc, win) {
    for (let element = doc.body; element; element = element.parentElement) {
        const color = parseColor(win.getComputedStyle(element).backgroundColor, doc)
        if (color && color.a > 0) {
            return color
        }
    }
    return parseColor(LIGHT)
}

/** Computes the auto theme as { name: value } without touching the page. */
export function computeTheme(doc, win, selector = DEFAULT_ACCENT_SELECTOR) {
    const bg = pageBackground(doc, win)
    const fg = parseColor(win.getComputedStyle(doc.body).color, doc) || parseColor(luminance(bg) > 0.4 ? DARK : LIGHT)
    const theme = {
        '--consent-bg': toCss(bg),
        '--consent-fg': toCss(fg),
    }

    let accent = null
    const element = findAccentElement(doc, win, selector)
    if (element) {
        const style = win.getComputedStyle(element)
        const background = parseColor(style.backgroundColor, doc)
        const sameAsPage = background && toCss(background) === toCss(bg)
        accent = background && background.a > 0.5 && ! sameAsPage ? background : parseColor(style.color, doc)
        if (accent && contrast(accent, bg) < MIN_ACCENT_CONTRAST) {
            accent = null
        }
        const radius = parseFloat(style.borderTopLeftRadius)
        if (Number.isFinite(radius) && radius >= 0) {
            theme['--consent-button-radius'] = `${radius}px`
            theme['--consent-radius'] = `${Math.min(radius, MAX_CARD_RADIUS)}px`
        }
    }

    accent = accent || fg
    theme['--consent-button-bg'] = toCss(accent)
    theme['--consent-button-fg'] = readableText(accent)
    theme['--consent-focus'] = toCss(accent)
    return theme
}

// An auto value that only makes sense together with another one: when the
// site sets that one, the auto value is skipped too (e.g. black or white text
// computed for the auto accent must not land on the site's own button colour).
const DEPENDS_ON = {
    '--consent-button-fg': ['--consent-button-bg'],
    '--consent-focus': ['--consent-button-bg'],
    '--consent-button-radius': ['--consent-radius'],
}

/** True when the site defines this --consent-* property itself. */
function siteDefines(doc, win, name, probe) {
    const root = doc.documentElement
    return [root, probe].some((element) => element && win.getComputedStyle(element).getPropertyValue(name).trim() !== '')
}

/**
 * Writes the auto theme as --consent-auto-* on <html>, except for properties
 * the site sets itself. Returns the values written.
 */
export function applyTheme(doc, win, { selector = DEFAULT_ACCENT_SELECTOR, probe = null } = {}) {
    const theme = computeTheme(doc, win, selector)
    const written = {}
    Object.entries(theme).forEach(([name, value]) => {
        if ([name, ...(DEPENDS_ON[name] || [])].some((property) => siteDefines(doc, win, property, probe))) {
            return
        }
        const auto = name.replace('--consent-', '--consent-auto-')
        doc.documentElement.style.setProperty(auto, value)
        written[auto] = value
    })
    return written
}
