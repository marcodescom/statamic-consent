{{--
    Consent banner. Rendered by {{ consent:banner }} only when there is something
    to ask (statistics with a measurement id, or media enabled).
    The HTML is the same for every visitor (static caching): it starts hidden and
    consent.js shows it when no valid choice is stored. "Alle akzeptieren" and
    "Alle ablehnen" look exactly the same; "Einstellungen" is an outline button.
    Override: php artisan vendor:publish --tag=statamic-consent-views
--}}
<section
    class="consent-banner"
    data-consent
    data-consent-position="{{ $settings->position() }}"
    data-consent-theme="{{ $settings->theme() }}"
@if ($settings->theme() === 'auto' && $settings->themeAccentSelector())
    data-consent-accent-selector="{{ $settings->themeAccentSelector() }}"
@endif
    data-consent-version="{{ $settings->version() }}"
    data-consent-storage-key="{{ $settings->storageKey() }}"
    data-consent-max-age-days="{{ $settings->maxAgeDays() }}"
    data-consent-categories="{{ implode(',', $categories) }}"
@if (in_array('statistics', $categories, true))
    data-consent-ga-id="{{ $settings->measurementId() }}"
    data-consent-google-signals="{{ $settings->googleSignals() ? 'true' : 'false' }}"
    data-consent-ad-personalization="{{ $settings->adPersonalizationSignals() ? 'true' : 'false' }}"
    data-consent-cookie-domain="{{ $settings->cookieDomain() }}"
@endif
@if ($settings->legacyStorageKeys())
    data-consent-legacy-keys="{{ json_encode($settings->legacyStorageKeys()) }}"
@endif
@if ($settings->openHashes())
    data-consent-open-hashes="{{ json_encode($settings->openHashes()) }}"
@endif
    role="dialog"
    aria-modal="{{ $settings->position() === 'center' ? 'true' : 'false' }}"
    aria-labelledby="consent-title"
    aria-describedby="consent-text"
    tabindex="-1"
    hidden
>
    <div class="consent-banner__inner">
        <div class="consent-banner__body">
            <h2 id="consent-title" class="consent-banner__title">{{ $t('banner.title') }}</h2>
            <p id="consent-text" class="consent-banner__text">
                {{ $text }}
@if ($privacyUrl)
                <a href="{{ $privacyUrl }}" class="consent-banner__link">{{ $t('banner.privacy_link') }}</a>.
@endif
            </p>
            <form class="consent-banner__settings" id="consent-settings" data-consent-form hidden>
                <fieldset class="consent-banner__fieldset">
                    <legend class="consent-banner__legend">{{ $t('banner.categories_legend') }}</legend>
                    <div class="consent-banner__category">
                        <input type="checkbox" id="consent-necessary" class="consent-banner__checkbox" checked disabled aria-describedby="consent-necessary-description">
                        <label for="consent-necessary" class="consent-banner__label">{{ $t('banner.necessary_label') }}</label>
                        <p id="consent-necessary-description" class="consent-banner__description">{{ $t('banner.necessary_description') }}</p>
                    </div>
@foreach ($categories as $category)
                    <div class="consent-banner__category">
                        <input type="checkbox" id="consent-{{ $category }}" name="{{ $category }}" class="consent-banner__checkbox" aria-describedby="consent-{{ $category }}-description">
                        <label for="consent-{{ $category }}" class="consent-banner__label">{{ $t("banner.{$category}_label") }}</label>
                        <p id="consent-{{ $category }}-description" class="consent-banner__description">{{ $category === 'statistics' && $settings->googleSignals() ? $t('banner.statistics_description_signals') : $t("banner.{$category}_description", ['services' => $services]) }}</p>
                    </div>
@endforeach
                </fieldset>
            </form>
        </div>
        <div class="consent-banner__actions">
            <button type="button" class="consent-banner__button" data-consent-accept>{{ $t('banner.accept') }}</button>
            <button type="button" class="consent-banner__button" data-consent-reject>{{ $t('banner.reject') }}</button>
            <button type="button" class="consent-banner__button consent-banner__button--outline" data-consent-customize aria-expanded="false" aria-controls="consent-settings">{{ $t('banner.customize') }}</button>
            <button type="button" class="consent-banner__button consent-banner__button--outline" data-consent-save hidden>{{ $t('banner.save') }}</button>
        </div>
    </div>
</section>
