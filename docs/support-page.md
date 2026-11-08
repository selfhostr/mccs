# Generate a customer link

At the end you have a personalised link and QR code for one customer, and a ready-made email or SMS.

1. Set `SUPPORT_PASSWORD` (and optionally `SUPPORT_USER`, default `support`) and restart with `docker compose up -d`.
2. Open `/support` and sign in with HTTP Basic.
3. Type the customer's address. Name, device, application and mobile number are optional.
4. Click the generate button. Copy the link, download the QR code as PNG or SVG, or open the prepared email or SMS.

The link points to `PUBLIC_URL`, so set it first. The email and SMS texts are in French.

To turn the page off, empty `SUPPORT_PASSWORD`: `/support` then answers 404. See [Security](security.md) for the lock-out rules.
