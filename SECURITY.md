# Security

Report vulnerabilities privately to laxmannsit@gmail.com — do not open a public issue.
You will get an acknowledgement within 72 hours. Please include a proof of concept.

Notes for integrators:
- The import bridge accepts only `data:image/*` and http(s) image URLs; payloads are never executed.
- Public editor deployments should pass an origin allowlist to `installBridge`.
- `GeminiProvider` stores the user's own key in *their* localStorage; never ship a shared key in client code.
