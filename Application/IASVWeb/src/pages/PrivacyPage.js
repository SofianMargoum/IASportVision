import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPage.css';

const SECTIONS = [
  {
    title: '1. Responsable du traitement',
    content: (
      <>
        <p>Le responsable du traitement est :</p>
        <p><strong>IA Sport Vision</strong> (activité personnelle en cours de structuration)<br />
        Contact : <a href="mailto:contact@iasportvision.com">contact@iasportvision.com</a></p>
      </>
    ),
  },
  {
    title: '2. Données collectées',
    content: (
      <>
        <p>L'Application peut collecter les données suivantes :</p>
        <ul>
          <li><strong>Informations de compte :</strong> adresse email, nom d'utilisateur</li>
          <li><strong>Informations de profil :</strong> type de profil (entraîneur, joueur, supporter), club sélectionné</li>
          <li><strong>Données d'utilisation :</strong> navigation dans l'application, interactions avec les fonctionnalités</li>
          <li><strong>Données vidéo :</strong> vidéos de matchs, séquences enregistrées et analysées</li>
          <li><strong>Données analytiques :</strong> statistiques de matchs et de joueurs générées par l'application</li>
        </ul>
      </>
    ),
  },
  {
    title: '3. Finalités du traitement',
    content: (
      <ul>
        <li>Permettre l'accès et l'utilisation de l'application</li>
        <li>Personnaliser l'expérience utilisateur</li>
        <li>Afficher les matchs, statistiques et contenus associés</li>
        <li>Fournir des fonctionnalités d'analyse vidéo</li>
        <li>Améliorer les performances et les services de l'application</li>
        <li>Assurer la sécurité et le bon fonctionnement</li>
      </ul>
    ),
  },
  {
    title: '4. Partage des données',
    content: (
      <>
        <p>Les données peuvent être traitées par des services tiers nécessaires au fonctionnement de l'application, notamment :</p>
        <ul>
          <li><strong>Google Cloud Platform :</strong> hébergement des données et des vidéos</li>
          <li><strong>Hikvision :</strong> gestion des flux vidéo et des équipements de capture</li>
        </ul>
        <p>Aucune donnée personnelle n'est vendue à des tiers.</p>
      </>
    ),
  },
  {
    title: '5. Stockage et sécurité',
    content: (
      <>
        <p>Les données sont stockées sur des infrastructures sécurisées. Des mesures techniques et organisationnelles sont mises en place pour protéger les données contre :</p>
        <ul>
          <li>accès non autorisé</li>
          <li>perte</li>
          <li>altération</li>
        </ul>
      </>
    ),
  },
  {
    title: '6. Durée de conservation',
    content: (
      <ul>
        <li>pendant la durée d'utilisation de l'application</li>
        <li>ou jusqu'à suppression du compte par l'utilisateur</li>
      </ul>
    ),
  },
  {
    title: '7. Droits des utilisateurs (RGPD)',
    content: (
      <>
        <p>Conformément à la réglementation en vigueur, vous disposez des droits suivants :</p>
        <ul>
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit de suppression</li>
          <li>Droit d'opposition</li>
          <li>Droit à la limitation du traitement</li>
        </ul>
        <p>Pour exercer vos droits, contactez : <a href="mailto:contact@iasportvision.com">contact@iasportvision.com</a></p>
      </>
    ),
  },
  {
    title: '8. Données concernant des tiers (matchs, joueurs)',
    content: (
      <>
        <p>L'Application permet la capture et la diffusion de contenus sportifs (vidéos de matchs). Les clubs, utilisateurs ou organisations utilisant l'Application sont responsables :</p>
        <ul>
          <li>d'obtenir les autorisations nécessaires des personnes filmées</li>
          <li>de respecter les réglementations locales applicables (notamment en matière de droit à l'image)</li>
        </ul>
      </>
    ),
  },
  {
    title: '9. Mineurs',
    content: (
      <p>L'Application peut être utilisée dans un contexte sportif incluant des mineurs. Il appartient aux clubs et responsables légaux de s'assurer que les autorisations nécessaires ont été obtenues.</p>
    ),
  },
  {
    title: '10. Modifications',
    content: (
      <p>Cette politique peut être modifiée à tout moment. Toute modification sera publiée sur cette page.</p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="iasv-privacy">
      <div className="iasv-privacy__hero">
        <div className="iasv-privacy__hero-inner">
          <Link to="/" className="iasv-privacy__back">← Retour à l'accueil</Link>
          <h1>Politique de confidentialité</h1>
          <p className="iasv-privacy__update">Dernière mise à jour : 01/05/2026</p>
          <p className="iasv-privacy__intro">
            IA Sport Vision attache une importance particulière à la protection des données personnelles de ses utilisateurs.
            Cette politique explique quelles données sont collectées, comment elles sont utilisées et quels sont vos droits.
          </p>
        </div>
      </div>

      <div className="iasv-privacy__body">
        <div className="iasv-privacy__inner">
          {SECTIONS.map((s) => (
            <section key={s.title} className="iasv-privacy__section">
              <h2>{s.title}</h2>
              <div className="iasv-privacy__content">{s.content}</div>
            </section>
          ))}
        </div>
      </div>

      <div className="iasv-privacy__footer-bar">
        © {new Date().getFullYear()} IA Sport Vision —{' '}
        <Link to="/">Retour à l'accueil</Link>
      </div>
    </div>
  );
}
