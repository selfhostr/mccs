# Guide a customer through the wizard

At the end the customer has their account, calendar and contacts set up on one device.

The wizard has four steps: address, device, application, then a guide that shows one step per screen (arrow keys work). Each guide gives copyable values and, where it exists, a link to download the app.

- On a computer, a QR code lets the customer continue on a phone.
- On iPhone and iPad, the guide offers the Apple configuration profile. See [Apple profile and Thunderbird autoconfig](apple-and-autoconfig.md).
- Gmail and Samsung apps are detected on Android and put forward.
- The Help panel (labelled "Aide" in the French interface) holds an FAQ and your support contact.

## Open the wizard already filled in

The wizard accepts query parameters, so you can send a link that skips steps:

| Parameter | Meaning |
|---|---|
| `email` | The customer's address |
| `name` | Display name (optional, 80 characters at most) |
| `device` | `windows`, `macos`, `ios` or `android` |
| `app` | A guide id valid for that device, such as `ios-profile`, `outlook-classic`, `caldavsync`, `davx5` |

Example: `https://config.example.com/?email=jane.doe@example.com&device=ios&app=ios-profile`. With a valid `email` and no hash, the wizard goes straight to the requested screen. The [support page](support-page.md) builds these links for you.
