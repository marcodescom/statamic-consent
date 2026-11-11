<?php

namespace Marcodes\Consent\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Marcodes\Consent\Support\Assets;
use Marcodes\Consent\Support\Settings;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs inside Statamic's static cache middleware (statamic.web group), so the
 * cached HTML already has the assets in <head> and no markers. See Assets.
 */
class InjectAssets
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        if (! $response instanceof Response) {
            return $response;
        }

        $type = (string) $response->headers->get('Content-Type', '');
        if ($type !== '' && ! str_contains(strtolower($type), 'html')) {
            return $response;
        }

        $content = $response->getContent();
        if (! is_string($content) || ! str_contains($content, Assets::MARKER)) {
            return $response;
        }

        $response->setContent(Assets::inject($content, Settings::fromConfig()));

        return $response;
    }
}
