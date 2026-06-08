# Mobile API Contract

The mobile app no longer stores users, sleep records, or alarm settings in `AsyncStorage`.
It calls the configured REST API from `lib/api.ts`.

## Base URL

Set the API server URL with:

```sh
EXPO_PUBLIC_API_BASE_URL=https://your-server.example.com/api
```

For local web development, the default is:

```txt
http://localhost:3000/api
```

## Auth

### `POST /auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response can be either:

```json
{
  "id": "user_1",
  "name": "User",
  "email": "user@example.com"
}
```

or:

```json
{
  "user": {
    "id": "user_1",
    "name": "User",
    "email": "user@example.com"
  },
  "token": "optional-access-token"
}
```

When `token` is returned, the app sends it as `Authorization: Bearer <token>`.

### `POST /auth/register`

Request:

```json
{
  "name": "User",
  "email": "user@example.com",
  "password": "password"
}
```

Response shape is the same as login.

### `PUT /users/:userId`

Request:

```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

Response:

```json
{
  "id": "user_1",
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

## Sleep Records

### `GET /users/:userId/sleep-records`

Response:

```json
[
  {
    "id": "record_1",
    "date": "2026-06-08",
    "startTime": "23:00",
    "endTime": "07:00",
    "durationMinutes": 480,
    "score": 88,
    "temperature": 23,
    "humidity": 55,
    "memo": "optional"
  }
]
```

### `POST /users/:userId/sleep-records`

Request:

```json
{
  "date": "2026-06-08",
  "startTime": "23:00",
  "endTime": "07:00",
  "durationMinutes": 480,
  "score": 88,
  "temperature": 23,
  "humidity": 55
}
```

Response: created sleep record with `id`.

### `PUT /users/:userId/sleep-records/:recordId`

Request:

```json
{
  "memo": "Updated memo"
}
```

Response: updated sleep record.

## Alarm

### `GET /users/:userId/alarm`

Response:

```json
{
  "hour": 7,
  "min": 0,
  "on": true
}
```

### `PUT /users/:userId/alarm`

Request:

```json
{
  "hour": 7,
  "min": 30,
  "on": true
}
```

Response: updated alarm settings.
