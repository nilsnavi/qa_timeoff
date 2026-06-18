const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();

const SECRET = 'CHANGE_ME_SECRET_123456789';

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

app.post('/deploy', (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const branch = req.body?.ref;
  if (branch !== 'refs/heads/main') {
    return res.send('Ignored branch: ' + branch);
  }

  res.send('Deploy started');

  exec('/opt/qa_timeoff/deploy.sh', (error, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);

    if (error) {
      console.error('Deploy failed:', error);
    }
  });
});

app.listen(9000, () => {
  console.log('QA TimeOff webhook listening on port 9000');
});
