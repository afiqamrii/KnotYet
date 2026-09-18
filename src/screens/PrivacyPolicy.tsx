import { useEffect } from 'react';
import { ArrowLeft, ExternalLink, Heart, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/ArcadeArt';
import '../styles/privacy.css';

const EFFECTIVE_DATE = '18 September 2026';

export const PrivacyPolicy = () => {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name=description]');
    const previousDescription = description?.content;
    document.title = 'Privacy Policy | KnotYet';
    if (description) description.content = 'Learn how KnotYet collects, uses, stores, and protects information, including data used for analytics and advertising.';
    window.scrollTo(0, 0);
    return () => {
      document.title = previousTitle;
      if (description && previousDescription) description.content = previousDescription;
    };
  }, []);

  return (
    <div className={'privacy-page'}>
      <a className={'skip-link'} href={'#privacy-content'}>Skip to content</a>
      <header className={'privacy-nav'}>
        <div className={'privacy-width privacy-nav-inner'}>
          <Link className={'date-brand'} to={'/'} aria-label={'KnotYet home'}><BrandMark /><span>KnotYet<span className={'brand-period'}>.</span></span></Link>
          <Link className={'privacy-back'} to={'/'}><ArrowLeft size={17} /> Back to home</Link>
        </div>
      </header>

      <main id={'privacy-content'} className={'privacy-width privacy-main'}>
        <section className={'privacy-hero'} aria-labelledby={'privacy-title'}>
          <span className={'privacy-kicker'}><ShieldCheck size={15} /> YOUR PRIVACY, EXPLAINED</span>
          <h1 id={'privacy-title'}>Privacy Policy<span>.</span></h1>
          <p>We want your time on KnotYet to feel playful, not puzzling. This policy explains what information we collect, why we use it, and the choices you have.</p>
          <div className={'privacy-date'}><strong>Effective date</strong><span>{EFFECTIVE_DATE}</span></div>
        </section>

        <div className={'privacy-layout'}>
          <aside className={'privacy-toc'} aria-label={'Privacy policy sections'}>
            <strong>On this page</strong>
            <a href={'#information'}>Information we collect</a>
            <a href={'#use'}>How we use information</a>
            <a href={'#ads'}>Advertising and cookies</a>
            <a href={'#sharing'}>How we share information</a>
            <a href={'#choices'}>Your choices and rights</a>
            <a href={'#retention'}>Retention and security</a>
            <a href={'#children'}>Children’s privacy</a>
            <a href={'#contact'}>Contact us</a>
          </aside>

          <article className={'privacy-card'}>
            <section>
              <h2>1. Who we are</h2>
              <p>KnotYet is a two-player web game for conversation, connection, and light-hearted challenges. In this policy, “KnotYet,” “we,” “us,” and “our” refer to the operator of the KnotYet service at <a href={'https://knotyetapp.me'}>knotyetapp.me</a>.</p>
            </section>

            <section id={'information'}>
              <h2>2. Information we collect</h2>
              <h3>Information you provide</h3>
              <ul>
                <li><strong>Account information.</strong> If you sign in with Google, we receive basic account details made available through Google, such as your name, email address, profile image, and a unique account identifier.</li>
                <li><strong>Profile and game information.</strong> This may include your chosen display name, avatar, relationship type, game progress, points, play counts, answers completed, partner links, and friend or room connections.</li>
                <li><strong>Communications.</strong> If you contact us, we receive the information you include in your message.</li>
              </ul>
              <h3>Information collected automatically</h3>
              <ul>
                <li><strong>Device and usage data.</strong> Our hosting, analytics, and advertising providers may receive information such as your IP address, browser and device type, pages viewed, referring page, approximate location derived from IP, and timestamps.</li>
                <li><strong>Browser storage.</strong> We use local storage and session storage to remember preferences, profile details, game state, room codes, and progress on your device.</li>
                <li><strong>Multiplayer connection data.</strong> When you use multiplayer features, technical connection identifiers and network information may be processed to establish a peer-to-peer connection. Game data sent during that session may travel directly between players.</li>
              </ul>
            </section>

            <section id={'use'}>
              <h2>3. How we use information</h2>
              <p>We use information to:</p>
              <ul>
                <li>provide, operate, and improve KnotYet;</li>
                <li>authenticate users and sync profiles and game progress;</li>
                <li>create multiplayer rooms and connect players;</li>
                <li>remember preferences and restore game sessions;</li>
                <li>measure site performance and understand how features are used;</li>
                <li>display, measure, and help prevent fraud involving advertisements;</li>
                <li>protect the service, enforce limits, troubleshoot problems, and comply with legal obligations.</li>
              </ul>
            </section>

            <section id={'ads'}>
              <h2>4. Advertising, cookies, and similar technologies</h2>
              <p>KnotYet uses Google AdSense to display advertisements. Google and other third-party vendors may use cookies, web beacons, device identifiers, or similar technologies to serve and measure ads based on your visits to this and other websites. Google’s use of advertising cookies enables it and its partners to serve ads based on your visit to KnotYet and other sites.</p>
              <p>You can learn how Google uses data from sites that use its services in <a href={'https://policies.google.com/technologies/partner-sites'} target={'_blank'} rel={'noopener noreferrer'}>Google’s partner-sites policy <ExternalLink aria-hidden={'true'} /></a>. You may manage personalised advertising through <a href={'https://adssettings.google.com/'} target={'_blank'} rel={'noopener noreferrer'}>Google Ads Settings <ExternalLink aria-hidden={'true'} /></a> or opt out of some third-party personalised advertising through <a href={'https://www.aboutads.info/choices/'} target={'_blank'} rel={'noopener noreferrer'}>YourAdChoices <ExternalLink aria-hidden={'true'} /></a>.</p>
              <p>Where required by law, we or our advertising partners will request consent before using non-essential cookies or serving personalised ads. If you decline, you may still see non-personalised or contextual advertising.</p>
            </section>

            <section id={'sharing'}>
              <h2>5. How we share information</h2>
              <p>We do not sell your personal information. We may share or allow information to be processed by service providers that help us operate KnotYet, including:</p>
              <ul>
                <li><strong>Supabase</strong> for authentication, databases, and synced progress;</li>
                <li><strong>Google</strong> for sign-in, advertising, fonts, and network connection services;</li>
                <li><strong>Vercel</strong> for hosting and privacy-focused web analytics;</li>
                <li><strong>PeerJS infrastructure</strong> to help establish multiplayer connections;</li>
                <li><strong>GIPHY and external media hosts</strong> when reaction images or audio are loaded.</li>
              </ul>
              <p>These providers may process information under their own privacy policies. We may also disclose information if required by law, to protect users or the service, in connection with a business transfer, or with your direction or consent.</p>
            </section>

            <section id={'choices'}>
              <h2>6. Your choices and privacy rights</h2>
              <ul>
                <li>You can sign out at any time and manage the Google account used to access KnotYet.</li>
                <li>You can block or clear cookies, local storage, and session storage in your browser. Doing so may reset your progress or affect site features.</li>
                <li>You can change advertising preferences using the links in the advertising section above.</li>
                <li>You may request access to, correction of, or deletion of personal information associated with your account by contacting us.</li>
                <li>Depending on where you live, you may also have rights to object to or restrict processing, withdraw consent, receive a portable copy of your data, or complain to a data-protection authority.</li>
              </ul>
            </section>

            <section id={'retention'}>
              <h2>7. Data retention and security</h2>
              <p>We keep personal information only for as long as reasonably necessary to provide the service, meet legal obligations, resolve disputes, and protect our legitimate interests. Session data stored in your browser remains until it expires or you clear it. Account data may remain until the account is deleted or the applicable retention period ends.</p>
              <p>We use reasonable technical and organisational safeguards designed to protect information. However, no internet transmission or storage system is completely secure, so we cannot guarantee absolute security.</p>
            </section>

            <section><h2>8. International data transfers</h2><p>Our providers may process information in countries other than your own. Where required, we rely on recognised legal safeguards for these transfers.</p></section>
            <section id={'children'}><h2>9. Children’s privacy</h2><p>KnotYet is not directed to children under 13, or the minimum age required by local law, and we do not knowingly collect personal information from children. If you believe a child has provided personal information, please contact us so we can take appropriate action.</p></section>
            <section><h2>10. Changes to this policy</h2><p>We may update this policy as KnotYet or applicable laws change. We will post the revised version here and update the effective date. Material changes may also be highlighted within the service.</p></section>

            <section id={'contact'} className={'privacy-contact'}>
              <span className={'privacy-contact-icon'}><Heart fill={'currentColor'} aria-hidden={'true'} /></span>
              <div><h2>11. Contact us</h2><p>Questions, privacy requests, or concerns? Email us at <a href={'mailto:privacy@knotyetapp.me'}>privacy@knotyetapp.me</a>.</p></div>
            </section>
          </article>
        </div>
      </main>

      <footer className={'privacy-footer privacy-width'}><span>© {new Date().getFullYear()} KnotYet</span><Link to={'/'}>Back to KnotYet</Link></footer>
    </div>
  );
};
