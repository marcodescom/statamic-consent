{{--
    Two-click consent gate. The embed sits inside <template>, so the browser
    neither loads nor runs it before consent. consent.js copies it into the box
    after "Einmal laden" (this embed only, nothing stored) or "Immer erlauben"
    (stores the media consent, every gate on the page opens), and puts the
    placeholder back when the consent is withdrawn.
--}}
<div
    class="consent-gate{{ $ratio ? ' consent-gate--ratio' : '' }}{{ $poster ? ' consent-gate--poster' : '' }}{{ $class !== '' ? ' '.$class : '' }}"
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
        <p class="consent-gate__text" id="{{ $id }}-text">
            {{ $text }}
@if ($privacyUrl)
            <a href="{{ $privacyUrl }}" class="consent-gate__link">{{ $t('gate.privacy_link') }}</a>
@endif
        </p>
        <div class="consent-gate__actions">
            <button type="button" class="consent-gate__button" data-consent-gate-load aria-describedby="{{ $id }}-text">{{ $t('gate.load_once') }}</button>
@if ($allowAlways)
            <button type="button" class="consent-gate__button" data-consent-gate-allow aria-describedby="{{ $id }}-text">{{ $t('gate.allow') }}</button>
@endif
        </div>
    </div>
    <template data-consent-gate-content>{!! $content !!}</template>
</div>
