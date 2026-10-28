# Security and private reporting

Report suspected exposure or vulnerabilities privately to the team's tech lead and the client's named maintainer. Send the affected route, timestamp and request ID; do not send credentials or customer records in a public issue.

Current release controls and practical limits: [docs/SECURITY-THREAT-MODEL-1.6.0.md](docs/SECURITY-THREAT-MODEL-1.6.0.md). Executed checks: [docs/VERIFICATION.md](docs/VERIFICATION.md). Apply the migration and production settings in [SECURITY-UPGRADE-1.6.0.md](SECURITY-UPGRADE-1.6.0.md).

Incident ownership and recovery: [devops/SECURITY-OPERATIONS.md](devops/SECURITY-OPERATIONS.md). Before a business launch, complete [devops/RELEASE_CHECKLIST.md](devops/RELEASE_CHECKLIST.md). Use only synthetic data in development/staging and never commit `.env`, local accounts, dumps or backups.
