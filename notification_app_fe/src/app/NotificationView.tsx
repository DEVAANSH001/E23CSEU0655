"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";

type Notification = {
  ID: string;
  Type: "Event" | "Result" | "Placement";
  Message: string;
  Timestamp: string;
};

type Props = {
  priority?: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/notifications";
const token = process.env.NEXT_PUBLIC_AFFORDMED_ACCESS_TOKEN || "";
const weights = { Placement: 3, Result: 2, Event: 1 };

function score(notification: Notification) {
  return weights[notification.Type] * 10000000000000 + new Date(notification.Timestamp).getTime();
}

function pushHeap(heap: Notification[], item: Notification) {
  heap.push(item);
  let index = heap.length - 1;

  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (score(heap[parent]) >= score(heap[index])) break;
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function popHeap(heap: Notification[]) {
  if (heap.length === 1) return heap.pop();

  const top = heap[0];
  heap[0] = heap.pop() as Notification;
  let index = 0;

  while (true) {
    const left = index * 2 + 1;
    const right = index * 2 + 2;
    let biggest = index;

    if (left < heap.length && score(heap[left]) > score(heap[biggest])) biggest = left;
    if (right < heap.length && score(heap[right]) > score(heap[biggest])) biggest = right;
    if (biggest === index) break;

    [heap[index], heap[biggest]] = [heap[biggest], heap[index]];
    index = biggest;
  }

  return top;
}

function getTop(notifications: Notification[], count: number) {
  const heap: Notification[] = [];
  notifications.forEach((item) => pushHeap(heap, item));

  const result: Notification[] = [];
  while (heap.length && result.length < count) {
    result.push(popHeap(heap) as Notification);
  }
  return result;
}

export default function NotificationView({ priority = false }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [type, setType] = useState("All");
  const [limit, setLimit] = useState(priority ? 10 : 10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewed, setViewed] = useState<string[]>([]);

  useEffect(() => {
    setViewed(JSON.parse(localStorage.getItem("viewed_notifications") || "[]"));
  }, []);

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          limit: String(priority ? 100 : limit),
          page: String(page)
        });
        if (type !== "All") params.set("notification_type", type);

        const url = `${API}?${params.toString()}`;
        console.log("Fetching from:", url);

        const response = await fetch(url);

        if (!response.ok) {
          const text = await response.text();
          console.error("Response error:", response.status, text);
          throw new Error(`Failed to load notifications: ${response.status} ${text}`);
        }

        const data = await response.json();
        console.log("Data received:", data);
        
        if (!data.notifications || !Array.isArray(data.notifications)) {
          throw new Error("Invalid response format: " + JSON.stringify(data));
        }
        
        setItems(data.notifications);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        console.error("Load error:", message);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [limit, page, priority, type]);

  const visibleItems = useMemo(
    () => priority ? getTop(items, limit) : items,
    [items, limit, priority]
  );

  function markViewed(id: string) {
    const next = Array.from(new Set([...viewed, id]));
    setViewed(next);
    localStorage.setItem("viewed_notifications", JSON.stringify(next));
  }

  function getTypeColor(notifType: string): "primary" | "success" | "warning" | "default" {
    switch (notifType) {
      case "Placement": return "primary";
      case "Result": return "success";
      case "Event": return "warning";
      default: return "default";
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Campus Notifications
          </Typography>
          <Button component={Link} href="/" color={!priority ? "primary" : "inherit"}>
            All
          </Button>
          <Button component={Link} href="/priority" color={priority ? "primary" : "inherit"}>
            Priority
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" gutterBottom>
              {priority ? "Priority Inbox" : "All Notifications"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {priority 
                ? "Top notifications ranked by importance" 
                : "View all campus updates"}
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Placement">Placement</MenuItem>
                <MenuItem value="Result">Result</MenuItem>
                <MenuItem value="Event">Event</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label={priority ? "Top n" : "Limit"}
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(10, Number(e.target.value))))}
              inputProps={{ min: 1, max: 10 }}
            />

            {!priority && (
              <TextField
                fullWidth
                size="small"
                label="Page"
                type="number"
                value={page}
                onChange={(e) => setPage(Math.max(1, Number(e.target.value)))}
                inputProps={{ min: 1 }}
              />
            )}
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
          
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && visibleItems.length === 0 && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary">
                No notifications found
              </Typography>
            </Box>
          )}

          {!loading && visibleItems.map((item) => {
            const isViewed = viewed.includes(item.ID);

            return (
              <Card key={item.ID} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        size="small" 
                        label={item.Type} 
                        color={getTypeColor(item.Type)}
                      />
                      <Chip 
                        size="small" 
                        label={isViewed ? "Viewed" : "New"} 
                        color={isViewed ? "default" : "success"}
                        variant={isViewed ? "outlined" : "filled"}
                      />
                    </Stack>

                    <Typography variant="body1">
                      {item.Message}
                    </Typography>
                    
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.Timestamp).toLocaleString()}
                    </Typography>

                    {!isViewed && (
                      <Box>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={() => markViewed(item.ID)}
                        >
                          Mark as Viewed
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Container>
    </Box>
  );
}
