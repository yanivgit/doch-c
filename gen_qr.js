const QRCode = require('qrcode');
const url = 'exp://192.168.68.51:8081';
const outputPath = 'C:\\Users\\gitma\\.gemini\\antigravity-ide\\brain\\7a2b0d03-5d22-4f1f-a4c5-306989974182\\expo_qr.png';

QRCode.toFile(outputPath, url, {
  color: {
    dark: '#000000',
    light: '#ffffff'
  },
  width: 400
}, function (err) {
  if (err) throw err;
  console.log('done');
});
