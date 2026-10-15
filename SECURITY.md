# Security

If you find a security problem in Jig, report it privately through GitHub:
**Security → Report a vulnerability** on this repository. Please don't open a
public issue for it.

Say what you found, the Jig version, and how to reproduce it. You'll get a reply
within a week.

Jig runs on your machine. `check` reads your project's files and, when the
project uses Tailwind v4, runs your project's own Tailwind to ask about classes.
`install` and `init` write files into your project and your agent's folders.
A problem in any of those is in scope.
