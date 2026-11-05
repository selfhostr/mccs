# Customise branding, guides and screenshots

At the end the wizard carries your name, logo and colour, and your own guide wording.

## Branding

Name, logo, accent colour and support contact are environment variables; see [Configuration](configuration.md). The theme follows the system (dark or light), uses the system font and a single accent colour. `public/css/app.css` defines the design tokens on `:root` and is also used by `/support`. The accent is set by the generated `/brand.css`, so no inline style is needed and the CSP keeps `style-src 'self'`.

## Guides

Guides are defined in `public/js/guides.js`: devices (`windows`, `macos`, `ios`, `android`), the apps offered per device, and the steps of each guide (ids such as `ios-profile`, `ios-manual`, `mac-profile`, `mac-manual`, `outlook-new`, `outlook-classic`, `caldavsync`, `thunderbird`, `gmail`, `samsung`, `davx5`).

Mini syntax used in step texts:

| Syntax | Meaning |
|---|---|
| `[[UI label]]` | Interface element (button, menu) |
| `{email}` | Address typed by the user |
| `{brand}` | `BRAND_NAME` |
| `{L:key}` | Link from the `links` settings (e.g. `{L:thunderbird}`) |
| `{F:field}` | Inline copyable value |
| `f: [...]` | List of copyable fields for the step |
| `dl: true` | Download button for the Apple profile |
| `sub: '...'` | Secondary explanatory text |
| `shot: 'folder/file.png'` | Optional screenshot |
| `'[mdaemon] ...'` | Tip prefix: shown only with `DAV_PRESET=mdaemon` |

Copyable values (`f:` and `{F:}`) are defined by `fieldDefs()` in `public/js/app.js`.

## Add a screenshot

1. Add `shot: 'folder/file.png'` (and optionally `shotCaption`) to a step.
2. Put the image in `public/img/guides/` (PNG recommended, 1200 to 1600 px wide, no real personal data).
3. Rebuild: `docker compose up -d --build`.

The "Voir une capture" link appears only when the file exists; the list is built at startup. `public/img/guides/README.md` lists the expected files.

## Translate

The UI is in French. Translate the texts in `public/js/guides.js` and `public/index.html`, plus the labels in `public/js/app.js` and the pages under `public/support/`.
