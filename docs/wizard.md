# Guide a customer through the wizard

At the end the customer has their account, calendar and contacts set up on one device.

The wizard has four steps: address, device, application, then a guide that shows one step at a time, with a progress bar, Previous and Next buttons, the copyable values of that step and, where a screenshot exists, an image column beside it. Each step has its own URL (`#/guide/<device>/<guide>/<n>`), so the browser back button and the left and right arrow keys move between steps. Each guide gives copyable values and, where it exists, a link to download the app.

- On a computer, a QR code lets the customer continue on a phone.
- On iPhone and iPad, the guide offers the Apple configuration profile. See [Apple profile and Thunderbird autoconfig](apple-and-autoconfig.md).
- Gmail and Samsung apps are detected on Android and put forward.
- The Help panel (labelled "Aide" in the French interface) holds an FAQ and your support contact.

## Optional password check

When `CONNECTION_TEST` is on (see [Configuration](configuration.md#password-check)), the first screen asks for the name, the email address and the mailbox password, with a "show/hide" button, and its button reads "Vérifier ma connexion". The note under it says the password only serves to check the connection and is not stored.

The result screen shows two lines, "Réception" (IMAP) and "Envoi" (SMTP), each with an icon, a short status and the help message you set for that result, plus links to the Help panel, the webmail and your support phone or email.

- Both work: "Continuer" goes on to the device choice.
- Receiving works but sending fails: "Continuer" stays the main button, with "Réessayer".
- Receiving fails (wrong password, blocked account, server unreachable...): "Réessayer" brings back the form with an empty password field; "Continuer sans vérifier" goes on anyway.
- Too many checks, or an address outside `ALLOWED_DOMAINS`: a notice with your message and "Continuer sans vérifier".

"Continuer sans vérifier" is also offered under the form. The password stays in the page only while it is sent: the field is cleared at once, it is never shown again and never ends up in the URL, browser storage, the QR code or the history. A link from the support page (`?email=...&device=...`) still opens the requested screen directly, without the check.

With the option off, the first screen is unchanged: name and address only.

## Open the wizard already filled in

The wizard accepts query parameters, so you can send a link that skips steps:

| Parameter | Meaning |
|---|---|
| `email` | The customer's address |
| `name` | Display name (optional, 80 characters at most) |
| `device` | `windows`, `macos`, `ios` or `android` |
| `app` | A guide id valid for that device, such as `ios-profile`, `outlook-classic`, `caldavsync`, `davx5` |

Example: `https://config.example.com/?email=jane.doe@example.com&device=ios&app=ios-profile`. With a valid `email` and no hash, the wizard goes straight to the requested screen. The [support page](support-page.md) builds these links for you.
