const https = require('https');
https.get('https://github.com/photonstorm/phaser3-examples/tree/master/public/assets/audio', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const matches = data.match(/href="[^"]+\.mp3"/g);
    console.log(matches ? Array.from(new Set(matches.map(m => m.split('/').pop().replace('"', '')))) : 'No matches');
  });
});
