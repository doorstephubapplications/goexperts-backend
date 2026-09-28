const http = require('http');

http.get('http://127.0.0.1:3000/api/v1/mobile/search?q=test', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(res.statusCode);
    console.log(data);
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
