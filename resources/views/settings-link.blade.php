{{--
    Footer button "Cookie-Einstellungen": reopens the banner. It looks like the
    neighbouring links; pass their classes: {{ consent:settings_link class="..." }}
--}}
<button type="button" class="consent-settings-link{{ $class !== '' ? ' '.$class : '' }}" data-consent-open aria-haspopup="dialog">{{ $label }}</button>
