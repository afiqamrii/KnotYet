import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const routes = [
  {
    path: '/',
    source: '/src/screens/LandingPage.tsx',
    component: 'LandingPage',
    output: 'index.html',
    title: 'KnotYet — Your next date night, with a twist',
    description: 'Make a little time for you two. Play conversation cards, guessing games, and friendly challenges together on one screen or from anywhere.',
  },
  {
    path: '/try',
    source: '/src/screens/PublicConversationDeck.tsx',
    component: 'PublicConversationDeck',
    output: 'try/index.html',
    title: 'Free Conversation Cards for Two | KnotYet',
    description: 'Play 18 original conversation cards for two, with thoughtful follow-up questions. Pick a theme and take turns on one screen. No sign-in needed.',
  },
  {
    path: '/privacy',
    source: '/src/screens/PrivacyPolicy.tsx',
    component: 'PrivacyPolicy',
    output: 'privacy/index.html',
    title: 'Privacy Policy | KnotYet',
    description: 'Learn how KnotYet collects, uses, stores, and protects information, including data used for analytics and advertising.',
  },
];

const dist = path.resolve('dist');
const template = await readFile(path.join(dist, 'index.html'), 'utf8');
const rootTag = '<div id="root"></div>';
if (!template.includes(rootTag)) throw new Error('Built HTML is missing the empty React root');

// Vite's SSR loader must use the ESM React Router build. Load StaticRouter
// through that same loader so Link and the router share one context instance.
const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
  ssr: {
    noExternal: ['react-router-dom', 'react-router'],
    resolve: { conditions: ['module', 'import', 'default'] },
  },
});

try {
  const { StaticRouter } = await vite.ssrLoadModule('react-router-dom');
  for (const route of routes) {
    const Component = (await vite.ssrLoadModule(route.source))[route.component];
    if (!Component) throw new Error('Missing ' + route.component + ' in ' + route.source);

    const content = renderToStaticMarkup(
      React.createElement(StaticRouter, { location: route.path }, React.createElement(Component)),
    );
    if (!content.includes('<main') || !content.includes('<h1')) {
      throw new Error('Prerendered ' + route.path + ' has no main content or heading');
    }

    const canonical = new URL(route.path, 'https://knotyetapp.me').href;
    const html = template
      .replace(rootTag, '<div id="root">' + content + '</div>')
      .replace(/<title>[^<]*<\/title>/i, '<title>' + route.title + '</title>')
      .replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="' + route.description + '" />')
      .replace('</head>', '  <link rel="canonical" href="' + canonical + '" />\n</head>');

    const output = path.join(dist, route.output);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, html);
    console.log('Prerendered ' + route.path + ' to ' + route.output);
  }
} finally {
  await vite.close();
}
