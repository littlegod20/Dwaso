# 0002 — Personal data under Ghana's Data Protection Act, 2012 (Act 843)

**Status:** accepted
**Date:** 2026-08

## The problem nobody asked us to solve

Every other feature in Dwaso holds data the trader created about her own
business: her products, her prices, her sales. Credit is different. The moment
she records that Ama owes GHS 40, the app is holding personal data about someone
who never installed it, never agreed to anything, and in most cases does not know
the app exists.

That asymmetry is the whole of the compliance problem, and it is not theoretical.
The reminder feature exists specifically to contact those people.

## Who is responsible for what

Under Act 843 the trader is the **data controller** — she decides that Ama's
number goes in the ledger and that Ama gets reminded — and Dwaso is the **data
processor**. That split is not a way to offload the obligation. Section 28
requires the processor to act only on the controller's instructions and to keep
the data secure, and the practical effect is that a trader cannot comply unless
the software makes compliance the path of least resistance. She will not read the
Act. The app has to encode it.

Dwaso itself processes personal data as a business and registers as a data
controller for its own users' phone numbers with the Data Protection Commission.
That registration is a company action, not a code change, and is tracked outside
this repository.

## What this forces in the product

**Contacts are imported one at a time, never in bulk.** The spec's original
"import contacts" wording would have meant uploading a trader's entire address
book — hundreds of people with no relationship to her shop — to justify adding
three customers. `POST /v1/creditors/import` accepts an explicit list the trader
chose on-device. The difference is the difference between collecting data for a
purpose and collecting it because it was available.

**Every outbound message identifies the sender and offers a way out.** Not a
preference: `composeReminder` appends the business name and a STOP instruction to
every message, including ones where the trader supplied her own text. There is no
code path that sends an anonymous debt reminder, because an anonymous debt
reminder is both unlawful and frightening to receive.

**Opt-out is checked twice.** Once when a reminder is queued, and again in the
outbox drain immediately before sending. Someone who asks to be left alone in the
minutes between those two points is honoured late rather than not at all.

**Erasure keeps the debt and drops the person.** `POST /v1/privacy/creditors/:id/erase`
blanks the name, phone, email and note, and leaves the ledger entries untouched.
This is the one place where the two obligations genuinely conflict: an erasure
request cannot be allowed to delete a record of money owed, or anyone could
discharge a debt by invoking privacy law. Stripping the identifiers satisfies the
data-protection purpose — the subject is no longer identifiable — while the
trader's books stay correct.

**Retention has an end date.** Scan images that never became a product reference
are deleted after 180 days; message delivery logs after 365. Both are configurable
and both are enforced by the nightly retention job rather than by intention.

**The trader can take everything and leave.** `GET /v1/privacy/export` returns the
full shop dataset as JSON, and `DELETE /v1/privacy/shop` destroys it, cascading to
creditors and their ledgers. Deletion requires typing the business name back,
because this is irreversible and destroys the trader's entire financial history.

## What we are choosing not to do yet

Cross-border transfer notices. The infrastructure is hosted outside Ghana, which
Act 843 permits but expects to be disclosed. This belongs in the privacy policy
shown at signup, which does not exist yet, and it is listed here so that it is a
known gap rather than an oversight.
