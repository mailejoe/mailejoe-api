# Testing

## E2E Testing

```
npm run test-ci
```

E2E tests need to go inside the src folder under **tests** and have "spec" in their name. Targeting of E2E meaning actual endpoints are being called against a running server to test the full code path to be executed.

NOTE: Please assume every test or test suite should restore the database back to the same state it is in before running a test.

NOTE: Make sure you create a new test database so you don't damage your dev instance.

Follow the steps in Developement Setup/Setting up Postgres to login into your Postgres docker container and postgres instance.

Then run the following commands

```

```

## Benchmarking

A basic benchmark script can be used locally, it performs 1000 "GET" requests on "http://localhost:3000/ping"

```bash
# /!\ The app must run locally
npm start # Or npm start -- --skipCacheInvalidation for better performance

# Run bench
node bench.js
```

The expected result should be similar to:

```bash
$ node bench.js
1000 "GET" requests to "http://localhost:3000/ping"
total: 8809.733ms
Average:  8.794ms
```
