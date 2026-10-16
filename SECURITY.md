# Security and private reporting

Report suspected exposure or vulnerabilities privately to the team's tech lead and the client's named maintainer. Send the affected route, timestamp and request ID; do not send credentials or customer records in a public issue.

Release-specific controls, evidence and practical limits: [docs/SECURITY-REVIEW-1.2.md](docs/SECURITY-REVIEW-1.2.md).

Incident ownership and recovery: [devops/MAINTENANCE-HANDOVER.md](devops/MAINTENANCE-HANDOVER.md). Before a business launch, complete [devops/RELEASE_CHECKLIST.md](devops/RELEASE_CHECKLIST.md). Use only synthetic data in development/staging and never commit `.env`, local accounts, dumps or backups.
