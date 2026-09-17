import { Link } from 'react-router-dom'
import { socials } from '../data/socials'

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
