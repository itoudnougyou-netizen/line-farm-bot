require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();

// LINE設定
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

// Google Sheets設定
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// 画像保存フォルダ作成
const imageDir = path.join(__dirname, 'images');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir);
}

// シートに書き込み
async function appendRow(data) {
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A1:D1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [data],
    },
  });
}

// 画像保存
async function saveImage(messageId) {
  const stream = await client.getMessageContent(messageId);
  const filePath = path.join(imageDir, `${messageId}.jpg`);

  const writable = fs.createWriteStream(filePath);
  stream.pipe(writable);

  return new Promise((resolve) => {
    writable.on('finish', () => resolve(filePath));
  });
}

// Webhook受信
app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type !== 'message') continue;

    const userId = event.source.userId || '';
    const date = new Date().toLocaleString('ja-JP');

    // テキスト
    if (event.message.type === 'text') {
      await appendRow([
        date,
        userId,
        event.message.text,
        '',
      ]);
    }

    // 画像
    if (event.message.type === 'image') {
      const imagePath = await saveImage(event.message.id);

      await appendRow([
        date,
        userId,
        '',
        imagePath,
      ]);
    }
  }

  res.sendStatus(200);
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
