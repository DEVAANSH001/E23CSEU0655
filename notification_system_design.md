# Stage 1

Campus notification system for placements, events and results.

Users are already authorised, so no login API is needed.

## Notification JSON

```json
{
  "id": "1",
  "title": "Placement Drive",
  "message": "ABC company drive starts tomorrow",
  "type": "placement",
  "isRead": false,
  "createdAt": "2026-05-11T10:00:00Z"
}
```

## APIs

Create notification:

```http
POST /api/notifications
```

```json
{
  "title": "Exam Result",
  "message": "Semester results are published",
  "type": "result"
}
```

Get all notifications:

```http
GET /api/notifications
```

Get one notification:

```http
GET /api/notifications/:id
```

Mark as read:

```http
PATCH /api/notifications/:id/read
```

Delete notification:

```http
DELETE /api/notifications/:id
```

## Common Response

```json
{
  "success": true,
  "data": {}
}
```

## Error Response

```json
{
  "success": false,
  "message": "Notification not found"
}
```

## Real-Time Notifications

Use WebSocket for live updates:

```http
GET /ws/notifications
```

Example event:

```json
{
  "event": "new_notification",
  "data": {
    "id": "1",
    "title": "Placement Drive",
    "message": "ABC company drive starts tomorrow"
  }
}
```

If WebSocket fails, frontend can call `GET /api/notifications` every 30 seconds.