/**
 * Browser entry of dist/consent.js: starts the consent controller once the
 * document is parsed. Load it as <script type="module"> (runs once per URL)
 * or with defer.
 */
import { initConsent } from './consent.js'

const start = () => initConsent(document, window)

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
    start()
}
