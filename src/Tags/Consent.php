<?php

namespace Marcodes\Consent\Tags;

use Illuminate\Support\Facades\Vite;
use Marcodes\Consent\Support\Assets;
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

    private const GATE_COUNTER = 'statamic-consent.gates';

    public function head(): string
    {
        $settings = Settings::fromConfig();

        if (! $settings->active()) {
            // Nothing to ask, but a gate in the page template needs the script.
            return Assets::pending() ? Assets::once($settings) : '';
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

        return $html.Assets::once($settings);
    }

    public function banner(): string
    {
        $settings = Settings::fromConfig();

        if (! $settings->active()) {
            return '';
        }

        $categories = $settings->categories();
        $services = $this->serviceNames($settings);

        $text = $this->bannerText($settings, $categories, $services);

        $html = view('statamic-consent::banner', [
            'settings' => $settings,
            'categories' => $categories,
            'text' => $text,
            'privacyUrl' => $settings->privacyUrl(),
            'services' => $services,
            't' => fn (string $key, array $replace = []) => $this->trans($key, $replace),
        ])->render();

        return $html.Assets::once($settings);
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

        $kind = match (true) {
            in_array($service, ['youtube', 'vimeo'], true) => 'video',
            $service === 'google_maps' => 'map',
            default => in_array($this->params->get('kind'), ['video', 'map'], true) ? $this->params->get('kind') : 'embed',
        };

        // Shown on the placeholder: the title only when one is passed (videos and
        // other embeds; a map shows its address instead).
        $title = $kind !== 'map' && is_string($this->params->get('title')) ? trim($this->params->get('title')) : '';
        $address = $kind === 'map' && is_string($this->params->get('address')) ? trim($this->params->get('address')) : '';

        $poster = $this->params->get('poster');
        $poster = is_string($poster) && preg_match('#^(/|https?://)#i', trim($poster)) ? trim($poster) : null;

        $html = view('statamic-consent::gate', [
            'id' => 'consent-gate-'.$number,
            'service' => $service,
            'kind' => $kind,
            'heading' => $this->trans("gate.heading_{$kind}", ['provider' => $provider]),
            'title' => $title,
            'address' => $address,
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

        // Never the tags themselves: they belong in <head>, see Assets.
        return $html.Assets::defer($settings);
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
     * Short banner text, built from parts so it fits the categories and
     * services in use, e.g. "Wir nutzen Google Analytics für Statistiken und
     * laden Videos und Karten von YouTube und Google Maps nur mit Ihrer
     * Einwilligung. Dabei können Daten in die USA übermittelt werden. ..."
     */
    private function bannerText(Settings $settings, array $categories, string $services): string
    {
        $statistics = in_array('statistics', $categories, true);
        $media = in_array('media', $categories, true);

        $enabled = $settings->enabledServices();
        $videos = array_intersect(['youtube', 'vimeo'], $enabled) !== [];
        $maps = in_array('google_maps', $enabled, true);
        $things = $this->trans('banner.things_'.($videos && $maps ? 'videos_maps' : ($videos ? 'videos' : 'maps')));

        $replace = [
            'statistics' => $this->trans('banner.statistics_part'),
            'media' => $this->trans('banner.media_part', ['things' => $things, 'services' => $services]),
        ];

        $first = match (true) {
            $statistics && $media => $this->trans('banner.text_both', $replace),
            $statistics => $this->trans('banner.text_statistics', $replace),
            default => $this->trans('banner.text_media', $replace),
        };

        return implode(' ', [
            $first,
            $this->trans('banner.transfer'),
            $this->trans('banner.outro', ['settings' => $this->trans('banner.settings_link')]),
        ]);
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
