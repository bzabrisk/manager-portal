# Manager Portal — Security Runbook

Plain-language procedures for the two settings that protect the portal. Both live
in the Railway project's **Variables** tab for the server service. Nothing here
requires touching code.

## The two settings that matter

| Railway variable | What it is |
|---|---|
| `PORTAL_PASSWORD_HASH` | A scrambled ("hashed") version of the portal login password. The real password is never stored anywhere. |
| `SESSION_SECRET` | A long random string the server uses to sign login cookies. Changing it logs everyone out instantly. |

The server **will not start** if either one is missing or blank. That is deliberate:
a portal that refuses to boot is safer than one that accepts any password.

## Changing the portal password

1. Pick a new password. Make it long — a short phrase of four or five random words
   is ideal. Do not reuse the company name or a year.
2. On a computer that has this repository, open a terminal in the project folder
   and run:

   ```
   npm run hash-password -- "the new password here"
   ```

   Keep the quotes. It prints one line that starts with `$2b$12$`. That line is
   the hash.
3. In Railway, open the server service → **Variables** → `PORTAL_PASSWORD_HASH`
   → paste the whole line as the value → save. Railway redeploys automatically.
4. Done. Tell Krista the new password by voice or in person, not by email or text.

The hash is safe to paste into Railway, but do not paste it anywhere else. It
cannot be turned back into the password, but it can be attacked offline if it leaks.

## Emergency: "I think someone else has the password"

Do both of these, in this order:

1. **Change the password** using the steps above.
2. **Rotate `SESSION_SECRET`.** In a terminal run:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Paste the output into the `SESSION_SECRET` variable in Railway and save.

Rotating `SESSION_SECRET` invalidates every login cookie everywhere the moment
Railway restarts the server — every laptop, phone, and browser tab is logged out,
including anyone who should not be there. There is no other "log everyone out"
button; this is it.

## Things that should never happen

- Never put the real password in a file in this repository, in a chat message, or
  in a saved command.
- Never set `PORTAL_PASSWORD_HASH` to a plain password. It must be the `$2b$12$…`
  line the script prints. A plain password will simply make every login fail.
- Never share the Railway project with anyone who does not need it. Anyone who
  can read its Variables tab can read every key the portal uses.
