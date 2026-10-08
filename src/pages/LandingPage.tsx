import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, ArrowLeftRight, Coins, MessageCircle,
  Users, Star, Shield, BookOpen, Zap
} from 'lucide-react';
import logoImg from '../assets/logo.webp';
import './LandingPage.css';

const features = [
  {
    icon: <ArrowLeftRight size={22} />,
    color: 'purple',
    title: 'Skill Exchange',
    desc: 'Trade skills with fellow students — teach what you know and learn what you need.',
  },
  {
    icon: <Coins size={22} />,
    color: 'amber',
    title: 'Credit System',
    desc: 'Earn credits by teaching and spend them to learn new skills. Fair and balanced.',
  },
  {
    icon: <MessageCircle size={22} />,
    color: 'cyan',
    title: 'Real-Time Chat',
    desc: 'Coordinate with your partners instantly through built-in messaging.',
  },
  {
    icon: <Users size={22} />,
    color: 'green',
    title: 'Smart Matching',
    desc: 'Our algorithm finds the perfect learning partners based on complementary skills.',
  },
  {
    icon: <Star size={22} />,
    color: 'pink',
    title: 'Ratings & Reviews',
    desc: 'Build your reputation. Quality teaching and learning is recognized and rewarded.',
  },
  {
    icon: <Shield size={22} />,
    color: 'blue',
    title: 'University Verified',
    desc: 'Connect only with verified students from South African universities.',
  },
];

const steps = [
  {
    num: '1',
    title: 'Create Your Profile',
    desc: 'Sign up, list the skills you can teach and the ones you want to learn.',
  },
  {
    num: '2',
    title: 'Find a Match',
    desc: 'Browse users or let our matching system find complementary skill partners.',
  },
  {
    num: '3',
    title: 'Start Learning',
    desc: 'Schedule sessions, exchange knowledge, earn credits and grow together.',
  },
];

export function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <div className="landing-logo-icon">
            <img src={logoImg} alt="EduSwap" />
          </div>
          <span className="landing-logo-text">EduSwap</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#universities">Universities</a>
        </div>
        <div className="landing-nav-cta">
          <Link to="/login" className="btn-ghost">Sign In</Link>
          <Link to="/signup" className="btn-primary-landing">
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-bg-effects">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>

        <div className="hero-badge">
          <Sparkles size={14} />
          Peer-to-peer skill exchange for students
        </div>

        <h1 className="hero-title">
          Learn Anything,{' '}
          <span className="gradient-word">Teach Everything</span>
        </h1>

        <p className="hero-subtitle">
          EduSwap connects South African university students to exchange skills.
          Teach what you're great at, learn what you're curious about — no tuition fees, just knowledge.
        </p>

        <div className="hero-cta">
          <Link to="/signup" className="hero-btn-primary">
            Start Swapping <ArrowRight size={18} />
          </Link>
          <a href="#features" className="hero-btn-secondary">
            <BookOpen size={18} /> Learn More
          </a>
        </div>

        <div className="hero-stats-row">
          <div className="hero-stat">
            <span className="hero-stat-value">Teach</span>
            <span className="hero-stat-label">Share what you know</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">Learn</span>
            <span className="hero-stat-label">Explore new skills</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">Earn</span>
            <span className="hero-stat-label">Build credits by teaching</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features" id="features">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label"><Zap size={14} /> Features</div>
          <h2 className="section-title">Everything you need to learn & grow</h2>
          <p className="section-desc" style={{ margin: '0 auto' }}>
            A complete platform built for student-to-student knowledge exchange.
          </p>
        </div>

        <div className="features-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className={`feature-icon ${f.color}`}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how" id="how-it-works">
        <div className="section-label"><BookOpen size={14} /> How It Works</div>
        <h2 className="section-title">Get started in 3 simple steps</h2>
        <p className="section-desc" style={{ margin: '0 auto 56px' }}>
          From signup to your first session in under 5 minutes.
        </p>

        <div className="steps-container">
          {steps.map((s, i) => (
            <div key={s.num} className="step-card">
              <div className="step-number">{s.num}</div>
              {i < steps.length - 1 && <div className="step-connector" />}
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Universities */}
      <section className="landing-social" id="universities">
        <div className="section-label"><Users size={14} /> Trusted By</div>
        <h2 className="section-title">Students across South Africa</h2>
        <p className="section-desc" style={{ margin: '0 auto' }}>
          Join students from top universities who are already swapping skills.
        </p>
        <div className="universities-row">
          <span className="uni-name">Stellenbosch University</span>
          <span className="uni-name">University of Cape Town</span>
          <span className="uni-name">University of Pretoria</span>
          <span className="uni-name">Wits University</span>
          <span className="uni-name">University of KwaZulu-Natal</span>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="cta-box">
          <h2>Ready to start learning?</h2>
          <p>Join hundreds of students already exchanging skills on EduSwap.</p>
          <div className="hero-cta">
            <Link to="/signup" className="hero-btn-primary">
              Create Free Account <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span className="footer-text">© 2026 EduSwap. Built for students, by students.</span>
        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <Link to="/login">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
