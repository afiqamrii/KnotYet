const https = require('https');
const options = {
  hostname: 'en.wikipedia.org',
  path: '/w/api.php?action=query&titles=File:Kevin_MacLeod_-_Monkeys_Spinning_Monkeys.ogg|File:Kevin_MacLeod_-_Fluffing_a_Duck.ogg|File:Kevin_MacLeod_-_Sneaky_Snitch.ogg&prop=imageinfo&iiprop=url&format=json',
  headers: {
    'User-Agent': 'AntigravityBot/1.0'
  }
};
https.get(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const pages = JSON.parse(data).query.pages;
    for (let id in pages) {
      if (pages[id].imageinfo) {
        console.log(pages[id].title, '=>', pages[id].imageinfo[0].url);
      }
    }
  });
});
