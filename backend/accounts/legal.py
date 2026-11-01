"""Legal / policy constants shared by registration and the API.

Bump TERMS_VERSION whenever the Terms of Service or Privacy Policy text
changes in a meaningful way, and keep it in sync with
frontend/src/features/legal/legalConfig.ts.
"""

TERMS_VERSION = "2026-11-01"

# Minimum age to create an account. 13 is the common floor (COPPA in the US).
# Raise it (e.g. to 16) if you serve EU countries that require a higher age
# of digital consent and you don't collect parental consent.
MIN_AGE = 13
