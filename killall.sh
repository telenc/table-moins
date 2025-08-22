lsof -ti :5173 | xargs kill -9 2>/dev/null || echo Port 5173 libre
