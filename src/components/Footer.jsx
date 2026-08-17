export default function Footer() {
  return <footer className="footer">
    <div className="footer-shell">
      <div className="footer-top">
        <div className="footer-brand">
          <img
            className="footer-logo"
            src="/media/brand/homee-toggle-footer-logo.png"
            alt="Furfoo — Where fur meets fortune"
          />
          <p>Natural treats and thoughtful care for more good days together.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/shop">Shop</a>
          <a href="/#story">Our Story</a>
          <a href="/#faq">FAQ</a>
          <a href="https://instagram.com/furfoopet">Instagram</a>
          <a href="https://wa.me/60199123946">WhatsApp</a>
          <a href="mailto:hello@furfoo.com">Email</a>
        </nav>
      </div>
      <div className="footer-line">
        <span>Good treats. Better days.</span>
        <small>© 2026 FURFOO</small>
      </div>
    </div>
  </footer>
}
