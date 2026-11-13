`arrow.ttf` holds a single glyph, "→", used by the quotation PDF because Helvetica has no arrow.
It is a subset of **Inter** (Copyright 2016 The Inter Project Authors, https://github.com/rsms/inter),
renamed "Squareit Arrow" and widened to 0.987 em to match the arrow in the original template.
Licensed under the SIL Open Font License 1.1: https://openfontlicense.org

`montserrat/` holds **Montserrat** (Copyright 2011 The Montserrat Project Authors, https://github.com/JulietaUla/Montserrat),
static instances 400/500/600/700 of the Google Fonts variable font, subset to Latin + "₹". Used by the tax invoice PDF.
Licensed under the SIL Open Font License 1.1. After changing them run `node scripts/gen-tax-invoice-assets.cjs`.
Each file must have its own PostScript name (Montserrat-Regular / -Medium / -SemiBold / -Bold): instances cut from the
variable font are all called "Montserrat-Thin", and the PDF writer then merges them into one font so every weight prints alike.
