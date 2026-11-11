{{--
    Two-click consent gate. The embed sits inside <template>, so the browser
    neither loads nor runs it before consent. consent.js copies it into the box
    after "Einmal laden" (this embed only, nothing stored) or "Immer erlauben"
    (stores the media consent, every gate on the page opens), and puts the
    placeholder back when the consent is withdrawn.

    The placeholder shows an icon (play button for videos, pin for maps), a
    heading with the provider ("Video von YouTube", plus the title when one is
    passed; "Karte von Google Maps", plus the address), the transfer text and
    the buttons: "Einmal laden" filled, "Immer erlauben" as outline.
--}}
<div
    class="consent-gate consent-gate--{{ $kind }}{{ $ratio ? ' consent-gate--ratio' : '' }}{{ $poster ? ' consent-gate--poster' : '' }}{{ $class !== '' ? ' '.$class : '' }}"
    data-consent-gate="{{ $service }}"
    data-consent-gate-category="{{ $category }}"
@if ($autoplay)
    data-consent-gate-autoplay="{{ $autoplay }}"
@endif
@if ($ratio)
    style="--consent-gate-ratio: {{ $ratio }}"
@endif
>
@if ($poster)
    <img class="consent-gate__poster" src="{{ $poster }}" alt="{{ $posterAlt }}" loading="lazy" decoding="async">
@endif
    <div class="consent-gate__placeholder" data-consent-gate-placeholder>
@if ($kind === 'video')
        <svg class="consent-gate__icon consent-gate__icon--play" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="32" class="consent-gate__icon-fill"/><path d="M26 20.5v23l18-11.5z" class="consent-gate__icon-mark"/></svg>
@elseif ($kind === 'map')
        <svg class="consent-gate__icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
@else
        <svg class="consent-gate__icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/></svg>
@endif
        <p class="consent-gate__heading" id="{{ $id }}-heading">
@if ($title !== '')
            <span class="consent-gate__title">{{ $title }}</span>
@endif
            <span class="consent-gate__provider">{{ $heading }}</span>
@if ($address !== '')
            <span class="consent-gate__address">{{ $address }}</span>
@endif
        </p>
        <p class="consent-gate__text" id="{{ $id }}-text">
            {{ $text }}
@if ($privacyUrl)
            <a href="{{ $privacyUrl }}" class="consent-gate__link">{{ $t('gate.privacy_link') }}</a>
@endif
        </p>
        <div class="consent-gate__actions">
            <button type="button" class="consent-gate__button" data-consent-gate-load aria-describedby="{{ $id }}-heading {{ $id }}-text">{{ $t('gate.load_once') }}</button>
@if ($allowAlways)
            <button type="button" class="consent-gate__button consent-gate__button--outline" data-consent-gate-allow aria-describedby="{{ $id }}-text">{{ $t('gate.allow') }}</button>
@endif
        </div>
    </div>
    <template data-consent-gate-content>{!! $content !!}</template>
</div>
