# Production deployment

## Recommended TestFlight path

The repository root `render.yaml` deploys `services/api` as a Docker web service in Render's Frankfurt region. It uses the paid Starter instance to avoid free-instance sleep delaying the first chart request. Render provides the public HTTPS endpoint and checks `/health` before routing traffic to a new release.

Production is live at `https://zhishi-api.onrender.com`. The `/health` endpoint and a real `POST /api/v1/bazi/charts/calculate` request were verified after the first deployment; the chart and luck-cycle audits both returned `passed`.

The first iOS production build, version `0.1.0` build `3`, was uploaded to App Store Connect app `6801827758` and reached the internal TestFlight state `IN_BETA_TESTING`. Future EAS submissions use this fixed App Store Connect ID instead of attempting to create another app record.

1. In Render, choose **New > Blueprint**.
2. Connect `https://github.com/bambi2008/zhishi` and select the branch containing `render.yaml`.
3. Deploy the `zhishi-api` service.
4. Verify `https://zhishi-api.onrender.com/health` returns `status: ok`.
5. Keep `EXPO_PUBLIC_API_BASE_URL=https://zhishi-api.onrender.com` in the EAS build profiles.
6. From `apps/mobile`, run the readiness check, production build, and submission commands documented in its README.

For commercial location search, configure `OPEN_METEO_API_KEY`, or set `ZHISHI_GEOCODING_URL` to an authorized compatible service. If a web client is enabled later, set `ZHISHI_CORS_ORIGINS` to comma-separated exact HTTPS origins; wildcard origins are rejected.

The container is pinned to Python 3.11, runs as a non-root user, reads the platform-provided `PORT`, and contains a local health check. GitHub Actions independently runs the backend tests, the deterministic calculation stress suite, mobile type checking, Expo dependency validation, a Linux Docker build, and a live container smoke test.
