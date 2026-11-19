# Account access, cancellation and erasure

PSL Digital receives requests at support@cgttracker.com or through Settings → Contact support about data deletion. Keep the verified case in a restricted support register outside the application database. A database restored from backup must not be able to erase this register. Only record the minimum information needed for fulfilment and restore replay.

1. Confirm the requester controls the account through an established channel. Record the verified immutable auth user ID, request date, scope, and any lawful retention decision in the case. Never use a name, matching email address or browser-supplied Stripe customer ID as billing ownership evidence.
2. For an access request, export only the verified owner's profile, trading records, saved reports, support messages and relevant billing references. Exclude password hashes, session and reset tokens, credentials and other customers' data. Use a private delivery channel and record fulfilment.
3. For cancellation, use the owner's mapped Stripe Customer Portal or an authorised support process. Confirm whether cancellation is scheduled or effective, and the actual paid-through date. For an existing customer with an ambiguous mapping, verify a Stripe-controlled invoice or customer-portal session and the existing mapping independently. Check subscription, price, paid invoice, refunds, disputes, open sessions and renewal status before resolving a hold. Record the evidence and outcome. Never clear a hold solely because a later invoice is marked paid.
4. For erasure, first resolve any provider-side open checkout, recurring collection, or entitled period and necessary invoice/legal retention. If some information must be retained, tell the requester what, why and for how long. Ask the owner to resolve any applicable retention decision before removing the corresponding billing mapping. Handle email/support-system and provider records separately with their authorised operators.
5. Run the operator command from an administrative machine using a protected database connection. It has no web endpoint. Use the verified owner ID and the external case reference. The default is a preview of that owner's record counts. Confirm the environment and counts against the case. A billing mapping requires the additional operator assertion that the provider was checked and required retention was handled. Active or held accounts block even with that assertion.

   ```sh
   node scripts/erase-reviewed-account.mjs --case-id "$CASE_ID" --owner "$VERIFIED_OWNER"
   node scripts/erase-reviewed-account.mjs --case-id "$CASE_ID" --owner "$VERIFIED_OWNER" --apply
   ```

   Supply the environment-specific OPERATOR_DATABASE_URL through the secret manager. For an approved, resolved billing mapping, add `--billing-reviewed`. Erasure runs in a serializable transaction, removes financial children before their parent, and deletes sessions, credentials and password-reset references. Unexpected dependencies or concurrent updates roll back. Re-run the dry run to confirm `already_absent`. Retain external case evidence independently.
6. Staging encrypted R2 archives expire after 14 days. Restrict access, keep outstanding erasure case identifiers through the lifetime of restorable copies and replay completed cases on **every isolated restore before opening it to users**. Keep the restored environment offline while checking the case register and reconciling Stripe separately. Confirm an unaffected fixture survives and erased owners cannot sign in or retrieve a report. Review the production backup policy, provider data-handling agreements and statutory retention period before opening live accounts.

[ICO guidance on erasure and backups](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)

Run the owner access export with the same protected operator connection. Choose an unused path inside a directory accessible only to the case handler. The file can contain the original uploaded CSV, contract-note details and account identifiers. It is created with owner-only permissions. Inspect it against the request, include relevant support/provider correspondence separately, arrange secure delivery and remove the working copy under the case retention policy.

```sh
node scripts/export-reviewed-account.mjs --case-id "$CASE_ID" --owner "$VERIFIED_OWNER" --output "$PRIVATE_CASE_DIRECTORY/account.json"
```
