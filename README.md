# Talk to the City

[Talk to the City (T3C)](https://ai.objectives.institute/talk-to-the-city) is an open-source, LLM-enabled SaaS tool for improving collective deliberation and decision-making by analyzing detailed, qualitative data. It aggregates responses and organizes similar claims into a nested tree of main topics and subtopics.

**Try it live**: [https://talktothe.city/](https://talktothe.city/)

### For Developers

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed instructions on:

- Setting up cloud dependencies (Firebase, GCS, etc.)
- Configuring environment variables
- Installing and running all services locally

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   next-client   │◄──►│ express-server  │◄──►│   pyserver      │
│   (Frontend)    │    │   (Backend)     │    │ (LLM Processing)│
│   Port: 3000    │    │   Port: 8080    │    │   Port: 8000    │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │
          │                      │
          ▼                      ▼
       ┌─────────────────────────────────────┐
       │             common                  │
       │         (Shared Types,              │
       │      Schemas & Utilities)           │
       └─────────────────────────────────────┘
```

**External Services**: Firebase (Auth), Google Cloud Storage (Reports), Redis (Jobs)

## Example Data

See the `examples/sample_csv_files/` directory for sample CSV files:

- `reddit_climate_change_posts_500.csv`: Climate change discussion posts

Expected CSV format:

```csv
id,interview,comment
1,participant_1,This is a sample comment
2,participant_2,Another participant's response
```

## License

[![License](https://img.shields.io/badge/license-Apache%202-blue)](LICENSE.txt)

---

**Questions?** Do you have questions, feedback, or interest in working with us directly on high-impact applications? Reach out at <hello@aiobjectives.org>
