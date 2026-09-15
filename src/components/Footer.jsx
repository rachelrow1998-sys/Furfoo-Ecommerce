import { Link } from 'react-router-dom'

// Mirrors the furfoopet.com footer. Update the hrefs here once the matching
// pages exist in this app — the labels and their order are fixed by the design.
const primaryLinks = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/#story' },
  { label: 'Our Products', to: '/shop' },
  { label: 'Contact Us', to: '/#faq' },
]

const policyLinks = [
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms & Conditions', to: '/terms-conditions' },
  { label: 'Refund Policy', to: '/refund-policy' },
]

const socials = [
  { label: 'Facebook', href: 'https://www.facebook.com/furfoopet', icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/furfoopet', icon: InstagramIcon },
  { label: 'WhatsApp', href: 'https://wa.me/60199123946', icon: WhatsAppIcon },
  { label: '小红书', href: 'https://www.xiaohongshu.com/user/profile/furfoopet', wordmark: '小红书' },
]

function FacebookIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z"/>
  </svg>
}

function InstagramIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="1.9" y="1.9" width="20.2" height="20.2" rx="5.6"/>
    <circle cx="12" cy="12" r="4.6"/>
    <circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none"/>
  </svg>
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12.04 2.2c-5.38 0-9.75 4.37-9.75 9.75 0 1.72.45 3.4 1.31 4.88L2.2 21.8l5.1-1.34a9.7 9.7 0 0 0 4.74 1.21h.01c5.37 0 9.74-4.37 9.74-9.75 0-2.6-1.01-5.05-2.85-6.9a9.69 9.69 0 0 0-6.9-2.82Z"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
    />
    <path
      d="M17.2 14.5c-.29-.15-1.71-.84-1.97-.94-.27-.1-.46-.14-.65.15-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-.29-.14-1.22-.45-2.33-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.44-.51.14-.17.19-.29.29-.49.1-.19.05-.36-.02-.51-.07-.14-.65-1.57-.9-2.15-.23-.56-.47-.48-.65-.49l-.55-.01c-.19 0-.5.07-.77.36-.26.29-1 .98-1 2.4 0 1.41 1.03 2.78 1.17 2.97.15.19 2.03 3.1 4.92 4.34.69.3 1.22.48 1.64.61.69.22 1.32.19 1.81.11.56-.08 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.37-.07-.13-.26-.2-.55-.34Z"
      fill="currentColor"
    />
  </svg>
}

export default function Footer() {
  return <footer className="site-footer">
    <div className="site-footer__inner">
      <div className="site-footer__top">
        <Link className="site-footer__brand" to="/" aria-label="FurFoo home">
          <img
            className="site-footer__logo"
            src="/media/brand/furfoo-footer-logo.png"
            alt="FurFoo — Where fur meets fortune"
            width="196"
            height="138"
          />
        </Link>
        <nav className="site-footer__nav" aria-label="Footer">
          <ul>{primaryLinks.map(link => <li key={link.label}><Link to={link.to}>{link.label}</Link></li>)}</ul>
          <ul>{policyLinks.map(link => <li key={link.label}><Link to={link.to}>{link.label}</Link></li>)}</ul>
        </nav>
      </div>
      <div className="site-footer__bottom">
        <ul className="site-footer__social">
          {socials.map(({ label, href, icon: Icon, wordmark }) => <li key={label}>
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
              {Icon ? <Icon/> : <span className="site-footer__social-word" aria-hidden="true">{wordmark}</span>}
            </a>
          </li>)}
        </ul>
        <p className="site-footer__copyright">©2025 FurFooPet. All rights reserved</p>
      </div>
    </div>
  </footer>
}
