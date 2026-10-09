# Customer API (MuleSoft Mule 4)

A small REST API built with **Mule 4** for the QiCard MuleSoft self-study challenge.
It exposes three customer endpoints, calls a downstream backend with the **HTTP Request connector**, and maps every failure to one standard JSON error.

| | |
|---|---|
| Runtime | Mule 4.12.x (`app.runtime` 4.12.2) |
| Java | 17 |
| Connectors | HTTP, Sockets |
| Data | In-memory mock file, no database |
| Mock backend | Node.js, no dependencies |

---

## 1. What it does

| Endpoint | Behaviour | Success | Errors |
|---|---|---|---|
| `GET /customers` | List from the mock file. Optional `?status=ACTIVE` filter. | `200` | `500` |
| `GET /customers/{customerId}` | Calls the **backend** and maps its shape to the API shape. | `200` | `404`, `502`, `504`, `500` |
| `POST /customers` | Validates the body, returns the created customer. | `201` | `400`, `500` |

Request and response shapes follow the provided examples in [`samples/`](samples).

---

## 2. Run it

You need **three things**: the mock backend, the Mule app, and a client (curl or Postman).

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Java JDK | 17 | Mule 4.12 |
| Anypoint Studio | 7.x with the Mule 4.12 runtime | Easiest way to run the app |
| Node.js | 18 or newer | Mock backend (`mock-backend/server.js`) |
| Maven | 3.9 (optional) | Only to build the jar from the command line |

### Step 1: start the mock backend

```bash
cd mock-backend
npm start          # same as: node server.js
```

It listens on `http://localhost:3000/backend`. Leave this terminal open.

### Step 2: start the Mule app

**Option A: Anypoint Studio (recommended)**

1. `File` > `Import` > `Anypoint Studio` > **`Anypoint Studio project from File System`**.
2. Select this repository's root folder (the one containing `pom.xml`) and finish.
3. Right-click the project > `Run As` > `Mule Application`.
4. Wait for `customer-api ... DEPLOYED` in the console.

**Option B: command line**

```bash
mvn clean package
# copy target/customer-api-1.0.0-SNAPSHOT-mule-application.jar into <MULE_HOME>/apps/
# then start the standalone runtime: <MULE_HOME>/bin/mule
```

The API is now available at `http://localhost:8081`.

### Step 3: call it

Bash / macOS / Linux / Git Bash:

```bash
curl -i http://localhost:8081/customers
curl -i http://localhost:8081/customers/CUST-10001
curl -i -X POST http://localhost:8081/customers \
  -H "Content-Type: application/json" \
  -d @samples/requests/create-customer-request.json
```

PowerShell: use `curl.exe` (plain `curl` is an alias for a different command).

```powershell
curl.exe -i http://localhost:8081/customers/CUST-10001
curl.exe -i -X POST http://localhost:8081/customers -H "Content-Type: application/json" -d "@samples/requests/create-customer-request.json"
```

A [Postman collection](postman/customer-api.postman_collection.json) with assertions is included (`Import`, then select the file; the base URL is the `baseUrl` collection variable).

---

## 3. Test scenarios

The mock backend behaves differently depending on the customer id, so every error path can be triggered on demand.

| Request | What the backend does | Expected API response | `error.code` |
|---|---|---|---|
| `GET /customers` | not called | `200` with list and `count` | |
| `GET /customers/CUST-10001` | `200` customer | `200` mapped customer | |
| `GET /customers/CUST-99999` | `404` | `404` | `CUSTOMER_NOT_FOUND` |
| `GET /customers/CUST-BAD` | `400` | `502` | `DOWNSTREAM_SERVICE_ERROR` |
| `GET /customers/CUST-RATE` | `429` | `502` | `DOWNSTREAM_SERVICE_ERROR` |
| `GET /customers/CUST-ERR` | `500` | `502` | `DOWNSTREAM_SERVICE_ERROR` |
| `GET /customers/CUST-SLOW` | waits 10 s | `504` after about 3 s | `DOWNSTREAM_TIMEOUT` |
| Stop the backend, then `GET /customers/CUST-10001` | connection refused | `502` | `DOWNSTREAM_SERVICE_ERROR` |
| `POST` with `samples/requests/create-customer-request.json` | not called | `201` | |
| `POST` with `samples/requests/create-customer-invalid-request.json` | not called | `400` with a `details` array | `VALIDATION_ERROR` |

Every response carries an `X-Correlation-ID` header, and every error body contains the same id. See [`samples/responses/`](samples/responses) for the exact shapes.

---

## 4. Configuration

All environment-specific values live in property files, never in the flows.

| File | Used when |
|---|---|
| `src/main/resources/config-dev.yaml` | default (`env=dev`) |
| `src/main/resources/config-prod.yaml` | `env=prod` (placeholder values) |

| Property | Dev value | Meaning |
|---|---|---|
| `http.listener.host` / `http.listener.port` | `0.0.0.0` / `8081` | Where this API listens |
| `backend.protocol` / `backend.host` / `backend.port` | `HTTP` / `localhost` / `3000` | **Backend URL** |
| `backend.basePath` | `/backend` | Backend path prefix |
| `backend.responseTimeoutMs` | `3000` | **Timeout** of the HTTP Request connector |

The active file is chosen by the `env` global property (`config-${env}.yaml`). Override it, or any single property, with a system property:

* Studio: `Run` > `Run Configurations` > `Arguments` > VM arguments, for example `-Denv=prod` or `-Dhttp.listener.port=8085`
* Standalone runtime: `bin/mule -M-Denv=prod`

---

## 5. Design notes

### Error handling

One global error handler ([`error-handling.xml`](src/main/mule/error-handling.xml)) is the app's default, so no flow needs its own. Handlers are checked top to bottom and the first match wins.

| Mule error | HTTP status | `error.code` |
|---|---|---|
| `APP:VALIDATION` (raised by the validation step) | 400 | `VALIDATION_ERROR` |
| `HTTP:NOT_FOUND` (backend said 404) | 404 | `CUSTOMER_NOT_FOUND` |
| `HTTP:TIMEOUT` | 504 | `DOWNSTREAM_TIMEOUT` |
| any other `HTTP:*` error (backend 4xx/5xx, connection refused) | 502 | `DOWNSTREAM_SERVICE_ERROR` |
| anything else | 500 | `INTERNAL_ERROR` |

Each handler logs, then uses **one Transform Message** that builds the whole error body and sets `httpStatus`. I chose this over "Set Variable blocks plus a shared sub-flow" because each case can be read and explained on its own. The cost is that the `{ error: { code, message, correlationId } }` shape is repeated in every handler; with many more error types I would move it into a shared DataWeave function. The client never sees internal error text.

### Correlation ID and logging

* Mule creates a `correlationId` per request (or reuses an incoming one). It is returned in the `X-Correlation-ID` response header and the error body, **forwarded to the backend** (`sendCorrelationId="ALWAYS"`), and written in every log line (`log4j2.xml`: `event: %X{correlationId}`).
* **No sensitive data in logs.** Logs contain the HTTP method, path, customer id, error type and the *names* of invalid fields. They never contain request or response bodies, query strings, email, phone number or date of birth.

### DataWeave

| File | Purpose |
|---|---|
| [`CustomerMapper.dwl`](src/main/resources/modules/CustomerMapper.dwl) | `toSummary` (list item), `toCustomerDetail` (backend snake_case to API camelCase), `toCreatedCustomer` |
| [`CustomerValidator.dwl`](src/main/resources/modules/CustomerValidator.dwl) | `validateCustomer`: required `firstName`, `lastName`, `email`, `mobileNumber`; email and mobile format; returns **all** problems at once |

### Why the customer id is saved in a variable

The HTTP Request connector **replaces** `payload` and `attributes` with the backend's response. `get-customer-by-id-flow` therefore stores `customerId` in `vars` first, so the error handler can still say "Customer CUST-99999 was not found."

### Project layout

```
.
├── pom.xml, mule-artifact.json
├── src/main/mule/
│   ├── global-config.xml            listener, backend request config, properties, default error handler
│   ├── customer-implementation.xml  the 3 endpoint flows
│   ├── customer-data.xml            sub-flows: read mock file, call backend, validate request
│   ├── common.xml                   shared "request started" log sub-flow
│   └── error-handling.xml           global error handler + standard error body
├── src/main/resources/
│   ├── config-dev.yaml, config-prod.yaml
│   ├── modules/                     DataWeave modules (mapper, validator)
│   ├── mock-data/customers.json     in-memory customer list
│   └── log4j2.xml
├── mock-backend/                    Node.js mock of the downstream customer service
├── samples/requests, samples/responses   the provided example contract
└── postman/                         Postman collection
```

---

## 6. Known limitations

Kept simple on purpose: the brief allows an in-memory list and no database.

| Limitation | Today | Natural next step |
|---|---|---|
| `POST` does not persist | `201` is returned, but the customer is not in `GET /customers` | Object Store or a database |
| `customerId` on create is random | Collisions are possible | Counter or database sequence |
| Unknown routes or wrong HTTP method | Mule's plain-text `404`/`405` | APIkit router with an API spec |
| Malformed JSON request body | Likely reaches the generic handler (`500`) | Map the parse error to `400` |
| Backend returns invalid JSON (`CUST-GARBAGE`) | Likely reaches the generic handler (`500`) | Map to `502` |
| No authentication or pagination | | API Manager policy; `limit`/`offset` |
