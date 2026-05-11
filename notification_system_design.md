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

# Stage 2

I will use Neon PostgreSQL with Drizzle ORM.

Reason ->

- PostgreSQL is reliable for structured notification data.
- Neon gives hosted serverless Postgres, so setup is fast.
- Drizzle ORM keeps schema and queries type-safe in JavaScript/TypeScript.

## DB Schema

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  notification_id INT REFERENCES notifications(id),
  is_read BOOLEAN DEFAULT false
);
```

## Drizzle Schema

```ts
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 50 }).notNull(),
  notificationId: integer("notification_id").references(() => notifications.id),
  isRead: boolean("is_read").default(false)
});
```

## Queries

Create notification:

```sql
INSERT INTO notifications (title, message, type)
VALUES ('Exam Result', 'Semester results are published', 'result');
```

Get all notifications for a user:

```sql
SELECT n.*, un.is_read
FROM notifications n
JOIN user_notifications un ON n.id = un.notification_id
WHERE un.user_id = 'user_1'
ORDER BY n.created_at DESC;
```

Get one notification:

```sql
SELECT n.*, un.is_read
FROM notifications n
JOIN user_notifications un ON n.id = un.notification_id
WHERE n.id = 1 AND un.user_id = 'user_1';
```

Mark as read:

```sql
UPDATE user_notifications
SET is_read = true
WHERE notification_id = 1 AND user_id = 'user_1';
```

Delete from user inbox:

```sql
DELETE FROM user_notifications
WHERE notification_id = 1 AND user_id = 'user_1';
```

## Problems When Data Grows

- Many notifications can make list APIs slow. Use indexes on `user_id`, `notification_id`, and `created_at`.
- Old notifications can increase table size. Archive or delete old records.
- Too many real-time connections can overload one server. Use WebSocket scaling with pub/sub later.
- Large result sets can slow frontend loading. Use pagination with `limit` and `offset`.
