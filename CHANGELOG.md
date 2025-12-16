# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure generated.
- Documentation: `PROMPTS.md`, `RUNBOOK.md`, `secrets.example.md`, `ARCHITECTURE.md`.
- Basic Docker Compose configuration (planned).

### Planned
- **v0.1.0:** "The Listener" - Ability to scrape TikTok hashtags and save raw data to Postgres.
- **v0.2.0:** "The Judge" - Discovery Agent implementing the `PROMPTS.md` logic to score products.
- **v0.3.0:** "The Merchant" - Sourcing Agent connecting to AliExpress image search.

---
*Note: As you iterate on Agent Prompts, record significant prompt changes here. e.g., "Tightened Sourcing Agent constraints to reject shipping > 20 days."*

