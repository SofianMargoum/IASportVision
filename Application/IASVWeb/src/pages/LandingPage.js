import React from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import './LandingPage.css';

/**
 * Landing page publique IA Sport Vision.
 * Tous les textes ci-dessous sont volontairement centralisés en haut de fichier
 * pour être facilement modifiables sans toucher au JSX.
 */
const CONTENT = {
  hero: {
    title: 'Tout votre football,\ndans une seule application',
    subtitle:
      "Filmez, analysez et partagez les matchs de votre club amateur grâce à IA Sport Vision.",
    primary: 'Découvrir la solution',
    secondary: 'Se connecter',
  },
  product: {
    eyebrow: 'La solution',
    title: 'Une caméra intelligente, des vidéos prêtes à partager',
    text:
      "Installez la caméra IA Sport Vision sur votre terrain : la captation se lance automatiquement, suit le jeu et produit en quelques minutes la vidéo complète du match, le résumé et les meilleurs extraits, sans cameraman.",
    features: [
      {
        title: 'Captation automatique',
        text: "La caméra suit le ballon et l'action en temps réel, sans intervention humaine.",
      },
      {
        title: 'Vidéo complète du match',
        text: "Récupérez la vidéo intégrale dès la fin de la rencontre, en 4K, prête à être partager.",
      },
      {
        title: 'Résumés et replays',
        text: 'Buts, occasions, temps forts : nos algorithmes génèrent un replay exploitable par tous.',
      },
      {
        title: 'Extraits personnalisés',
        text: 'Chaque joueur peut récupérer ses propres séquences pour progresser ou les partager.',
      },
    ],
  },
  app: {
    eyebrow: "L'application mobile",
    title: 'Pensée pour les coachs, joueurs et supporters',
    text:
      'Une seule application, trois expériences. Suivez votre club partout, en match comme à l’entraînement.',
    screenshots: [
      { src: '/app-profile-v2.jpg', alt: 'Profil joueur' },
      { src: '/app-record-v2.jpg',  alt: 'Enregistrement match' },
      { src: '/app-stat.jpg',    alt: 'Statistiques' },
      { src: '/app-video.jpg',   alt: 'Lecteur video' },
    ],
    pillars: [
	  { label: 'Résultats', icon: '🏆' },
	  { label: 'Classements', icon: '📈' },
	  { label: 'Statistiques', icon: '📊' },
	  { label: 'Vidéos', icon: '🎬' },
	  { label: 'Compositions', icon: '📋' },
	],
  },
  clubs: {
    eyebrow: 'Pour les clubs amateurs',
    title: 'Une solution simple, accessible à tous les clubs',
    text:
      'IA Sport Vision est conçue pour les clubs amateurs, les districts, les villages et les petites structures. Pas besoin de cameraman, pas besoin de compétences techniques : le bénévole, l’éducateur et le dirigeant peuvent l’utiliser dès le premier match.',
    items: [
      { title: 'Plug & play', text: 'Installation simple sur le terrain, captation automatique du match.' },
      { title: 'Pour bénévoles', text: 'Aucune compétence vidéo nécessaire, tout est automatisé.' },
      { title: 'Toutes catégories', text: 'U7 jusqu’à seniors, féminines, foot loisir et foot adapté.' },
      { title: 'Districts & ligues', text: 'Une plateforme commune pour le football amateur français.' },
    ],
  },
  pricing: {
    eyebrow: 'Tarifs',
    title: 'Des formules simples, sans surprise',
    text: 'Choisissez la formule adaptée à votre club. Les prix définitifs seront communiqués prochainement.',
    plans: [
      {
        name: 'Découverte',
        price: 'Sur devis',
        period: 'pour découvrir',
        features: [
          'Captation d’un match test',
          'Vidéo complète + résumé',
          'Accès application mobile',
          'Support par email',
        ],
        cta: 'Demander un essai',
        highlight: false,
      },
      {
        name: 'Club',
        price: 'Sur devis',
        period: 'par saison',
        features: [
          'Caméra IA Sport Vision incluse',
          'Captation illimitée des matchs à domicile',
          'Vidéos, résumés et extraits',
          'Comptes coachs, joueurs, supporters',
          'Support prioritaire',
        ],
        cta: 'Contactez-nous',
        highlight: true,
      },
      {
        name: 'District / Ligue',
        price: 'Sur mesure',
        period: 'multi-clubs',
        features: [
          'Déploiement multi-clubs',
          'Tableau de bord centralisé',
          'Accompagnement dédié',
          'Formation des bénévoles',
        ],
        cta: 'Parlons-en',
        highlight: false,
      },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Vous avez un club ? Parlons-en.',
    text: 'Une question, une demande de démo, un projet de district ? Notre équipe vous répond rapidement.',
    email: 'contact@iasportvision.com',
  },
};

export default function LandingPage() {
  return (
    <div className="iasv-landing">
      <PublicNavbar />

      {/* HERO */}
      <section id="accueil" className="iasv-hero">
        <div
          className="iasv-hero__bg"
          style={{ backgroundImage: 'url(/stade-cover.png)' }}
          aria-hidden="true"
        />
        <div className="iasv-hero__overlay" aria-hidden="true" />
        <div className="iasv-hero__inner">
          <span className="iasv-eyebrow">Football amateur · IA · Vidéo</span>
          <h1>
            {CONTENT.hero.title.split('\n').map((line, i) => (
              <span key={i} className="iasv-hero__line">{line}</span>
            ))}
          </h1>
          <p className="iasv-hero__subtitle">{CONTENT.hero.subtitle}</p>
          <div className="iasv-hero__ctas">
            <a href="#produit" className="iasv-cta iasv-cta--primary">
              {CONTENT.hero.primary}
            </a>
            <Link to="/login" className="iasv-cta iasv-cta--ghost">
              {CONTENT.hero.secondary}
            </Link>
          </div>
        </div>
      </section>

      {/* PRODUIT */}
      <section id="produit" className="iasv-section">
        <div className="iasv-section__inner iasv-grid-split">
          <div className="iasv-grid-split__media">
            <img src="/camera-installee.png" alt="Caméra IA Sport Vision installée" />
            <div className="iasv-floating-card">
              <img src="/camera-face.png" alt="Caméra IA Sport Vision" />
            </div>
          </div>
          <div className="iasv-grid-split__text">
            <span className="iasv-eyebrow">{CONTENT.product.eyebrow}</span>
            <h2>{CONTENT.product.title}</h2>
            <p className="iasv-lead">{CONTENT.product.text}</p>
            <div className="iasv-features">
              {CONTENT.product.features.map((f) => (
                <div key={f.title} className="iasv-feature">
                  <h4>{f.title}</h4>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* APPLICATION MOBILE */}
      <section id="application" className="iasv-section iasv-section--alt">
        <div className="iasv-section__inner">
          <div className="iasv-section__head">
            <span className="iasv-eyebrow">{CONTENT.app.eyebrow}</span>
            <h2>{CONTENT.app.title}</h2>
            <p className="iasv-lead">{CONTENT.app.text}</p>
          </div>

          <div className="iasv-pillars">
            {CONTENT.app.pillars.map((p) => (
              <div key={p.label} className="iasv-pillar">
                <span className="iasv-pillar__icon" aria-hidden="true">{p.icon}</span>
                <span className="iasv-pillar__label">{p.label}</span>
              </div>
            ))}
          </div>

          <div className="iasv-app-gallery">
            {CONTENT.app.screenshots.map((s) => (
              <div key={s.src} className="iasv-app-gallery__item">
                <img src={s.src} alt={s.alt} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLUBS AMATEURS */}
      <section className="iasv-section">
        <div className="iasv-section__inner iasv-grid-split iasv-grid-split--reverse">
          <div className="iasv-grid-split__text">
            <span className="iasv-eyebrow">{CONTENT.clubs.eyebrow}</span>
            <h2>{CONTENT.clubs.title}</h2>
            <p className="iasv-lead">{CONTENT.clubs.text}</p>
            <div className="iasv-features iasv-features--two">
              {CONTENT.clubs.items.map((f) => (
                <div key={f.title} className="iasv-feature">
                  <h4>{f.title}</h4>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="iasv-grid-split__media">
            <img src="/Match.png" alt="Football amateur français" />
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="iasv-section iasv-section--alt">
        <div className="iasv-section__inner">
          <div className="iasv-section__head iasv-section__head--center">
            <span className="iasv-eyebrow">{CONTENT.pricing.eyebrow}</span>
            <h2>{CONTENT.pricing.title}</h2>
            <p className="iasv-lead">{CONTENT.pricing.text}</p>
          </div>
          <div className="iasv-pricing">
            {CONTENT.pricing.plans.map((p) => (
              <div
                key={p.name}
                className={`iasv-plan ${p.highlight ? 'iasv-plan--highlight' : ''}`}
              >
                {p.highlight && <span className="iasv-plan__badge">Le plus choisi</span>}
                <h3>{p.name}</h3>
                <div className="iasv-plan__price">
                  <span className="iasv-plan__amount">{p.price}</span>
                  <span className="iasv-plan__period">{p.period}</span>
                </div>
                <ul>
                  {p.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <a href="#contact" className="iasv-cta iasv-cta--primary iasv-cta--block">
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="iasv-section">
        <div className="iasv-section__inner">
          <div className="iasv-contact">
            <div className="iasv-contact__text">
              <span className="iasv-eyebrow">{CONTENT.contact.eyebrow}</span>
              <h2>{CONTENT.contact.title}</h2>
              <p className="iasv-lead">{CONTENT.contact.text}</p>
              <a
                href={`mailto:${CONTENT.contact.email}`}
                className="iasv-cta iasv-cta--primary"
              >
                {CONTENT.contact.email}
              </a>
            </div>
            <form
              className="iasv-contact__form"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const subject = encodeURIComponent(`Demande IA Sport Vision — ${fd.get('club') || ''}`);
                const body = encodeURIComponent(
                  `Nom: ${fd.get('name') || ''}\nClub: ${fd.get('club') || ''}\nEmail: ${fd.get('email') || ''}\n\n${fd.get('message') || ''}`
                );
                window.location.href = `mailto:${CONTENT.contact.email}?subject=${subject}&body=${body}`;
              }}
            >
              <label>
                Nom
                <input name="name" type="text" required placeholder="Votre nom" />
              </label>
              <label>
                Club
                <input name="club" type="text" placeholder="Nom de votre club" />
              </label>
              <label>
                Email
                <input name="email" type="email" required placeholder="vous@exemple.fr" />
              </label>
              <label>
                Message
                <textarea name="message" rows={4} placeholder="Parlez-nous de votre projet..." />
              </label>
              <button type="submit" className="iasv-cta iasv-cta--primary iasv-cta--block">
                Envoyer
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="iasv-footer">
        <div className="iasv-footer__inner">
          <div className="iasv-footer__brand">
            <img src="/logo-blanc.png" alt="IA Sport Vision" />
          </div>
          <div className="iasv-footer__col">
            <strong>Solution</strong>
            <a href="#produit">Produit</a>
            <a href="#application">Application mobile</a>
            <a href="#tarifs">Tarifs</a>
          </div>
          <div className="iasv-footer__col">
            <strong>Club</strong>
            <Link to="/login">Espace club</Link>
            <a href="#contact">Contact</a>
          </div>
          <div className="iasv-footer__col">
            <strong>Contact</strong>
            <a href={`mailto:${CONTENT.contact.email}`}>{CONTENT.contact.email}</a>
          </div>
        </div>
        <div className="iasv-footer__bottom">
          © {new Date().getFullYear()} IA Sport Vision — Le football amateur français, en vidéo.
          {' · '}
          <Link to="/index.php/politique-de-confidentialite-ia-sport-vision/">Politique de confidentialité</Link>
        </div>
      </footer>
    </div>
  );
}
