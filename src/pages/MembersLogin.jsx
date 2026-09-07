import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function MembersLogin() {
  const [message, setMessage] = useState('')

  const handleSubmit = event => {
    event.preventDefault()
    setMessage('Member authentication is ready to be connected to your account system.')
  }

  return (
    <main className="members-page">
      <section className="members-card" aria-labelledby="members-title">
        <div className="members-intro">
          <span className="members-mark" aria-hidden="true"><UserRound /></span>
          <span className="eyebrow">FURFOO MEMBERS</span>
          <h1 id="members-title">Welcome<br/>back, friend.</h1>
          <p>Sign in to see your orders, saved favourites, and member rewards.</p>
          <Link to="/">Back to Furfoo <ArrowRight aria-hidden="true" /></Link>
        </div>

        <form className="members-form" onSubmit={handleSubmit}>
          <label htmlFor="member-email">Email address</label>
          <div className="members-field">
            <Mail aria-hidden="true" />
            <input id="member-email" name="email" type="email" autoComplete="email" placeholder="hello@example.com" required />
          </div>

          <div className="members-label-row">
            <label htmlFor="member-password">Password</label>
            <a href="mailto:hello@furfoo.com?subject=Furfoo member password help">Forgot password?</a>
          </div>
          <div className="members-field">
            <LockKeyhole aria-hidden="true" />
            <input id="member-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength="8" required />
          </div>

          <button className="button button--primary members-submit" type="submit">Sign in <ArrowRight aria-hidden="true" /></button>
          {message && <p className="members-message" role="status">{message}</p>}
          <p className="members-register">New to Furfoo? <a href="mailto:hello@furfoo.com?subject=Join Furfoo members">Create an account</a></p>
        </form>
      </section>
    </main>
  )
}
