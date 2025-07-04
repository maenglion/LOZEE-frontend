import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  'https://lozee.netlify.app',
  'http://localhost:5500',
  undefined
];

app.use(cors({
  origin: (origin, callback) => {
    console.log('🌐 요청 origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.options('*', cors());

app.get('/test', (req, res) => {
  res.json({ message: '✅ CORS OK' });
});

app.listen(port, () => {
  console.log(`🚀 CORS 테스트 서버 실행 중: http://localhost:${port}`);
});
