import app from './app.js';
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`chores4irl backend listening on port ${PORT}`));
