/**
 * Automatic colours from the site's design (theme "auto").
 *
 * Reads computed styles once at init and writes --consent-auto-* properties on
 * <html>. The stylesheet resolves every colour as
 *     site variable (--consent-*)  >  auto value (--consent-auto-*)  >  default
 * so a --consent-* variable set by the site always wins. Additionally no auto
 * value is written for a variable the site already defines.
 *
 *   background  the background covering most of the page (full-width sections),
 *               else the first non-transparent background from <body> upwards, else white
 *   text        colour of <body>, or black or white when it does not contrast with
 *               that background (dark sections on a light <body>)
 *   accent      the brand colour of the site's call-to-action buttons: the most
 *               colourful filled link or button (header first, then the page; a fill
 *               painted by ::before or ::after counts too). Without a colourful one
 *               the first visible element matching the accent selector: its
 *               background if not transparent (and not the page background),
 *               otherwise its text colour; too faint accents fall back to the text colour
 *   radius      border radius of that element (card radius capped at 16px)
 *   button text black or white, whichever contrasts more with the accent (WCAG AA)
 *   muted text  text colour mixed towards the background, but never below WCAG AA
 *               (4.5:1) on the background, the category boxes and the gate boxes
 * Borders, hover and gate colours are mixed in CSS from these.
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

/** Like CSS color-mix(in srgb, a weight, b). */
export function mix(a, b, weight) {
    const channel = (key) => Math.round(a[key] * weight + b[key] * (1 - weight))
    return { r: channel('r'), g: channel('g'), b: channel('b'), a: 1 }
}

const MIN_TEXT_CONTRAST = 4.6 // WCAG AA is 4.5:1, a little headroom for rounding.
const BOX_TINT = 0.06 // --consent-category-bg and --consent-gate-bg: 6 % text colour.

/**
 * Muted text: as light as 75 % text colour, darker where that would fall
 * below AA on the background or on the tinted boxes; the text colour itself
 * (or black or white) at worst.
 */
export function mutedText(fg, bg) {
    const box = mix(fg, bg, BOX_TINT)
    const readable = (color) => contrast(color, bg) >= MIN_TEXT_CONTRAST && contrast(color, box) >= MIN_TEXT_CONTRAST
    for (let weight = 0.75; weight < 1; weight += 0.05) {
        const color = mix(fg, bg, weight)
        if (readable(color)) {
            return color
        }
    }
    return readable(fg) ? fg : parseColor(readableText(bg))
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

const CTA_SELECTOR = 'a, button, [role="button"], input[type="submit"], input[type="button"]'
const MIN_CHROMA = 0.25
const MAX_CTA_CANDIDATES = 400

/** Colourfulness 0-1 (max minus min channel). */
export function chroma({ r, g, b }) {
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
}

/** Solid fill of an element: own background, else a ::before / ::after background. */
export function elementFill(element, win, doc, pageBg) {
    for (const pseudo of [null, '::before', '::after']) {
        let style
        try {
            style = win.getComputedStyle(element, pseudo)
        } catch (e) {
            continue
        }
        if (pseudo && (style.content === 'none' || style.content === 'normal' || style.display === 'none')) {
            continue
        }
        const color = parseColor(style.backgroundColor, doc)
        if (color && color.a > 0.5 && (! pageBg || toCss(color) !== toCss(pageBg))) {
            return color
        }
    }
    return null
}

/**
 * The site's call-to-action: the most colourful filled link or button, header
 * first. Returns { element, color } or null when no fill is colourful enough.
 */
export function findBrandButton(doc, win, pageBg) {
    const scopes = [doc.querySelector('header, [role="banner"]'), doc.body].filter(Boolean)
    for (const scope of scopes) {
        let best = null
        const elements = Array.from(scope.querySelectorAll(CTA_SELECTOR)).slice(0, MAX_CTA_CANDIDATES)
        for (const element of elements) {
            if (! visible(element, win)) {
                continue
            }
            const color = elementFill(element, win, doc, pageBg)
            if (color && chroma(color) >= MIN_CHROMA && (! best || chroma(color) > chroma(best.color))) {
                best = { element, color }
            }
        }
        if (best) {
            return best
        }
    }
    return null
}

const MAX_SECTION_SCAN = 600

/**
 * Background that covers most of the page: full-width blocks (sections,
 * header, footer) weighted by the height they show themselves. A dark site
 * with a white <body> behind dark sections counts as dark. Null when nothing
 * can be measured (no layout).
 */
export function dominantBackground(doc, win) {
    const pageWidth = doc.documentElement.clientWidth || win.innerWidth || 0
    if (! pageWidth || ! doc.body) {
        return null
    }
    const blocks = []
    const elements = Array.from(doc.body.querySelectorAll('*')).slice(0, MAX_SECTION_SCAN * 10)
    for (const element of elements) {
        if (blocks.length >= MAX_SECTION_SCAN || element.closest('[data-consent], [data-consent-gate], .consent-backdrop, [hidden]')) {
            continue
        }
        const rect = element.getBoundingClientRect()
        if (rect.width < pageWidth * 0.9 || rect.height < 40) {
            continue
        }
        const color = parseColor(win.getComputedStyle(element).backgroundColor, doc)
        if (color && color.a > 0.9) {
            blocks.push({ element, color, height: rect.height })
        }
    }
    if (! blocks.length) {
        return null
    }
    const weights = new Map()
    let measured = 0
    for (const block of blocks) {
        // Height not covered by a nested full-width block with its own background.
        const covered = blocks
            .filter((other) => other !== block && block.element.contains(other.element)
                && ! blocks.some((middle) => middle !== block && middle !== other && block.element.contains(middle.element) && middle.element.contains(other.element)))
            .reduce((sum, other) => sum + other.height, 0)
        const own = Math.max(0, block.height - covered)
        const key = toCss(block.color)
        weights.set(key, { color: block.color, weight: (weights.get(key)?.weight || 0) + own })
        measured += own
    }
    const total = Math.max(doc.documentElement.scrollHeight || 0, measured)
    const body = parseColor(win.getComputedStyle(doc.body).backgroundColor, doc)
    if (body && body.a > 0) {
        const key = toCss(body)
        weights.set(key, { color: body, weight: (weights.get(key)?.weight || 0) + Math.max(0, total - measured) })
    }
    return Array.from(weights.values()).sort((a, b) => b.weight - a.weight)[0].color
}

/** Page background: the dominant section background, else the first non-transparent background from <body> up to <html>. */
export function pageBackground(doc, win) {
    const dominant = dominantBackground(doc, win)
    if (dominant) {
        return dominant
    }
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
    let fg = parseColor(win.getComputedStyle(doc.body).color, doc)
    if (! fg || contrast(fg, bg) < 4.5) {
        fg = parseColor(readableText(bg))
    }
    const theme = {
        '--consent-bg': toCss(bg),
        '--consent-fg': toCss(fg),
        '--consent-muted': toCss(mutedText(fg, bg)),
    }

    let accent = null
    // A site-specific accent selector wins over the automatic CTA search.
    const brand = selector === DEFAULT_ACCENT_SELECTOR ? findBrandButton(doc, win, bg) : null
    const element = brand ? brand.element : findAccentElement(doc, win, selector)
    if (brand) {
        accent = brand.color
    } else if (element) {
        const style = win.getComputedStyle(element)
        const background = parseColor(style.backgroundColor, doc)
        const sameAsPage = background && toCss(background) === toCss(bg)
        accent = background && background.a > 0.5 && ! sameAsPage ? background : parseColor(style.color, doc)
        if (accent && contrast(accent, bg) < MIN_ACCENT_CONTRAST) {
            accent = null
        }
    }
    if (element) {
        const style = win.getComputedStyle(element)
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
    '--consent-muted': ['--consent-fg', '--consent-bg'],
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
