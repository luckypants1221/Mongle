# Mobile API Contract

The frontend is wired to the FastAPI backend described by:

```txt
http://13.125.10.228/openapi.json
```

## Base URL

Default:

```txt
http://13.125.10.228
```

Override with:

```sh
EXPO_PUBLIC_API_BASE_URL=http://your-server
```

## Auth

### `POST /signup`

```json
{
  "name": "string",
  "email": "string",
  "pwd": "string"
}
```

### `POST /login`

```json
{
  "email": "string",
  "pwd": "string"
}
```

### `POST /changepw`

```json
{
  "email": "string",
  "pwd": "string",
  "new_pwd": "string"
}
```

### `POST /delete`

```json
{
  "email": "string",
  "pwd": "string"
}
```

## Profile

### `GET /profile/{user_id}`

`user_id` is a path parameter.

### `PUT /profile/{user_id}`

```json
{
  "user_id": "string",
  "email": "string",
  "name": "string"
}
```

## Sensor

### `POST /sensor`

```json
{
  "id": 0,
  "heartbeat": 0,
  "temp": 0,
  "hum": 0,
  "volume": 0
}
```

### `GET /sensor?id=...`

### `GET /sensor/{date}`

### `PUT /sensor?id=...&time_stamp=...`

### `DELETE /sensor?id=...&time_stamp=...`

## Sleep Records

### `GET /sleepinfo?id=...`

### `POST /sleepinfo`

```json
{
  "id": "string",
  "day": "2026-06-08T00:00:00.000Z",
  "sleep_score": 0,
  "start_sleep": "2026-06-08T23:00:00.000Z",
  "end_sleep": "2026-06-09T07:00:00.000Z",
  "temp_avg": 0,
  "hum_avg": 0,
  "audio_path": "string",
  "duration": 0,
  "snoring_count": 0
}
```

## Notes

- The backend OpenAPI schema does not define response shapes, so the frontend normalizes likely response fields in `lib/api.ts`.
- Alarm APIs are not present in the current OpenAPI document. The frontend keeps alarm state locally in memory for now.
- Sleep memo update APIs are not present in the current OpenAPI document. The frontend updates memo text in memory for now.
