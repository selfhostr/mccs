# Apple profile and Thunderbird autoconfig

At the end iPhone, iPad and Mac users can install their accounts with one tap, and Thunderbird finds your servers by itself.

## Apple configuration profile

`/profile.mobileconfig?email=jane.doe@example.com&name=Jane&services=mail,calendar,contacts` returns a profile with mail, calendar and contacts accounts. It never contains a password: the user types it once on the device.

- `email` is required. An invalid address gives a 400.
- `services` is a comma-separated list of `mail`, `calendar` and `contacts`. Empty or invalid means all three.
- The profile is not signed, so iOS and macOS show "Not signed". See [Security](security.md#apple-profile) to sign it.
- `PROFILE_ORGANIZATION` (defaults to `BRAND_NAME`) and `PROFILE_ID_PREFIX` set the organisation and the identifier prefix.
- On iPhone, the profile must be installed within 8 minutes of the download, in Safari. This is stated in the in-app FAQ.

## Thunderbird autoconfig

`/mail/config-v1.1.xml` (also at `/.well-known/autoconfig/mail/config-v1.1.xml`) returns the Mozilla autoconfig file with your IMAP and SMTP servers and your CalDAV and CardDAV URLs. Thunderbird asks for `autoconfig.<domain>/mail/config-v1.1.xml`, so point `autoconfig.example.com` at mccs, or proxy that path to it.
