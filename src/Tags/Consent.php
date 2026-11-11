<?php

namespace Marcodes\Consent\Tags;

use Illuminate\Support\Facades\Vite;
use Marcodes\Consent\Support\Embeds;
use Marcodes\Consent\Support\Settings;
use Statamic\Facades\Site;
use Statamic\Tags\Tags;

/**
 * {{ consent:head }}           stylesheet, Consent Mode defaults, script (in <head>)
 * {{ consent:banner }}         the banner (once per layout)
 * {{ consent:settings_link }}  footer button "Cookie-Einstellungen"
 * {{ consent:youtube id="" }}, {{ consent:vimeo id="" }}, {{ consent:map src="" | query="" }}
 * {{ consent:gate service="" }} <iframe ...> {{ /consent:gate }}
 */
class Consent extends Tags
{
    protected static $handle = 'consent';

    private const ASSETS_FLAG = 'statamic-consent.assets';

    private const GATE_COUNTER = 'statamic-consent.gates';

    public function head(): string
    {
        $settings = Settings::fromConfig();

        if (! $settings->active()) {
            return '';
        }

        $html = '';

        if ($settings->statisticsInUse() && $this->params->bool('defaults', true)) {
            $nonce = $this->nonce();
            $html .= '<script'.($nonce ? ' nonce="'.e($nonce).'"' : '').'>'
                ."window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};"
                ."gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});"
                ."gtag('set','ads_data_redaction',true);window.__consentDefaults=true;"
                .'</script>'."\n";
        }

        return $html.$this->assets($settings);
    }

    public function banner(): string
    {
        $settings = Settings::fromConfig();

        if (! $settings->active()) {
            return '';
        }

        $categories = $settings->categories();
        $services = $this->serviceNames($settings);

        $text = array_filter([
            $this->trans('banner.intro'),
            in_array('statistics', $categories, true)
                ? $this->trans($settings->googleSignals() ? 'banner.statistics_signals' : 'banner.statistics')
                : null,
            in_array('media', $categories, true) ? $this->trans('banner.media', ['services' => $services]) : null,
            $this->trans('banner.outro', ['settings' => $this->trans('banner.settings_link')]),
        ]);

        $html = view('statamic-consent::banner', [
            'settings' => $settings,
            'categories' => $categories,
            'text' => implode(' ', $text),
            'privacyUrl' => $settings->privacyUrl(),
            'services' => $services,
            't' => fn (string $key, array $replace = []) => $this->trans($key, $replace),
        ])->render();

        return $html.$this->assets($settings);
    }

    public function settingsLink(): string
    {
        $settings = Settings::fromConfig();

        if (! $settings->active()) {
            return '';
        }

        return view('statamic-consent::settings-link', [
            'class' => (string) $this->params->get('class', ''),
            'label' => (string) $this->params->get('text', $this->trans('banner.settings_link')),
        ])->render();
    }

    public function youtube(): string
    {
        $id = Embeds::youtubeId($this->params->get(['id', 'url']));

        if (! $id) {
            return '';
        }

        $title = (string) $this->params->get('title', $this->trans('gate.title_youtube'));
        $src = Embeds::youtubeUrl($id, ['start' => $this->params->get('start')]);

        return $this->gateHtml('youtube', $this->iframe($src, $title, [
            'allow' => 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            'referrerpolicy' => 'strict-origin-when-cross-origin',
        ]), 'autoplay=1');
    }

    public function vimeo(): string
    {
        $video = Embeds::vimeoId($this->params->get(['id', 'url']), $this->params->get('hash'));

        if (! $video) {
            return '';
        }

        $title = (string) $this->params->get('title', $this->trans('gate.title_vimeo'));
        $src = Embeds::vimeoUrl($video[0], $video[1], ['start' => $this->params->get('start')]);

        return $this->gateHtml('vimeo', $this->iframe($src, $title, [
            'allow' => 'autoplay; fullscreen; picture-in-picture',
            'referrerpolicy' => 'strict-origin-when-cross-origin',
        ]), 'autoplay=1');
    }

    public function map(): string
    {
        $src = $this->params->has('src')
            ? Embeds::mapUrl($this->params->get('src'))
            : Embeds::mapQueryUrl(
                (string) $this->params->get(['query', 'address'], ''),
                $this->params->int('zoom') ?: null,
                $this->params->get('lang', $this->lang()),
            );

        if (! $src) {
            return '';
        }

        $title = (string) $this->params->get('title', $this->trans('gate.title_google_maps'));

        return $this->gateHtml('google_maps', $this->iframe($src, $title, [
            'referrerpolicy' => 'no-referrer-when-downgrade',
        ]));
    }

    /**
     * Wraps arbitrary embed markup. The content is rendered into a <template>,
     * so nothing in it is active or requested before consent.
     */
    public function gate(): string
    {
        $service = (string) $this->params->get('service', '');

        if (! preg_match('/^[a-z0-9_-]{1,40}$/', $service)) {
            return '';
        }

        $content = $this->isPair ? (string) $this->parse() : '';

        if (trim($content) === '') {
            return '';
        }

        // A </template> inside the content would close the wrapper early.
        $content = preg_replace('#</template\s*>#i', '&lt;/template&gt;', $content);

        return $this->gateHtml($service, $content, $this->params->get('autoplay_param'));
    }

    private function gateHtml(string $service, string $content, ?string $autoplayParam = null): string
    {
        $settings = Settings::fromConfig();
        $known = in_array($service, Settings::SERVICES, true);

        if ($known && ! $settings->serviceEnabled($service)) {
            return '';
        }

        $provider = (string) $this->params->get('provider', $known ? $this->trans("services.{$service}") : '');

        if ($provider === '') {
            return '';
        }

        $text = (string) $this->params->get('text', $known
            ? $this->trans("gate.text_{$service}")
            : $this->trans('gate.text_generic', ['provider' => $provider]));

        $number = (int) request()->attributes->get(self::GATE_COUNTER, 0) + 1;
        request()->attributes->set(self::GATE_COUNTER, $number);

        $poster = $this->params->get('poster');
        $poster = is_string($poster) && preg_match('#^(/|https?://)#i', trim($poster)) ? trim($poster) : null;

        $html = view('statamic-consent::gate', [
            'id' => 'consent-gate-'.$number,
            'service' => $service,
            'category' => 'media',
            'provider' => $provider,
            'text' => $text,
            'privacyUrl' => $settings->privacyUrl(),
            'allowAlways' => $settings->mediaInUse(),
            'ratio' => Embeds::ratio($this->params->get('ratio')),
            'poster' => $poster,
            'posterAlt' => (string) $this->params->get('poster_alt', ''),
            'autoplay' => $this->params->bool('autoplay', true) && $autoplayParam && preg_match('/^[a-z0-9_]+=[a-z0-9_]+$/i', $autoplayParam) ? $autoplayParam : null,
            'class' => (string) $this->params->get('class', ''),
            'content' => $content,
            't' => fn (string $key, array $replace = []) => $this->trans($key, $replace),
        ])->render();

        return $html.$this->assets($settings);
    }

    private function iframe(string $src, string $title, array $attributes = []): string
    {
        $attributes = ['src' => $src, 'title' => $title, 'loading' => 'lazy'] + $attributes;
        $html = '<iframe';
        foreach ($attributes as $name => $value) {
            $html .= ' '.$name.'="'.e($value).'"';
        }

        return $html.' allowfullscreen></iframe>';
    }

    /**
     * Stylesheet and script, once per request. The script is a module: browsers
     * run a module URL only once, even if it appears twice in a page.
     */
    private function assets(Settings $settings): string
    {
        if (! $settings->assetsEnabled()) {
            return '';
        }

        if (request()->attributes->get(self::ASSETS_FLAG)) {
            return '';
        }

        request()->attributes->set(self::ASSETS_FLAG, true);

        return view('statamic-consent::assets', [
            'css' => $settings->assetUrl('consent.css'),
            'js' => $settings->assetUrl('consent.js'),
        ])->render();
    }

    private function serviceNames(Settings $settings): string
    {
        $names = array_map(fn ($service) => $this->trans("services.{$service}"), $settings->enabledServices());

        if (count($names) < 2) {
            return implode('', $names);
        }

        $last = array_pop($names);

        return implode(', ', $names).' '.$this->trans('banner.and').' '.$last;
    }

    private function trans(string $key, array $replace = []): string
    {
        return (string) __('statamic-consent::'.$key, $replace, $this->lang());
    }

    private function lang(): string
    {
        return Site::current()?->lang() ?? app()->getLocale();
    }

    private function nonce(): ?string
    {
        $nonce = $this->params->get('nonce');

        return is_string($nonce) && $nonce !== '' ? $nonce : Vite::cspNonce();
    }
}
