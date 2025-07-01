import express from 'express';
import cors from 'cors';

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});